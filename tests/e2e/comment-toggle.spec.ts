import { test, expect } from '@playwright/test';
import { signupNewUser, submitStory, findStoryIdByTitle, postComment, runD1 } from './helpers';

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
	// 注 (#164): コメント permalink は /comment/{id} に分離した。stories と comments
	// は別テーブルで id 空間が衝突する（seed の comment id 15-19 は story id とも衝突）。
	// コメント permalink を踏むには、その timestamp リンク (/comment/{commentId}) を
	// 使う。context リンクは story ページのアンカーなので /item/{storyId}#item-{id} のまま。
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

		// 作ったコメントの id を timestamp リンク (/comment/{commentId}) から取得する。
		const commentTsHref = await page
			.locator('.comment-item .comment-head a')
			.filter({ hasText: /ago/ })
			.first()
			.getAttribute('href');
		const m = commentTsHref?.match(/\/comment\/(\d+)/);
		expect(m).not.toBeNull();
		const commentId = Number(m![1]);

		// コメント permalink (mode==='comment') を開く。context href は story ページの
		// アンカーなので /item/{parentStoryId}#item-{commentId}。
		await page.goto(`/comment/${commentId}`);
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

/**
 * Issue #164: コメント permalink を /comment/[id] に分離。
 *
 * stories と comments は別テーブルで id 空間が衝突する（seed: story 1-46 /
 * comment 1-44）。旧 /item/[id] は story を先に解決するため、id 衝突時に
 * コメント permalink が同 id の story にすり替わり、返信も誤った story に付いた。
 *
 * 採用方針: コメント permalink = /comment/{id}。/item は story 専用で、story でない
 * id は /comment/{id} へ 308 リダイレクトする。
 *
 * seed の衝突ケース: comment id 17 は story_id=8（BBS, -2日=スレッド open）に属し、
 * story id 17 は別の story（Markdown エディタ）。/comment/17 は story 8 を解決する。
 */
test.describe('Issue #164: /comment/[id] コメント permalink 分離', () => {
	test('story でない id への /item アクセスは /comment へ 308 リダイレクトされる', async ({ page }) => {
		// seed の comment id（1-44）は全て story id（1-46）と衝突するため、/item でも
		// story として解決されてしまう。redirect を踏むには「comment だが story でない」
		// id が要る = 新規 comment（id > 最大 story id）。
		const title = `redirect target ${Date.now()}`;
		await signupNewUser(page);
		await submitStory(page, { title, url: `https://example.com/rd-${Date.now()}` });
		await page.goto('/newest');
		const storyId = await findStoryIdByTitle(page, title);
		// comment の AUTOINCREMENT を story 最大 id より十分大きくし、新規 comment id が
		// どの story id とも衝突しないよう保証する（api-v0.spec.ts と同手法）。
		runD1(
			"UPDATE sqlite_sequence SET seq = (SELECT MAX(id) + 100 FROM stories) WHERE name = 'comments'"
		);
		await page.goto(`/item/${storyId}`);
		await page.waitForLoadState('networkidle');
		await postComment(page, 'comment whose id should not be a story');
		await page.waitForSelector('.comment-text', { state: 'visible', timeout: 15_000 });
		const href = await page
			.locator('.comment-item .comment-head a')
			.filter({ hasText: /ago/ })
			.first()
			.getAttribute('href');
		const commentId = Number(href!.match(/\/comment\/(\d+)/)![1]);

		// この comment id へ /item でアクセス → /comment/{id} へ 308 転送される。
		await page.goto(`/item/${commentId}`);
		await page.waitForLoadState('networkidle');
		expect(new URL(page.url()).pathname).toBe(`/comment/${commentId}`);
		// permalink (mode==='comment') の sanity: フォーカスコメント本文が出る。
		await expect(page.locator('.item-detail > .comment-text').first()).toBeVisible();
	});

	test('/comment/{id} でコメント permalink が表示される（フォーカスコメント本文）', async ({ page }) => {
		// 新規 story + comment を作り、衝突しない comment id でパーマリンクを踏む。
		const title = `comment permalink view ${Date.now()}`;
		await signupNewUser(page);
		await submitStory(page, { title, url: `https://example.com/cpv-${Date.now()}` });
		await page.goto('/newest');
		const storyId = await findStoryIdByTitle(page, title);
		await page.goto(`/item/${storyId}`);
		await page.waitForLoadState('networkidle');
		const body = `focus comment body ${Date.now()}`;
		await postComment(page, body);
		await page.waitForSelector('.comment-text', { state: 'visible', timeout: 15_000 });

		// timestamp リンクは /comment/{commentId}。踏んで permalink を開く。
		const tsLink = page
			.locator('.comment-item .comment-head a')
			.filter({ hasText: /ago/ })
			.first();
		const href = await tsLink.getAttribute('href');
		expect(href).toMatch(/^\/comment\/\d+$/);
		await tsLink.click();
		await page.waitForURL(/\/comment\/\d+/);
		await page.waitForLoadState('networkidle');

		// フォーカスコメント本文が permalink の先頭（.item-detail 直下）に出る。
		await expect(page.locator('.item-detail > .comment-text p').filter({ hasText: body })).toBeVisible();
		// on:<storyTitle> リンクが出る（mode==='comment' の確証）。
		await expect(page.locator('.item-detail a').filter({ hasText: title })).toBeVisible();
	});

	test('story ページのコメント timestamp リンクが /comment/{id} を指す', async ({ page }) => {
		// seed の story 8（BBS）はコメント 15-19 を持つ。timestamp は全て /comment/{id}。
		await page.goto('/item/8');
		await page.waitForLoadState('networkidle');
		const row15 = page.locator('#item-15');
		const tsHref = await row15
			.locator('.comment-head a')
			.filter({ hasText: /ago/ })
			.first()
			.getAttribute('href');
		expect(tsHref).toBe('/comment/15');
	});

	// #164 の核心: id 衝突下でも返信が正しい story に付く。
	// comment 17（story_id=8）の permalink /comment/17 から返信すると、story 8 に付き、
	// 同 id の story 17 には付かない。
	test('/comment/{id} の返信が（id 衝突時も）正しい story に付く', async ({ page }) => {
		await signupNewUser(page);
		// comment 17 の permalink。parentStory は story 8（BBS）であるべき。
		await page.goto('/comment/17');
		await page.waitForLoadState('networkidle');

		// sanity: on:<storyTitle> が BBS story（story 8）を指している（/item/8）。
		const onLink = page.locator('.item-detail a').filter({ hasText: 'BBS' }).first();
		await expect(onLink).toHaveAttribute('href', '/item/8');

		// フォーカスコメント直下の reply フォーム（parent_id=17）で返信する。
		const replyBody = `reply via comment permalink ${Date.now()}`;
		try {
			const replyForm = page.locator('.item-detail > .comment-form form[action="?/comment"]').first();
			await replyForm.locator('textarea[name="text"]').fill(replyBody);
			await replyForm.locator('button[type="submit"]').click();

			// 投稿後、enhance + invalidateAll で同ページの subtree に返信が出る = story 8 に
			// 付いた（誤って story 17 へ行っていない）。inline 再描画を待ってから次へ進む。
			await expect(page.locator('.comment-text p').filter({ hasText: replyBody })).toBeVisible({ timeout: 15_000 });

			// リロードしても subtree に出る（永続化確認）。
			await page.goto('/comment/17');
			await page.waitForLoadState('networkidle');
			await expect(page.locator('.comment-text p').filter({ hasText: replyBody })).toBeVisible();

			// 正しい story（story 8 = /item/8）にも出る。
			await page.goto('/item/8');
			await page.waitForLoadState('networkidle');
			await expect(page.locator('.comment-text p').filter({ hasText: replyBody })).toBeVisible();

			// 衝突 story（story 17 = /item/17 は実在の別 story）には出ない。
			await page.goto('/item/17');
			await page.waitForLoadState('networkidle');
			await expect(page.locator('.comment-text p').filter({ hasText: replyBody })).toHaveCount(0);
		} finally {
			// このテストは seed の story 8 ツリーに返信を足すため、同 DB で他テスト
			// （(N more) 等）や本テストの再走を汚さないよう、投下した返信を消し
			// comment_count を戻す。assertion 失敗時も必ず後始末する。
			const escaped = replyBody.replace(/'/g, "''");
			runD1(
				`UPDATE stories SET comment_count = comment_count - (SELECT COUNT(*) FROM comments WHERE story_id = 8 AND text = '${escaped}') WHERE id = 8; DELETE FROM comments WHERE story_id = 8 AND text = '${escaped}';`
			);
		}
	});
});
