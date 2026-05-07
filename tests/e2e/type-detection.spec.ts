import { test, expect } from '@playwright/test';
import { signupNewUser, runD1 } from './helpers';

/**
 * Issue #122: タイトル先頭による story type 判定 + 編集再判定 + poll の type 固定。
 *
 * - submit action: `Ask HN:` / `Show HN:` 先頭で type=ask / show
 * - editStory action: 同様の判定。ただし `story.type === 'poll'` のときは
 *   タイトルを書き換えても type='poll' を維持する（poll_options 参照を守るため）
 *
 * 注: seed user の login は #125 で実質失敗するので、毎テスト signupNewUser で
 * 新規ユーザーを作る。投稿レート制限（10 分）は新規ユーザーには関係ないため
 * 1 ユーザー 1 投稿の縛りを守れば問題ない。poll 編集テストは新規ユーザーが
 * poll を作る手段が無いので skip する。
 */
test.describe('story type detection', () => {
	test('Ask HN: prefix → type=ask, /ask に出る', async ({ page }) => {
		await signupNewUser(page);
		const title = `Ask HN: ${Date.now()} type 判定テスト`;
		await page.goto('/submit');
		await page.waitForLoadState('networkidle');
		await page.fill('input[name="title"]', title);
		await page.fill('textarea[name="text"]', 'ask body');
		await Promise.all([
			page.waitForURL(/\/item\/\d+/, { timeout: 15_000 }),
			page.click('button[type="submit"]')
		]);

		await page.goto('/ask');
		await expect(
			page
				.locator('.story-item')
				.filter({ has: page.locator('a.story-title', { hasText: title }) })
		).toHaveCount(1);
	});

	test('Show HN: prefix → type=show, /show に出る', async ({ page }) => {
		await signupNewUser(page);
		const title = `Show HN: ${Date.now()} type 判定テスト`;
		await page.goto('/submit');
		await page.waitForLoadState('networkidle');
		await page.fill('input[name="title"]', title);
		await page.fill('input[name="url"]', 'https://example.com/show');
		await Promise.all([
			page.waitForURL(/\/item\/\d+/, { timeout: 15_000 }),
			page.click('button[type="submit"]')
		]);

		await page.goto('/show');
		await expect(
			page
				.locator('.story-item')
				.filter({ has: page.locator('a.story-title', { hasText: title }) })
		).toHaveCount(1);
	});

	test('編集で先頭を Ask HN: に変えると type が再判定される', async ({ page }) => {
		await signupNewUser(page);
		const orig = `Plain story ${Date.now()}`;
		await page.goto('/submit');
		await page.waitForLoadState('networkidle');
		await page.fill('input[name="title"]', orig);
		await page.fill('textarea[name="text"]', 'plain body');
		await Promise.all([
			page.waitForURL(/\/item\/\d+/, { timeout: 15_000 }),
			page.click('button[type="submit"]')
		]);
		const itemUrl = page.url();

		// /ask には載らないことを確認
		await page.goto('/ask');
		await expect(
			page
				.locator('.story-item')
				.filter({ has: page.locator('a.story-title', { hasText: orig }) })
		).toHaveCount(0);

		// 編集画面で title を Ask HN: 〜 に変更
		await page.goto(itemUrl);
		await page.click('a:has-text("edit")');
		const newTitle = `Ask HN: ${orig} updated`;
		await page.fill('input[name="title"]', newTitle);
		await Promise.all([
			page.waitForResponse((r) => r.url().includes('?/editStory'), { timeout: 10_000 }),
			page.click('button:has-text("update")')
		]);
		// 編集成功後 /ask に出る
		await page.goto('/ask');
		await expect(
			page
				.locator('.story-item')
				.filter({ has: page.locator('a.story-title', { hasText: newTitle }) })
		).toHaveCount(1);
	});

	// SKIP: poll 投稿は本家 HN 互換で UI から行えない（newpoll/+page.svelte は admin など限定）。
	// signupNewUser ではない seed の noroshi で /item/45 (poll) を編集するべきだが、
	// #125 で seed user login が失敗するため admin としても poll を編集できない。
	// 回避策: D1 直接 UPDATE で title を書き換えて、type が `poll` のまま維持されるか
	// SELECT で確認するというパターンも可能だが、それは E2E (UI 経由) ではない。
	// 修正は #125 解決後に loginAs(noroshi) 経由で再有効化する。
	test.skip('poll の編集ではタイトルを Ask HN: に変えても type=poll が維持される', async () => {
		// BUG #125: seed user (noroshi) の login が password mismatch で失敗するため、
		// poll story (id=45) の編集 UI に到達できず E2E では検証不能。
		// #125 解決後に再有効化すること。
	});
});
