import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

/**
 * Issue #122: 削除済アカウントの表示と再ログイン拒否。
 *
 * seed.sql の `deleted_acc` (id=9, deleted=1) を対象にする。
 * 関連: full-flow C-5 でも signup→delete→login 拒否を別経路でカバーしている。
 */
test.describe('deleted user', () => {
	test('/user/deleted_acc shows account-deleted message', async ({ page }) => {
		await page.goto('/user/deleted_acc');
		await expect(page.locator('body')).toContainText(
			'This user has deleted their account.'
		);
	});

	test('login attempt with deleted_acc is rejected with Bad login', async ({ page }) => {
		await loginAs(page, 'deleted_acc', 'test1234');
		// loginAs は失敗時 / に飛ばないので、/login のままで Bad login が出るのを期待。
		await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
		await expect(page.locator('body')).toContainText(/Bad login/i);
	});

	test('deleted_acc が投稿した story (id=38 dead show) は username が [deleted] 表示', async ({
		page
	}) => {
		// seed の story id 38 は deleted_acc (user_id=9) が投稿した dead show。
		// `username` 列は表示時に displayUsername で [deleted] に置換される。
		// ただし dead 化されているので、showdead を有効にしたユーザーで item ページを直接開く。
		await page.goto('/item/38');
		// dead でも item ページ自体は描画される（HN 仕様）。username 部分が `[deleted]`。
		// "user_deleted" は seed JOIN で 1 が来るため、displayUsername が `[deleted]` を返す。
		await expect(page.locator('body')).toContainText('[deleted]');
	});
});
