import { test, expect } from '@playwright/test';
import { signupNewUser, submitStory } from './helpers';

test('hide a story removes it from /newest and shows it on /user/[id]/hidden', async ({
	page
}) => {
	// User A submits a story. submitStory ヘルパは hydration 待ち込みで、ネイティブ submit による
	// JSON 表示で navigation が止まる既知の flake を避ける（インライン submit はそれが無く稀に落ちた）。
	const titleA = `E2E Hide Story ${Date.now()}`;
	await signupNewUser(page);
	await submitStory(page, { title: titleA, text: 'hide test body' });

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
	await expect(
		page
			.locator('.story-item')
			.filter({ has: page.locator('a.story-title', { hasText: titleA }) })
	).toHaveCount(0, { timeout: 5000 });

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
