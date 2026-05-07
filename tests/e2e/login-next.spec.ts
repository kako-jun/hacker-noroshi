import { test, expect } from '@playwright/test';
import { signupNewUser } from './helpers';

/**
 * Issue #122: /login?next= 後の戻り先 + オープンリダイレクト防御。
 *
 * 検証対象は `$lib/safe-next` と /login の load / login action の連携。
 *   - 未ログインで `/newest` の hide を踏む → /login?next=%2Fnewest に飛ぶ
 *   - 同 next 値で login → /newest に戻る
 *   - `/login?next=//evil.com` 等の不正 next は safeNext で `/` に正規化される
 *   - `/login?next=/ask` のような正当な相対パスはそのまま戻り先として効く
 */
test.describe('/login?next= redirect safety', () => {
	test('unauthenticated hide click on /newest goes to /login?next=%2Fnewest, then login returns to /newest', async ({
		page
	}) => {
		// 念のため未ログイン状態にする
		await page.goto('/logout').catch(() => {});

		// signup でユーザーを作る → 後で login するためにログアウトしてパスワードだけ覚える
		const username = await signupNewUser(page);
		await page.goto('/logout');

		// 未ログインで /newest を開いて hide リンクを click
		await page.goto('/newest');
		const firstHide = page.locator('.story-meta a', { hasText: 'hide' }).first();
		await firstHide.click();

		// /login?next=%2Fnewest にいるはず
		await expect(page).toHaveURL(/\/login\?next=/, { timeout: 10_000 });
		const url = new URL(page.url());
		expect(url.searchParams.get('next')).toBe('/newest');

		// login → next 経由で /newest に戻る
		await page.waitForLoadState('networkidle');
		const loginForm = page.locator('form[action="?/login"]');
		await loginForm.locator('input[name="username"]').fill(username);
		await loginForm.locator('input[name="password"]').fill('test1234');
		await loginForm.locator('button[type="submit"]').click();
		await expect(page).toHaveURL(/\/newest$/, { timeout: 15_000 });
	});

	test('/login?next=/ask は /ask に戻る', async ({ page }) => {
		await page.goto('/logout').catch(() => {});
		const username = await signupNewUser(page);
		await page.goto('/logout');

		await page.goto('/login?next=/ask');
		await page.waitForLoadState('networkidle');
		const loginForm = page.locator('form[action="?/login"]');
		await loginForm.locator('input[name="username"]').fill(username);
		await loginForm.locator('input[name="password"]').fill('test1234');
		await loginForm.locator('button[type="submit"]').click();
		await expect(page).toHaveURL(/\/ask$/, { timeout: 15_000 });
	});

	test('/login?next=//evil.com はオープンリダイレクトせず / にフォールバック', async ({
		page
	}) => {
		await page.goto('/logout').catch(() => {});
		const username = await signupNewUser(page);
		await page.goto('/logout');

		await page.goto('/login?next=//evil.com');
		await page.waitForLoadState('networkidle');
		const loginForm = page.locator('form[action="?/login"]');
		await loginForm.locator('input[name="username"]').fill(username);
		await loginForm.locator('input[name="password"]').fill('test1234');
		await loginForm.locator('button[type="submit"]').click();
		// safeNext が `//` を `/` に潰すので、ホームに戻る（別オリジンに抜けない）。
		await page.waitForURL(/^http:\/\/localhost:5173\/$/, { timeout: 15_000 });
		// 念のためオリジンが localhost のままであることを確認
		expect(new URL(page.url()).origin).toBe('http://localhost:5173');
	});
});
