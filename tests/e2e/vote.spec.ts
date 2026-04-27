import { test, expect } from '@playwright/test';
import { signupNewUser } from './helpers';

test('upvote a story toggles voted state', async ({ page }) => {
	// User A submits a story
	const titleA = `E2E Vote Story ${Date.now()}`;
	await signupNewUser(page);
	await page.goto('/submit');
	await page.fill('input[name="title"]', titleA);
	await page.fill('textarea[name="text"]', 'voting test body');
	await Promise.all([
		page.waitForURL((url) => !url.pathname.startsWith('/submit')),
		page.click('button[type="submit"]')
	]);

	// Logout, then User B logs in (cannot upvote own story)
	await page.goto('/logout');
	await signupNewUser(page);

	await page.goto('/newest');
	// Find the story-item containing our title and click its upvote button
	const item = page
		.locator('.story-item')
		.filter({ has: page.locator('a.story-title', { hasText: titleA }) })
		.first();
	await expect(item).toBeVisible();

	const upvote = item.locator('button.upvote');
	await expect(upvote).not.toHaveClass(/voted/);

	await upvote.click();
	await expect(upvote).toHaveClass(/voted/, { timeout: 5000 });
});
