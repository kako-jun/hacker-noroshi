import { test, expect, type Page } from '@playwright/test';
import { signupNewUser, submitStory, findStoryIdByTitle, postComment } from './helpers';

/**
 * Issue #130: クリック後の動的状態（reply/edit form 等）のインデント整合性監査
 *
 * 真因（修正前）: `.comment-text` の inner padding-left が 0 で、ask 本文
 * (`.item-text` padding-left:18px) より 18px 左に出っ張っていた。本家 HN
 * の階段パターン（タイトル本文 / ストーリー本文 / コメント本文の x が揃う）
 * を破っていた。
 *
 * 修正は `padding-left: 18px` を `app.css` の `.item-text` / `.comment-text`
 * / `.comment-form` / `.comment-reply` / `.comment-error` クラスに集約。
 *
 * 「Issue 番号で固定された seed の ID」に依存せず、必要なストーリー / コメントを
 * 各テスト内で signup → submit → comment と組み立てる。
 */

async function readX(page: Page, selector: string): Promise<number> {
	return page.locator(selector).first().evaluate((el) => Math.round(el.getBoundingClientRect().x));
}

async function setupStoryWithComment(page: Page, opts: { title: string; ask?: boolean }): Promise<number> {
	await signupNewUser(page);
	const storyArg = opts.ask
		? { title: opts.title, text: 'ask body to test alignment' }
		: { title: opts.title, url: 'https://example.com/x-test-' + Date.now() };
	await submitStory(page, storyArg);
	await page.goto('/newest');
	const id = await findStoryIdByTitle(page, opts.title);
	await page.goto(`/item/${id}`);
	await page.waitForLoadState('networkidle');
	await postComment(page, 'comment to test x alignment');
	// postComment は enhance form を submit するだけなので、コメントが描画される
	// まで待つ。invalidateAll → server load → re-render の race を避ける。
	await page.waitForSelector('.comment-text', { state: 'visible', timeout: 15_000 });
	return id;
}

test.describe('Issue #130: /item/[id] 内の本文テキストの x 揃え', () => {
	test('Mode B (story view): タイトル / 本文 / コメント本文 の x が揃う', async ({ page }) => {
		const title = `Ask: x align ${Date.now()}`;
		await setupStoryWithComment(page, { title, ask: true });

		const titleX = await readX(page, '.item-title');
		const itemTextX = await readX(page, '.item-text p');
		const commentTextX = await readX(page, '.comment-text p');

		expect(Math.abs(itemTextX - titleX)).toBeLessThanOrEqual(2);
		expect(Math.abs(commentTextX - titleX)).toBeLessThanOrEqual(2);
	});

	test('Mode A (comment permalink): on:タイトル と コメント本文 の x が揃う', async ({ page }) => {
		const title = `Story: comment permalink ${Date.now()}`;
		await setupStoryWithComment(page, { title });

		// timestamp link が `/item/<commentId>` のパーマリンク
		await page.locator('.comment-item .comment-head a').filter({ hasText: /ago/ }).first().click();
		await page.waitForURL(/\/item\/\d+/);
		await page.waitForLoadState('networkidle');

		// data.mode === 'comment' の sanity check: on:<storyTitle> リンクが出るはず
		const storyTitleLink = page.locator('.item-detail a').filter({ hasText: title });
		await expect(storyTitleLink).toBeVisible();

		const titleLinkX = await storyTitleLink.first().evaluate((el) => Math.round(el.getBoundingClientRect().x));
		const commentTextX = await readX(page, '.comment-text p');

		// ストーリーへのリンク（meta 行内）と コメント本文の text 開始位置が同等であること
		expect(Math.abs(commentTextX - titleLinkX)).toBeLessThanOrEqual(20);
	});

	test('Mode B: reply クリックで開いた textarea が comment-text と同じ x', async ({ page }) => {
		const title = `Reply form x ${Date.now()}`;
		await setupStoryWithComment(page, { title });

		const commentTextX = await readX(page, '.comment-text p');

		// reply / edit リンクは .comment-reply 内
		await page.locator('.comment-item .comment-reply a:has-text("reply")').first().click();
		await page.waitForSelector('.comment-item .comment-form textarea');

		const replyTextareaX = await readX(page, '.comment-item .comment-form textarea');
		expect(Math.abs(replyTextareaX - commentTextX)).toBeLessThanOrEqual(4);
	});

	test('Mode B: edit クリックで開いた textarea が comment-text と同じ x', async ({ page }) => {
		const title = `Edit form x ${Date.now()}`;
		await setupStoryWithComment(page, { title });

		const commentTextX = await readX(page, '.comment-text p');

		await page.locator('.comment-item .comment-reply a:has-text("edit")').first().click();
		await page.waitForSelector('.comment-item .comment-form textarea');

		const editTextareaX = await readX(page, '.comment-item .comment-form textarea');
		expect(Math.abs(editTextareaX - commentTextX)).toBeLessThanOrEqual(4);
	});

	test('CSS クラス側で padding-left: 18px が定義されている (回帰防止)', async ({ page }) => {
		const title = `CSS regression ${Date.now()}`;
		await setupStoryWithComment(page, { title, ask: true });

		const commentTextPad = await page.locator('.comment-text').first().evaluate(
			(el) => getComputedStyle(el).paddingLeft
		);
		expect(commentTextPad).toBe('18px');

		const itemTextPad = await page.locator('.item-detail .item-text').first().evaluate(
			(el) => getComputedStyle(el).paddingLeft
		);
		expect(itemTextPad).toBe('18px');
	});
});
