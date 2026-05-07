import { test, expect } from '@playwright/test';

/**
 * Issue #122: nav active 太字 + 右端 topright ラベル。
 *
 * `+layout.svelte` の `isActive` / `currentTopright` を E2E で確認する。
 *   - 完全一致のみ active（/ask が /asknew でアクティブにならない）
 *   - nav に出ていないが topright ラベルだけ出すパス（asknew 等）
 *   - / (home) は nav 内 active なし、topright なし
 *   - /login は header-right の認証リンクと重複するため topright 出さない
 */
test.describe('nav active + topright', () => {
	test('/newest: nav の "new" が active で aria-current="page"', async ({ page }) => {
		await page.goto('/newest');
		const newLink = page.locator('.hn-header-nav a', { hasText: /^new$/ });
		await expect(newLink).toHaveAttribute('aria-current', 'page');
		await expect(newLink).toHaveClass(/active/);
		// topright は nav 項目とテキストが重なる（"new"）が、layout 仕様としては表示する。
		await expect(page.locator('.topright')).toHaveText('new');
	});

	test('/asknew: nav 内 active 無し / topright が "asknew"', async ({ page }) => {
		await page.goto('/asknew');
		// nav 内のどのリンクにも aria-current が付かない（完全一致のみ active）
		await expect(page.locator('.hn-header-nav a[aria-current="page"]')).toHaveCount(0);
		await expect(page.locator('.topright')).toHaveText('asknew');
	});

	test('/ (home): nav 内 active なし、topright 非表示', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('.hn-header-nav a[aria-current="page"]')).toHaveCount(0);
		// `currentTopright` が空文字を返すと <span class="topright"> 自体が描画されない。
		await expect(page.locator('.topright')).toHaveCount(0);
	});

	test('/login: topright ラベルなし（header-right の login と重複回避）', async ({ page }) => {
		await page.goto('/login');
		await expect(page.locator('.topright')).toHaveCount(0);
	});
});
