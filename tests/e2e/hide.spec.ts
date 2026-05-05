import { test, expect } from '@playwright/test';
import { signupNewUser } from './helpers';

test('hide a story removes it from /newest and shows it on /user/[id]/hidden', async ({
	page
}) => {
	// User A submits a story.
	// Note: page.fill 経由で Svelte 5 の <input value={...}> に書き込むと
	// 値が確定しない既知の挙動があるため、click + keyboard.type を使う。
	const titleA = `E2E Hide Story ${Date.now()}`;
	await signupNewUser(page);
	await page.goto('/submit');
	await page.locator('input[name="title"]').click();
	await page.keyboard.type(titleA);
	await page.locator('textarea[name="text"]').click();
	await page.keyboard.type('hide test body');
	await Promise.all([
		page.waitForURL((url) => !url.pathname.startsWith('/submit')),
		page.click('button[type="submit"]')
	]);

	// Logout, then User B signs up
	await page.goto('/logout');
	const userB = await signupNewUser(page);

	// User B opens /newest and finds the story
	await page.goto('/newest');
	const item = page
		.locator('.story-item')
		.filter({ has: page.locator('a.story-title', { hasText: titleA }) })
		.first();
	await expect(item).toBeVisible();

	// Click the hide link inside the meta row
	await item.locator('.story-meta a', { hasText: 'hide' }).click();

	// Row disappears from the rendered list (client-side hide via localHiddenIds)
	await expect(item).toHaveCount(0, { timeout: 5000 });

	// After reload, server-side filter via getHiddenStoryIds keeps it hidden
	await page.reload();
	await expect(
		page
			.locator('.story-item')
			.filter({ has: page.locator('a.story-title', { hasText: titleA }) })
	).toHaveCount(0);

	// /user/{userB}/hidden lists the hidden story
	await page.goto(`/user/${userB}/hidden`);
	await expect(
		page
			.locator('.story-item')
			.filter({ has: page.locator('a.story-title', { hasText: titleA }) })
			.first()
	).toBeVisible();
});
