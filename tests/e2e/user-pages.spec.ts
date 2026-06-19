import { test, expect } from '@playwright/test';
import { signupNewUser, submitStory } from './helpers';

/**
 * user の submissions / favorites ページは共通ラッパ StoryList に集約した（#151）。
 * 移行の主眼は「canonical row 化」＝以前は無かった hide リンク等の標準サブテキストが付くこと。
 * hide リンクは `a[href="#hide"]` で掴む（テキストはロケールで hide/非表示 と変わるため・#152 レビュー）。
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
		await expect(item.locator('.story-meta a[href="#hide"]')).toBeVisible();
	});

	test('submissions で hide した行はリロードを跨いで消えたままになる（StoryList onhide + サーバー除外）', async ({
		page
	}) => {
		const title = `E2E SubHide ${Date.now()}`;
		const username = await signupNewUser(page);
		await submitStory(page, { title, text: 'sub hide body' });

		await page.goto(`/user/${username}/submissions`);
		const row = () =>
			page.locator('.story-item').filter({ has: page.locator('a.story-title', { hasText: title }) });
		await expect(row()).toBeVisible();

		// クライアント楽観削除。
		await row().locator('.story-meta a[href="#hide"]').click();
		await expect(row()).toHaveCount(0, { timeout: 5000 });

		// リロード後もサーバー側で除外され、復活しないこと（#152 で修正したバグの回帰防止）。
		await page.reload();
		await expect(row()).toHaveCount(0);
	});

	test('/hidden も StoryList（unhide モード）で描画され、un-hide で行が消え復活しない', async ({
		page
	}) => {
		const title = `E2E Unhide ${Date.now()}`;
		const username = await signupNewUser(page);
		await submitStory(page, { title, text: 'unhide body' });

		// /newest で hide → /hidden に出る。
		await page.goto('/newest');
		const newestRow = page
			.locator('.story-item')
			.filter({ has: page.locator('a.story-title', { hasText: title }) });
		await expect(newestRow).toBeVisible();
		await newestRow.locator('.story-meta a[href="#hide"]').click();
		await expect(newestRow).toHaveCount(0, { timeout: 5000 });

		await page.goto(`/user/${username}/hidden`);
		const row = () =>
			page.locator('.story-item').filter({ has: page.locator('a.story-title', { hasText: title }) });
		await expect(row()).toBeVisible();
		// canonical row の un-hide リンク（StoryList unhide モード由来）。
		await row().locator('.story-meta a[href="#unhide"]').click();
		await expect(row()).toHaveCount(0, { timeout: 5000 });
		// un-hide したのでリロードしても /hidden には戻らない。
		await page.reload();
		await expect(row()).toHaveCount(0);
	});
});
