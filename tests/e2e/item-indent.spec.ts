import { test, expect } from '@playwright/test';

/**
 * Issue #130: クリック後の動的状態（reply/edit form 等）のインデント整合性監査
 *
 * 本家 HN の階段パターンに準拠することを最優先で守る:
 *   タイトル本体 / ストーリー本文 / トップレベルコメント本文 が
 *   横方向で同じ x にきっちり揃う（HN だと ~128-131px、ここでは 154px）。
 *
 * 修正前は `.comment-text` だけ padding-left:0 で、ask 本文より 18px 左に
 * 出っ張って kako-jun から「返信が左に寄っている」と指摘された。
 */
test.describe('Issue #130: /item/[id] テキストのインデント整合性', () => {
	test('Mode B: ask タイトル / 本文 / トップレベルコメント本文 が同じ x に揃う', async ({ page }) => {
		await page.goto('/item/10'); // seed: Ask HN: 30代エンジニアのキャリアパス（id=10、複数コメントあり）

		const titleX = await page.locator('.item-title a, .item-title').first().evaluate(
			(el) => Math.round(el.getBoundingClientRect().x)
		);
		const itemTextX = await page.locator('.item-text p').first().evaluate(
			(el) => Math.round(el.getBoundingClientRect().x)
		);
		const commentTextX = await page.locator('.comment-text p').first().evaluate(
			(el) => Math.round(el.getBoundingClientRect().x)
		);

		// 本家 HN は title text ≒ comment text ≒ item-text。±2px までは許容。
		expect(Math.abs(itemTextX - titleX)).toBeLessThanOrEqual(2);
		expect(Math.abs(commentTextX - titleX)).toBeLessThanOrEqual(2);
	});

	test('Mode A: コメント直リンクでもタイトル / コメント本文 が同じ x に揃う', async ({ page }) => {
		await page.goto('/item/24'); // seed: コメント id=24（story id=2 の最初のトップレベル）

		const titleA = page.locator('.item-title a, .item-title').first();
		// item-title はコメント直リンク表示でも親ストーリーへのリンクとして表示される想定
		const titleX = await titleA.evaluate((el) => Math.round(el.getBoundingClientRect().x));
		const commentTextX = await page.locator('.comment-text p').first().evaluate(
			(el) => Math.round(el.getBoundingClientRect().x)
		);

		expect(Math.abs(commentTextX - titleX)).toBeLessThanOrEqual(2);
	});

	test('comment-text の padding-left は 18px（ask 本文と同じ階段段数）', async ({ page }) => {
		await page.goto('/item/10');
		const commentTextPad = await page.locator('.comment-text').first().evaluate(
			(el) => getComputedStyle(el).paddingLeft
		);
		expect(commentTextPad).toBe('18px');
	});
});
