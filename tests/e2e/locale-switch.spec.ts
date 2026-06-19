import { expect, test } from '@playwright/test';
import { signupNewUser, submitStory } from './helpers';

test.describe('locale switching', () => {
	test('switches header/footer labels to Japanese and persists by cookie', async ({ page }) => {
		await page.goto('/');

		await expect(page.locator('.hn-header-nav a', { hasText: /^new$/ })).toBeVisible();
		await page.locator('.hn-header-right a', { hasText: /^日本語$/ }).click();

		await expect(page).toHaveURL('/');
		await expect(page.locator('.hn-header-nav a', { hasText: /^新着$/ })).toBeVisible();
		await expect(page.locator('.hn-header-nav a', { hasText: /^作ったもの$/ })).toBeVisible();
		await expect(page.locator('.hn-header-right a', { hasText: /^English$/ })).toBeVisible();
		await expect(page.locator('.hn-footer-search')).toContainText('検索:');

		await page.reload();
		await expect(page.locator('.hn-header-nav a', { hasText: /^新着$/ })).toBeVisible();
	});

	test('renders login and submit controls in Japanese mode without changing routes', async ({
		page
	}) => {
		await page.goto('/locale?lang=ja&next=/login');

		await expect(page.locator('.hn-form b', { hasText: /^ログイン$/ })).toBeVisible();
		await expect(page.locator('form[action="?/login"] button[type="submit"]')).toHaveText(
			'ログイン'
		);
		await expect(page.locator('.hn-form b', { hasText: /^アカウント作成$/ })).toBeVisible();

		await signupNewUser(page);
		await page.goto('/submit');
		await expect(page.locator('.hn-form td', { hasText: /^タイトル$/ })).toBeVisible();
		await expect(page.locator('.hn-form td', { hasText: /^本文$/ })).toBeVisible();
		await expect(page.locator('.hn-form button[type="submit"]')).toHaveText('投稿');
		// #139 の操作補助注記（.form-note.assist-note）もフォーム内に出るため、URL 注記だけを狙う。
		await expect(page.locator('.form-note:not(.assist-note)').first()).toContainText('URLを空にすると');
	});

	test('renders story row action labels in Japanese mode', async ({ page }) => {
		await page.goto('/locale?lang=ja&next=/login');
		await signupNewUser(page);

		const title = `locale row ${Date.now()}`;
		await submitStory(page, { title, text: 'row labels' });
		await page.goto('/newest');

		const story = page
			.locator('.story-item')
			.filter({ has: page.locator('a.story-title', { hasText: title }) })
			.first();
		await expect(story.locator('.story-meta')).toContainText('点 投稿者');
		await expect(story.locator('.story-meta a', { hasText: /^非表示$/ })).toBeVisible();
		await expect(story.locator('.story-meta a', { hasText: /^議論する$/ })).toBeVisible();
	});
});
