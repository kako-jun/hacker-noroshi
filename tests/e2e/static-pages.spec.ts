import { test, expect } from '@playwright/test';

/**
 * Issue #122: 静的ページ・URL の 200 応答 + RSS の Content-Type 確認。
 *
 * 各ページが期待する MIME / 主要文言を含んでいるかだけを軽く検証する。
 * 内容の妥当性チェックではなく、ルートが落ちていないかの smoke テスト。
 */
test.describe('static pages', () => {
	test('/faq /guidelines /lists /api-docs return 200 and have content', async ({ page }) => {
		const paths = ['/faq', '/guidelines', '/lists', '/api-docs'];
		for (const p of paths) {
			const res = await page.goto(p);
			expect(res?.status(), `${p} should be 200`).toBe(200);
			const body = await page.locator('body').innerText();
			expect(body.trim().length, `${p} should have non-empty body`).toBeGreaterThan(20);
		}
	});

	test('/rss returns application/rss+xml with at least one <item>', async ({ request }) => {
		const res = await request.get('/rss');
		expect(res.status()).toBe(200);
		const contentType = res.headers()['content-type'] ?? '';
		expect(contentType).toContain('application/rss+xml');
		const body = await res.text();
		expect(body).toContain('<rss');
		expect(body).toContain('<item>');
	});

	test('/robots.txt returns 200', async ({ request }) => {
		const res = await request.get('/robots.txt');
		expect(res.status()).toBe(200);
		const body = await res.text();
		expect(body.length).toBeGreaterThan(0);
	});
});
