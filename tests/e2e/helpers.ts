import type { Page } from '@playwright/test';

/**
 * Generate a unique-ish username (3-15 chars, alnum/underscore/hyphen).
 */
export function uniqueUsername(prefix = 'e2e'): string {
	const suffix = Math.random().toString(36).slice(2, 8);
	const name = `${prefix}_${suffix}`.slice(0, 15);
	return name;
}

/**
 * Sign up a fresh user via the /login page's "Create Account" form
 * and return their username. Leaves the browser logged in.
 */
export async function signupNewUser(page: Page, password = 'test1234'): Promise<string> {
	const username = uniqueUsername();
	await page.goto('/login');
	const signupForm = page.locator('form[action="?/signup"]');
	await signupForm.locator('input[name="username"]').fill(username);
	await signupForm.locator('input[name="password"]').fill(password);
	await Promise.all([
		page.waitForURL('/'),
		signupForm.locator('button[type="submit"]').click()
	]);
	return username;
}
