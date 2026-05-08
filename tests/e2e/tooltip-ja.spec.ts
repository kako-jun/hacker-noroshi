import { test, expect } from '@playwright/test';

/**
 * Issue #133: 英語のままのメニュー・アクションリンクにホバーで日本語訳ツールチップを表示。
 *
 * テキスト本体は英語のまま、`title` 属性で日本語訳を hover 表示する仕様。
 * ここでは header nav / footer / item ページのアクションリンクの 3 ケースだけ
 * 抜き取って `title` 属性が辞書通りに付与されているかを確認する。
 *
 * 動的 label (time-ago / "5 comments" 等の plural / 数値混合) は本 PR の対象外。
 */
test.describe('English label tooltip (title attribute)', () => {
	test('header nav の "new" リンクに title="新着" が付く', async ({ page }) => {
		await page.goto('/');
		const newLink = page.locator('.hn-header-nav a', { hasText: /^new$/ });
		await expect(newLink).toHaveAttribute('title', '新着');
	});

	test('footer の "API" リンクに公開 API のドキュメントの title が付く', async ({ page }) => {
		await page.goto('/');
		const apiLink = page.locator('.hn-footer a', { hasText: /^API$/ });
		await expect(apiLink).toHaveAttribute('title', '公開 API のドキュメント');
	});

	test('/item/{id} で reply アクションリンク（または add comment）に日本語 title が付く', async ({ page }) => {
		// /newest から最初のストーリーへ遷移し、未ログインでも見える "add comment" 不可だが
		// コメントがあれば reply ボタン（未ログインでは出ない）が無いので
		// ここではログイン済み seed user で「add comment」ボタンの title を確認する。
		await page.goto('/login');
		await page.waitForLoadState('networkidle');
		const loginForm = page.locator('form[action="?/login"]');
		await loginForm.locator('input[name="username"]').fill('noroshi');
		await loginForm.locator('input[name="password"]').fill('test1234');
		await Promise.all([
			page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15_000 }).catch(() => {}),
			loginForm.locator('button[type="submit"]').click()
		]);

		// /newest から最初の /item/N へ。
		await page.goto('/newest');
		const firstItemLink = page.locator('.story-item a[href^="/item/"]').first();
		const href = await firstItemLink.getAttribute('href');
		expect(href, 'newest に少なくとも 1 件のアイテムがある').toBeTruthy();
		await page.goto(href!);

		// `add comment` ボタン（ログイン済みで thread open のときに出る）の title を確認。
		const addCommentBtn = page.locator('button[type="submit"]', { hasText: /^add comment$/ });
		await expect(addCommentBtn).toHaveAttribute('title', 'コメントを追加');
	});
});
