import { test, expect } from '@playwright/test';
import { signupNewUser, submitStory } from './helpers';

/**
 * user の submissions / favorites ページは共通ラッパ StoryList に集約した（#151）。
 * 移行の主眼は「canonical row 化」＝以前は無かった hide リンク等の標準サブテキストが付くこと。
 */
test.describe('user listing pages via StoryList', () => {
	test('submissions が StoryList で描画され、canonical row（hide リンク）になる', async ({ page }) => {
		const title = `E2E Submissions ${Date.now()}`;
		const username = await signupNewUser(page);
		await submitStory(page, { title, text: 'submissions storylist body' });

		await page.goto(`/user/${username}/submissions`);
		const item = page
			.locator('.story-item')
			.filter({ has: page.locator('a.story-title', { hasText: title }) });
		await expect(item).toBeVisible();
		// rank 番号が出る（StoryList の rankStart 由来）。
		await expect(item.locator('.story-rank')).toHaveText('1.');
		// 移行前は hide リンクが無かった。canonical row になり hide が出る（StoryListItem 由来）。
		await expect(item.locator('.story-meta a', { hasText: 'hide' })).toBeVisible();
	});

	test('submissions で hide すると行が即座に消える（StoryList の onhide）', async ({ page }) => {
		const title = `E2E SubHide ${Date.now()}`;
		const username = await signupNewUser(page);
		await submitStory(page, { title, text: 'sub hide body' });

		await page.goto(`/user/${username}/submissions`);
		const item = page
			.locator('.story-item')
			.filter({ has: page.locator('a.story-title', { hasText: title }) });
		await expect(item).toBeVisible();
		await item.locator('.story-meta a', { hasText: 'hide' }).click();
		await expect(
			page.locator('.story-item').filter({ has: page.locator('a.story-title', { hasText: title }) })
		).toHaveCount(0, { timeout: 5000 });
	});
});
