import { test, expect } from '@playwright/test';
import { signupNewUser, uniqueUsername } from './helpers';

/**
 * Issue #179 バッチB: signup バリデーションの実機確認。
 *
 * ロジック自体は tests/unit/signup.test.ts と tests/unit/username-change.test.ts の
 * validateUsernameFormat 側で固定済みなので、ここでは実ブラウザで /login の
 * signup フォームが .form-error に正しいメッセージを表示することだけを確認する。
 */
test.describe('signup validation', () => {
	test('既存ユーザー名で再 signup を試みると "That username is taken" が表示される', async ({
		page
	}) => {
		const existing = await signupNewUser(page);
		await page.goto('/logout').catch(() => {});
		await page.goto('/login');
		await page.waitForLoadState('networkidle');
		const signupForm = page.locator('form[action="?/signup"]');
		await signupForm.locator('input[name="username"]').fill(existing);
		await signupForm.locator('input[name="password"]').fill('test1234');
		await signupForm.locator('button[type="submit"]').click();
		await expect(page.locator('.form-error')).toContainText('That username is taken');
	});

	test('2文字ユーザー名で signup を試みると長さエラーが表示される', async ({ page }) => {
		await page.goto('/logout').catch(() => {});
		await page.goto('/login');
		await page.waitForLoadState('networkidle');
		const signupForm = page.locator('form[action="?/signup"]');
		await signupForm.locator('input[name="username"]').fill('ab');
		await signupForm.locator('input[name="password"]').fill('test1234');
		await signupForm.locator('button[type="submit"]').click();
		await expect(page.locator('.form-error')).toContainText('between 3 and 15');
	});

	test('記号入りユーザー名で signup を試みると文字種エラーが表示される', async ({ page }) => {
		await page.goto('/logout').catch(() => {});
		await page.goto('/login');
		await page.waitForLoadState('networkidle');
		const signupForm = page.locator('form[action="?/signup"]');
		await signupForm.locator('input[name="username"]').fill('bad!name');
		await signupForm.locator('input[name="password"]').fill('test1234');
		await signupForm.locator('button[type="submit"]').click();
		await expect(page.locator('.form-error')).toContainText('letters, numbers');
	});

	test('7文字パスワードで signup を試みると "Password must be at least 8 characters" が表示される（有効なユーザー名）', async ({
		page
	}) => {
		await page.goto('/logout').catch(() => {});
		await page.goto('/login');
		await page.waitForLoadState('networkidle');
		const signupForm = page.locator('form[action="?/signup"]');
		await signupForm.locator('input[name="username"]').fill(uniqueUsername());
		await signupForm.locator('input[name="password"]').fill('1234567');
		await signupForm.locator('button[type="submit"]').click();
		await expect(page.locator('.form-error')).toContainText(
			'Password must be at least 8 characters'
		);
	});
});
