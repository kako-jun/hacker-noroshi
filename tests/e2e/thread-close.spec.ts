import { test, expect, type Page } from '@playwright/test';
import {
	signupNewUser,
	submitStory,
	postComment,
	findStoryIdByTitle,
	setStoryCreatedAt,
	setCommentCreatedAt
} from './helpers';

/**
 * Issue #179 バッチB + #181: スレッドクローズ（14日 = TWO_WEEKS_MS）の実動作確認。
 *
 * ミリ秒境界そのものは tests/unit/item-actions.test.ts の 'comment action' describe
 * で固定済みなので、ここでは実ブラウザで:
 *   - 13日後はまだコメントフォームが見える
 *   - 14日+1時間後はコメントフォーム・reply リンクが DOM から完全に消える
 *     （isThreadOpen によるクライアント側ガード、ItemPage.svelte）
 *   - #181 で直したサーバー側ガード（itemActions.ts の elapsed >= TWO_WEEKS_MS）が
 *     クライアントガードを迂回しても単独で効き、"Thread is closed" を表示する
 * ことを確認する。
 */
async function setupOpenThreadWithComment(page: Page): Promise<{ storyId: number; commentId: number }> {
	await page.goto('/logout').catch(() => {});
	await signupNewUser(page);
	const title = `thread-close ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
	await submitStory(page, { title, text: 'body' });
	await page.goto('/newest');
	const storyId = await findStoryIdByTitle(page, title);
	await page.goto(`/item/${storyId}`);
	await page.waitForLoadState('networkidle');
	await postComment(page, 'a comment while the thread is open');
	await expect(page.locator('.comment-item').first()).toBeVisible({ timeout: 10_000 });
	const elementId = await page.locator('.comment-item').first().getAttribute('id');
	const m = elementId!.match(/item-(\d+)/);
	return { storyId, commentId: Number(m![1]) };
}

test.describe('thread close (14 days / TWO_WEEKS_MS)', () => {
	test('13日後: コメントフォームがまだ表示される', async ({ page }) => {
		const { storyId } = await setupOpenThreadWithComment(page);
		setStoryCreatedAt(storyId, 13 * 24);
		await page.goto(`/item/${storyId}`);
		await expect(page.locator('form[action="?/comment"]')).toHaveCount(1);
	});

	test('14日+1時間後: コメントフォームも reply リンクも DOM から消える', async ({ page }) => {
		const { storyId } = await setupOpenThreadWithComment(page);
		setStoryCreatedAt(storyId, 14 * 24 + 1);
		await page.goto(`/item/${storyId}`);
		await expect(page.locator('form[action="?/comment"]')).toHaveCount(0);
		await expect(page.locator('.comment-reply a:has-text("reply")')).toHaveCount(0);
	});

	test('#181: サーバー側ガードはクライアントガードを迂回した POST でも単独で効き "Thread is closed" を表示する', async ({
		page
	}) => {
		const { storyId, commentId } = await setupOpenThreadWithComment(page);
		setStoryCreatedAt(storyId, 14 * 24 + 1);
		// setup で投稿したコメントが「直近コメント」として2分レート制限（itemActions.ts）に
		// 引っかかり、目的のスレッドクローズ判定に到達する前に 429 になってしまう
		// （レート制限チェックがスレッドクローズより先に評価されるため）。
		// このテストの主眼はスレッドクローズ単体の確認なので、レート制限側は解除しておく。
		setCommentCreatedAt(commentId, 1);
		await page.goto(`/item/${storyId}`);
		await page.waitForLoadState('networkidle');

		// isThreadOpen によりコメントフォームは DOM に存在しない（use:enhance も経由しない）。
		// 生 <form> を注入してネイティブ submit することで、サーバー側の
		// elapsed >= TWO_WEEKS_MS ガード（itemActions.ts の comment action）が
		// クライアント側の isThreadOpen チェックとは独立して効いていることを確認する。
		await Promise.all([
			page.waitForNavigation({ waitUntil: 'networkidle' }),
			page.evaluate(() => {
				const form = document.createElement('form');
				form.method = 'POST';
				form.action = '?/comment';
				const textarea = document.createElement('textarea');
				textarea.name = 'text';
				textarea.value = 'bypassing the client guard';
				form.appendChild(textarea);
				document.body.appendChild(form);
				form.submit();
			})
		]);

		await expect(page.locator('.comment-error')).toContainText('Thread is closed');
	});
});
