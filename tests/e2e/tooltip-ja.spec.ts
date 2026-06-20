import { test, expect } from '@playwright/test';
import { signupNewUser, submitStory, findStoryIdByTitle, postComment } from './helpers';

/**
 * Issue #133: 英語のままのメニュー・アクションリンクにホバーで日本語訳ツールチップを表示。
 *
 * テキスト本体は英語のまま、`title` 属性で日本語訳を hover 表示する仕様。
 * ここでは header nav / footer / item ページのアクションリンクの 3 ケースだけ
 * 抜き取って `title` 属性が辞書通りに付与されているかを確認する。
 *
 * 動的 label (time-ago / "5 comments" 等の plural / 数値混合) は本 PR の対象外。
 */
test.describe('English label tooltip (title attribute)', () => {
	test('header nav の "new" リンクに title="新着" が付く', async ({ page }) => {
		await page.goto('/');
		const newLink = page.locator('.hn-header-nav a', { hasText: /^new$/ });
		await expect(newLink).toHaveAttribute('title', '新着');
	});

	test('footer の "API" リンクに公開 API のドキュメントの title が付く', async ({ page }) => {
		await page.goto('/');
		const apiLink = page.locator('.hn-footer a', { hasText: /^API$/ });
		await expect(apiLink).toHaveAttribute('title', '公開 API のドキュメント');
	});

	test('footer の "Security" リンクが GitHub security を指し、脆弱性報告先の title が付く（#159）', async ({
		page
	}) => {
		await page.goto('/');
		const securityLink = page.locator('.hn-footer a', { hasText: /^Security$/ });
		await expect(securityLink).toHaveAttribute(
			'href',
			'https://github.com/kako-jun/hacker-noroshi/security'
		);
		await expect(securityLink).toHaveAttribute('title', 'セキュリティ・脆弱性の報告先');
	});

	test('/item/{id} で add comment ボタンに日本語 title が付く', async ({ page }) => {
		// signup → submitStory で確実に「自分が著者の story」を用意し、
		// /item/<id> を開いて add comment ボタンの title を検証する。
		// seed user の login は環境差で flake るため avoid。
		await signupNewUser(page);
		const title = `tooltip add-cmt ${Date.now()}`;
		await submitStory(page, { title, text: 'tooltip story' });
		await page.goto('/newest');
		const id = await findStoryIdByTitle(page, title);
		await page.goto(`/item/${id}`);
		await page.waitForSelector('form[action="?/comment"]', { state: 'visible', timeout: 10_000 });

		const addCommentBtn = page.locator('form[action="?/comment"] button[type="submit"]', {
			hasText: /^add comment$/
		});
		await expect(addCommentBtn).toHaveAttribute('title', 'コメントを追加');
	});

	test('/login のフォーム送信ボタンに日本語 title が付く', async ({ page }) => {
		await page.goto('/login');
		const loginBtn = page.locator('form[action="?/login"] button[type="submit"]');
		await expect(loginBtn).toHaveAttribute('title', 'ログイン');
		const signupBtn = page.locator('form[action="?/signup"] button[type="submit"]');
		await expect(signupBtn).toHaveAttribute('title', 'アカウント作成');
	});

	test('/item/{id} のコメントツリー edit form (update / cancel) にも title が付く（must-1 回帰防止）', async ({
		page
	}) => {
		// signup → submitStory → コメント投稿 → edit クリックで update/cancel ボタンを開いて検証。
		await signupNewUser(page);
		const title = `tooltip edit ${Date.now()}`;
		await submitStory(page, { title, text: 'tooltip body' });
		await page.goto('/newest');
		const id = await findStoryIdByTitle(page, title);
		await page.goto(`/item/${id}`);
		await page.waitForSelector('form[action="?/comment"]', { state: 'visible', timeout: 10_000 });
		await postComment(page, 'tooltip cmt');
		await page.waitForSelector('.comment-text', { state: 'visible', timeout: 15_000 });

		await page.locator('.comment-item .comment-reply a:has-text("edit")').first().click();
		const updateBtn = page
			.locator('.comment-item button[type="submit"]', { hasText: /^update$/ })
			.first();
		await expect(updateBtn).toHaveAttribute('title', '更新');
		const cancelLink = page.locator('.comment-item a[href="#cancel"]').first();
		await expect(cancelLink).toHaveAttribute('title', 'キャンセル');
	});
});
