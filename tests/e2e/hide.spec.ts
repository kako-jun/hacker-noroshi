import { test, expect } from '@playwright/test';
import { signupNewUser, submitStory, findStoryIdByTitle } from './helpers';

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

test('item page hide link toggles hide ⇄ un-hide and persists across reload', async ({
	page
}) => {
	// #155 のフォロー: /item/[id] 詳細ページの hide↔un-hide トグルを踏む唯一の e2e。
	// リファクタ #155 で toggleHideStory() に in-flight ガードを足した経路（item 側）が
	// 他の e2e ではカバーされていなかったため、ここで通す。
	// item ページは単体表示なので hide しても行は消えず、リンクテキストが入れ替わるのが観測点。
	const title = `E2E Item Hide ${Date.now()}`;

	// User A が投稿
	await signupNewUser(page);
	await submitStory(page, { title, text: 'item hide test body' });

	// logout して User B でログイン（他人の story を hide する想定）
	await page.goto('/logout');
	await signupNewUser(page);

	// User B が /newest から story id を引いて /item/{id} を開く
	await page.goto('/newest');
	const id = await findStoryIdByTitle(page, title);
	await page.goto(`/item/${id}`);

	// メタ行の hide リンクは story モードの .item-meta 内に1つだけ（href="#hide"）。
	// コメントの操作リンクは #reply/#edit/#flag/#toggle で #hide は使わないため一意。
	const hideLink = page.locator('a[href="#hide"]');
	await expect(hideLink).toHaveText('hide');

	// クリックで toggle → hidden=true、テキストが un-hide に反転
	await hideLink.click();
	await expect(hideLink).toHaveText('un-hide', { timeout: 5000 });

	// リロードを跨いで hidden 状態が保持される（サーバが storyHidden=true を返す）
	await page.reload();
	const hideLinkAfterReload = page.locator('a[href="#hide"]');
	await expect(hideLinkAfterReload).toHaveText('un-hide');

	// もう一度クリックで un-hide → hidden=false に戻り、テキストが hide に反転
	await hideLinkAfterReload.click();
	await expect(hideLinkAfterReload).toHaveText('hide', { timeout: 5000 });
});
