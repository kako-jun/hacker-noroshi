import { expect, test } from '@playwright/test';

/**
 * アシストモード（#140）。右下の常設スイッチで「初心者の館」風の解説層をオン/オフする。
 * - 既定オフ＝素の HN 画面（.assist-intro は CSS で非表示）。
 * - オンで各画面上部に解説。cookie で永続（リロードしても維持）。
 * - オフで素の HN 画面に完全復元。
 */
test.describe('assist mode', () => {
	test('右下スイッチでトグルでき、cookie で永続し、オフで素の画面に戻る', async ({ page }) => {
		await page.goto('/');
		const sw = page.locator('.assist-switch');
		await expect(sw).toBeVisible();

		// 既定オフ：解説は隠れている。
		await expect(sw).toHaveAttribute('aria-checked', 'false');
		await expect(page.locator('.assist-intro').first()).toBeHidden();

		// オンにする：解説が出る。
		await sw.click();
		await expect(sw).toHaveAttribute('aria-checked', 'true');
		await expect(page.locator('.assist-intro').first()).toBeVisible();

		// リロードしても維持（cookie 永続・SSR で復元）。
		await page.reload();
		await expect(page.locator('.assist-switch')).toHaveAttribute('aria-checked', 'true');
		await expect(page.locator('.assist-intro').first()).toBeVisible();

		// オフにする：素の HN 画面へ完全復元（解説は隠れる）。
		await page.locator('.assist-switch').click();
		await expect(page.locator('.assist-switch')).toHaveAttribute('aria-checked', 'false');
		await expect(page.locator('.assist-intro').first()).toBeHidden();

		// オフもリロードを跨いで維持。
		await page.reload();
		await expect(page.locator('.assist-switch')).toHaveAttribute('aria-checked', 'false');
		await expect(page.locator('.assist-intro').first()).toBeHidden();
	});

	test('日本語ロケールではオン時に日本語の解説が出る', async ({ page }) => {
		await page.goto('/locale?lang=ja&next=/');
		await page.waitForLoadState('networkidle');
		// hydration 後にトグルが効くよう、押す前にスイッチの初期状態を待つ。
		const sw = page.locator('.assist-switch');
		await expect(sw).toHaveAttribute('aria-checked', 'false');
		await sw.click();
		const intro = page.locator('.assist-intro').first();
		await expect(intro).toBeVisible();
		await expect(intro).toContainText('ハッカーのろし');
	});
});
