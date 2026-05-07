import { test, expect } from '@playwright/test';
import {
	signupNewUser,
	submitStory,
	postComment,
	findStoryIdByTitle,
	setStoryCreatedAt,
	setCommentCreatedAt,
	runD1
} from './helpers';

/**
 * Issue #122: 編集ウィンドウ境界 (2 時間)。
 *
 * - 2 時間超過の story の edit / delete は拒否される（フォーム消滅 or "expired"）。
 * - 2 時間超過の comment も同様。
 * - 1 時間前に書き換えれば編集成功する（境界の上側のみ確認、下側は full-flow で既存）。
 *
 * created_at は wrangler d1 execute で直接書き換える（テスト用 helper）。
 */
test.describe('edit window 2h boundary', () => {
	test('story が 3 時間前なら edit/delete UI が消える', async ({ page }) => {
		await signupNewUser(page);
		const title = `edit-window story ${Date.now()}`;
		await submitStory(page, { title, text: 'body' });
		await page.goto('/newest');
		const storyId = await findStoryIdByTitle(page, title);

		// 1 時間前: edit / delete リンクが出る（境界内）
		setStoryCreatedAt(storyId, 1);
		await page.goto(`/item/${storyId}`);
		await expect(page.locator('a:has-text("edit")')).toHaveCount(1);

		// 3 時間前: edit / delete UI が消える
		setStoryCreatedAt(storyId, 3);
		await page.goto(`/item/${storyId}`);
		await expect(page.locator('a:has-text("edit")')).toHaveCount(0);
		// `delete` は inline-form の button. 同様に消えていること。
		await expect(page.locator('button.link-button:has-text("delete")')).toHaveCount(0);
	});

	test('comment が 3 時間前なら edit/delete UI が消える', async ({ page }) => {
		await signupNewUser(page);
		const title = `edit-window comment ${Date.now()}`;
		await submitStory(page, { title, text: 'body' });
		await page.goto('/newest');
		const storyId = await findStoryIdByTitle(page, title);
		await page.goto(`/item/${storyId}`);
		await page.waitForLoadState('networkidle');
		await postComment(page, 'A self comment');
		// post 後に再 fetch されたデータでコメントが描画される。
		// `.comment-item` が 1 件以上見えるまで待つ。
		await expect(page.locator('.comment-item').first()).toBeVisible({ timeout: 10_000 });
		const firstCommentItem = page.locator('.comment-item').first();
		const elementId = await firstCommentItem.getAttribute('id');
		const m = elementId!.match(/item-(\d+)/);
		const commentId = Number(m![1]);

		// 1 時間前: edit / delete が出る（境界内）
		setCommentCreatedAt(commentId, 1);
		await page.goto(`/item/${storyId}`);
		await expect(
			page.locator('.comment-reply a:has-text("edit")').first()
		).toBeVisible();

		// 3 時間前: edit / delete が消える
		setCommentCreatedAt(commentId, 3);
		await page.goto(`/item/${storyId}`);
		await expect(page.locator('.comment-reply a:has-text("edit")')).toHaveCount(0);
		await expect(page.locator('.comment-reply button.link-button:has-text("delete")')).toHaveCount(
			0
		);

		// 後始末: 残った 1 件以外のテストデータが他テストに影響しないように
		// なにもしない（DB は次回 db:init で消える）。
		void runD1; // import 維持
	});
});
