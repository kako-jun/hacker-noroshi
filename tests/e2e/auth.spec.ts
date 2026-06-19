import { test, expect } from '@playwright/test';
import { signupNewUser, uniqueUsername } from './helpers';

test.describe('auth', () => {
	test('signup -> login -> logout', async ({ page }) => {
		const username = uniqueUsername();
		const password = 'test1234';

		// Signup
		await page.goto('/login');
		// hydration 待ち: enhance 装着前に click するとネイティブ submit で JSON が表示され navigation が
		// 止まる既知の flake（helpers.signupNewUser と同じガード）。
		await page.waitForLoadState('networkidle');
		const signupForm = page.locator('form[action="?/signup"]');
		await signupForm.locator('input[name="username"]').fill(username);
		await signupForm.locator('input[name="password"]').fill(password);
		await Promise.all([
			page.waitForURL('/'),
			signupForm.locator('button[type="submit"]').click()
		]);
		await expect(page.locator(`a[href="/user/${username}"]`)).toBeVisible();

		// Logout。data-sveltekit-reload でフル遷移し、ヘッダが即ログアウト表示に更新される
		// （SPA だと layout の cookie 読みが再実行されず「ログイン中」が残る回帰を防ぐ）。
		await Promise.all([page.waitForURL('/'), page.click('a[href="/logout"]')]);
		await expect(page.locator('a[href="/login"]')).toBeVisible();

		// Login again with the same credentials
		await page.goto('/login');
		await page.waitForLoadState('networkidle');
		const loginForm = page.locator('form[action="?/login"]');
		await loginForm.locator('input[name="username"]').fill(username);
		await loginForm.locator('input[name="password"]').fill(password);
		await Promise.all([
			page.waitForURL('/'),
			loginForm.locator('button[type="submit"]').click()
		]);
		await expect(page.locator(`a[href="/user/${username}"]`)).toBeVisible();
	});

	test('login with bad credentials shows error', async ({ page }) => {
		await signupNewUser(page); // ensures DB is alive
		await page.goto('/logout');

		await page.goto('/login');
		const loginForm = page.locator('form[action="?/login"]');
		await loginForm.locator('input[name="username"]').fill('definitely_not_a_user_xyz');
		await loginForm.locator('input[name="password"]').fill('wrongpass');
		await loginForm.locator('button[type="submit"]').click();
		await expect(page.locator('.form-error')).toContainText(/Bad login/i);
	});
});
