import { test, expect } from '@playwright/test';
import { signupNewUser, uniqueUsername } from './helpers';

test.describe('auth', () => {
	test('signup -> login -> logout', async ({ page }) => {
		const username = uniqueUsername();
		const password = 'test1234';

		// Signup
		await page.goto('/login');
		const signupForm = page.locator('form[action="?/signup"]');
		await signupForm.locator('input[name="username"]').fill(username);
		await signupForm.locator('input[name="password"]').fill(password);
		await Promise.all([
			page.waitForURL('/'),
			signupForm.locator('button[type="submit"]').click()
		]);
		await expect(page.locator(`a[href="/user/${username}"]`)).toBeVisible();

		// Logout
		await page.click('a[href="/logout"]');
		await expect(page.locator('a[href="/login"]')).toBeVisible();

		// Login again with the same credentials
		await page.goto('/login');
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
