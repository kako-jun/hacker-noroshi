import { test, expect } from '@playwright/test';

/**
 * Issue #122: コメント [–] トグル + root / parent / next リンク。
 *
 * seed (db/seed.sql) の story id=8 (BBS) は 5 段ネストのコメントツリーを持つ:
 *   id 15 (root) → 16 → 17 → 18 → 19
 *
 * /item/8 を開いて以下を確認する:
 *  - root の [–] click で子孫が DOM/表示から消える
 *  - 再 click で復活する
 *  - 子コメントから root リンクが #item-{rootId} を指す
 *  - parent / next リンクのアンカー先が DOM 内に存在する
 */
test.describe('comment toggle / root / parent / next', () => {
	test('root の [–] で子孫が消え、再 click で復活する', async ({ page }) => {
		await page.goto('/item/8');
		await page.waitForLoadState('networkidle');
		// 子コメント (id 16, 17, 18, 19) はそれぞれ #item-{id}
		const childIds = [16, 17, 18, 19];
		for (const id of childIds) {
			await expect(page.locator(`#item-${id}`)).toBeVisible();
		}
		// root (id 15) の [–] リンク
		const rootRow = page.locator('#item-15');
		await rootRow.locator('.comment-toggle a').click();
		// 子孫は DOM から消える（{#if !isHidden(child)} で除外される）
		for (const id of childIds) {
			await expect(page.locator(`#item-${id}`)).toHaveCount(0);
		}
		// 再 click で復活
		await rootRow.locator('.comment-toggle a').click();
		for (const id of childIds) {
			await expect(page.locator(`#item-${id}`)).toBeVisible();
		}
	});

	test('child の root / parent / next リンクが想定の anchor を指す', async ({ page }) => {
		await page.goto('/item/8');
		await page.waitForLoadState('networkidle');
		// id 17 は parent_id=16 (id 16 の child)。root は 15。
		const row17 = page.locator('#item-17');
		// root リンク
		const rootHref = await row17.locator('a:has-text("root")').first().getAttribute('href');
		expect(rootHref).toBe('#item-15');
		// parent リンク
		const parentHref = await row17
			.locator('a:has-text("parent")')
			.first()
			.getAttribute('href');
		expect(parentHref).toBe('#item-16');
		// next リンク（DFS 順で id 17 の次は 18）
		const nextHref = await row17.locator('a:has-text("next")').first().getAttribute('href');
		expect(nextHref).toBe('#item-18');
	});
});
