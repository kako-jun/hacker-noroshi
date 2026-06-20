import { test, expect } from '@playwright/test';
import { signupNewUser, submitStory, findStoryIdByTitle, postComment } from './helpers';

/**
 * Issue #122: コメント [–] トグル + root / parent / next リンク。
 *
 * seed (db/seed.sql) の story id=8 (BBS) は 5 段ネストのコメントツリーを持つ:
 *   id 15 (root) → 16 → 17 → 18 → 19
 *
 * /item/8 を開いて以下を確認する:
 *  - root の [–] click で子孫が DOM/表示から消える
 *  - 再 click で復活する
 *  - 子コメントから root リンクが #item-{rootId} を指す
 *  - parent / next リンクのアンカー先が DOM 内に存在する
 */
test.describe('comment toggle / root / parent / next', () => {
	test('root の [–] で子孫が消え、再 click で復活する', async ({ page }) => {
		await page.goto('/item/8');
		await page.waitForLoadState('networkidle');
		// 子コメント (id 16, 17, 18, 19) はそれぞれ #item-{id}
		const childIds = [16, 17, 18, 19];
		for (const id of childIds) {
			await expect(page.locator(`#item-${id}`)).toBeVisible();
		}
		// root (id 15) の [–] リンク
		const rootRow = page.locator('#item-15');
		await rootRow.locator('.comment-toggle a').click();
		// 子孫は DOM から消える（{#if !isHidden(child)} で除外される）
		for (const id of childIds) {
			await expect(page.locator(`#item-${id}`)).toHaveCount(0);
		}
		// 再 click で復活
		await rootRow.locator('.comment-toggle a').click();
		for (const id of childIds) {
			await expect(page.locator(`#item-${id}`)).toBeVisible();
		}
	});

	test('child の root / parent / next リンクが想定の anchor を指す', async ({ page }) => {
		await page.goto('/item/8');
		await page.waitForLoadState('networkidle');
		// id 17 は parent_id=16 (id 16 の child)。root は 15。
		const row17 = page.locator('#item-17');
		// root リンク
		const rootHref = await row17.locator('a:has-text("root")').first().getAttribute('href');
		expect(rootHref).toBe('#item-15');
		// parent リンク
		const parentHref = await row17
			.locator('a:has-text("parent")')
			.first()
			.getAttribute('href');
		expect(parentHref).toBe('#item-16');
		// next リンク（DFS 順で id 17 の次は 18）
		const nextHref = await row17.locator('a:has-text("next")').first().getAttribute('href');
		expect(nextHref).toBe('#item-18');
	});
});

/**
 * Issue #157 / #158: HN パリティ — prev リンク / context リンク（モード境界）/ 折り畳み (N more)。
 *
 * seed (db/seed.sql) の story id=8 (BBS) は 5 段の線形コメントツリー:
 *   id 15 (root) → 16 → 17 → 18 → 19
 * DFS 平坦化順 = 15, 16, 17, 18, 19。各コメント div は id="item-{id}"。
 */
test.describe('comment HN parity: prev / context / (N more)', () => {
	// #157 prev: ツリー (mode==='story') の各行に DFS 前を指す prev リンクを足す。
	// 先頭 (15) は prev 無し・末尾 (19) は next 無し。
	test('prev リンクが DFS 前を指す。先頭に prev 無し・末尾に next 無し', async ({ page }) => {
		await page.goto('/item/8');
		await page.waitForLoadState('networkidle');

		// id 17 の prev は DFS 前の 16、next は 18（既存テストと整合）。
		const row17 = page.locator('#item-17');
		const prevHref = await row17
			.getByRole('link', { name: 'prev', exact: true })
			.getAttribute('href');
		expect(prevHref).toBe('#item-16');
		const nextHref = await row17
			.getByRole('link', { name: 'next', exact: true })
			.getAttribute('href');
		expect(nextHref).toBe('#item-18');

		// 先頭 id 15 は DFS の最初なので prev リンクが無い。
		await expect(
			page.locator('#item-15').getByRole('link', { name: 'prev', exact: true })
		).toHaveCount(0);
		// 末尾 id 19 は DFS の最後なので next リンクが無い。
		await expect(
			page.locator('#item-19').getByRole('link', { name: 'next', exact: true })
		).toHaveCount(0);
	});

	// #157 context: permalink (mode==='comment') の操作行のみ context を出す。
	// ツリー (mode==='story') 側には context を出さない（モード境界）。
	//
	// 注: /item/[id] の load は story を先に引くため（+page.server.ts）、stories と
	// comments は別テーブルで id 空間が衝突する。seed の comment id 15-19 は全て
	// story id (1-46) と衝突し /item/{commentId} は story にすり替わる。コメント
	// permalink (mode==='comment') を踏むには、story 衝突しない新規 comment を作って
	// その timestamp リンクから辿る（item-text-x-alignment.spec.ts と同手法）。
	test('context リンクは permalink のみ。ツリーには出ない', async ({ page }) => {
		const title = `context permalink ${Date.now()}`;
		await signupNewUser(page);
		await submitStory(page, { title, url: `https://example.com/ctx-${Date.now()}` });
		await page.goto('/newest');
		const storyId = await findStoryIdByTitle(page, title);
		await page.goto(`/item/${storyId}`);
		await page.waitForLoadState('networkidle');
		await postComment(page, 'comment for context permalink');
		await page.waitForSelector('.comment-text', { state: 'visible', timeout: 15_000 });

		// story ツリー (mode==='story') 側には context リンクが1つも無い。
		await expect(page.getByRole('link', { name: 'context', exact: true })).toHaveCount(0);

		// 作ったコメントの id を timestamp リンク (/item/{commentId}) から取得する。
		const commentTsHref = await page
			.locator('.comment-item .comment-head a')
			.filter({ hasText: /ago/ })
			.first()
			.getAttribute('href');
		const m = commentTsHref?.match(/\/item\/(\d+)/);
		expect(m).not.toBeNull();
		const commentId = Number(m![1]);

		// コメント permalink (mode==='comment') を開く。context href は
		// /item/{parentStoryId}#item-{commentId}。
		await page.goto(`/item/${commentId}`);
		await page.waitForLoadState('networkidle');
		const contextHref = await page
			.getByRole('link', { name: 'context', exact: true })
			.first()
			.getAttribute('href');
		expect(contextHref).toBe(`/item/${storyId}#item-${commentId}`);
	});

	// #158 折り畳み: 畳むと子孫数を (N more) で表示（旧 "(N replies)" は廃止）。
	test('折り畳みで子孫数が (N more) で表示される', async ({ page }) => {
		await page.goto('/item/8');
		await page.waitForLoadState('networkidle');

		// id 16 の子孫は 17/18/19 の 3 つ。[–] を畳むと (3 more)。
		const row16 = page.locator('#item-16');
		await row16.locator('.comment-toggle a').click();
		await expect(row16.locator('.comment-toggle')).toContainText('(3 more)');
		// 旧文言 "replies" が出ないこと。
		await expect(row16.locator('.comment-toggle')).not.toContainText('repl');

		// root id 15 の子孫は 16/17/18/19 の 4 つ。畳むと (4 more)。
		const row15 = page.locator('#item-15');
		await row15.locator('.comment-toggle a').click();
		await expect(row15.locator('.comment-toggle')).toContainText('(4 more)');
	});
});
