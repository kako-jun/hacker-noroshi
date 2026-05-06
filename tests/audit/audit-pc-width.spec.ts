import { test } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_DIR = path.join(__dirname, 'screenshots');

// 当方は本番 (https://hn.llll-ll.com) を叩く想定だが、本番が落ちている場合は
// AUDIT_OURS_URL=http://localhost:5173 で dev server に向けることもできる
const OURS_URL = process.env.AUDIT_OURS_URL ?? 'https://hn.llll-ll.com';

const SITES = [
	{ id: 'ours', baseURL: OURS_URL },
	{ id: 'hn', baseURL: 'https://news.ycombinator.com' }
] as const;

function ensureOut() {
	if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
}

test.beforeAll(() => {
	ensureOut();
});

for (const site of SITES) {
	test(`${site.id} /polls full page`, async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.goto(`${site.baseURL}/polls`, { waitUntil: 'networkidle' });
		await page.screenshot({
			path: path.join(OUT_DIR, `${site.id}-polls.png`),
			fullPage: true
		});
		const html = await page.content();
		fs.writeFileSync(path.join(OUT_DIR, `${site.id}-polls.html`), html);
	});

	test(`${site.id} /newest first story meta`, async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.goto(`${site.baseURL}/newest`, { waitUntil: 'networkidle' });

		// 本家HN は .athing + .subtext 構造、当方は .story-item + .story-meta 構造
		// 両方の場合に対応するため body から first story 周辺を抽出する
		const fullHtml = await page.content();
		fs.writeFileSync(path.join(OUT_DIR, `${site.id}-newest.html`), fullHtml);

		// 当方: .story-item の最初の .story-meta
		// 本家: .athing の直後の .subtext
		const metaHtml = await page.evaluate(() => {
			// 本家 HN 構造
			const subtext = document.querySelector('.subtext');
			if (subtext) {
				const athing = subtext.closest('tr')?.previousElementSibling as HTMLElement | null;
				return {
					kind: 'hn',
					athing: athing?.outerHTML ?? null,
					subtext: subtext.outerHTML
				};
			}
			// 当方 HN-noroshi 構造
			const item = document.querySelector('.story-item');
			if (item) {
				return {
					kind: 'ours',
					item: item.outerHTML,
					meta: item.querySelector('.story-meta')?.outerHTML ?? null
				};
			}
			return { kind: 'unknown' };
		});

		fs.writeFileSync(
			path.join(OUT_DIR, `${site.id}-newest-meta.json`),
			JSON.stringify(metaHtml, null, 2)
		);

		await page.screenshot({
			path: path.join(OUT_DIR, `${site.id}-newest.png`),
			fullPage: false
		});
	});
}
