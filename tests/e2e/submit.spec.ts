import { test, expect } from '@playwright/test';
import { signupNewUser } from './helpers';

test('submit a text story and see it on the front/newest page', async ({ page }) => {
	await signupNewUser(page);

	const title = `E2E Test Story ${Date.now()}`;
	const text = 'This is an end-to-end test post body.';

	await page.goto('/submit');
	await page.fill('input[name="title"]', title);
	await page.fill('textarea[name="text"]', text);
	await Promise.all([
		page.waitForURL((url) => !url.pathname.startsWith('/submit')),
		page.click('button[type="submit"]')
	]);

	// /newest should list our brand-new story
	await page.goto('/newest');
	const titleLink = page.locator('a.story-title', { hasText: title }).first();
	await expect(titleLink).toBeVisible();

	// Click through to the item detail page
	await Promise.all([page.waitForURL(/\/item\/\d+/), titleLink.click()]);
	await expect(page.locator('body')).toContainText(title);
});
