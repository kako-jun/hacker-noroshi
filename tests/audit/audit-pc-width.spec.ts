import { test } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_DIR = path.join(__dirname, 'screenshots');

// 当方は本番 (https://hn.llll-ll.com) を叩く想定。
// AUDIT_OURS_URL=http://localhost:5173 で dev server に向けることもできる。
const OURS_URL = process.env.AUDIT_OURS_URL ?? 'https://hn.llll-ll.com';
const HN_BASE = 'https://news.ycombinator.com';

// PC 幅 1280×720 で本家 HN と並べて視覚パリティを検証する。
// 当方独自のパス (/admin/*, /ipban, /lists, /api-docs, /noprocrast, /search) は
// 本家に対応が無い、または挙動が大きく異なるため除外。DESIGN.md 準拠は別 Issue (#107) で監査済み。
const COMMON_PATHS = [
	'/',
	'/newest',
	'/ask',
	'/show',
	'/best',
	'/active',
	'/newcomments',
	'/front',
	'/asknew',
	'/shownew',
	'/showhn',
	'/bestcomments',
	'/highlights',
	'/noobstories',
	'/noobcomments',
	'/from',
	'/login'
];

const HN_ITEM_ID = 1;
const HN_USER = 'pg';
const OURS_ITEM_ID = process.env.AUDIT_OURS_ITEM_ID ?? '1';
const OURS_USER = process.env.AUDIT_OURS_USER ?? 'noroshi';

function ensureOut() {
	if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
}

function pathToFile(p: string): string {
	return p.replace(/^\//, '').replace(/[/?=&]/g, '_') || 'home';
}

test.beforeAll(() => {
	ensureOut();
});

const SITES = [
	{ id: 'ours', baseURL: OURS_URL },
	{ id: 'hn', baseURL: HN_BASE }
] as const;

for (const site of SITES) {
	for (const p of COMMON_PATHS) {
		test(`pc ${site.id} ${p}`, async ({ page }) => {
			await page.setViewportSize({ width: 1280, height: 720 });
			const res = await page.goto(`${site.baseURL}${p}`, { waitUntil: 'load' });
			const fileBase = `pc-${site.id}-${pathToFile(p)}`;
			await page.screenshot({
				path: path.join(OUT_DIR, `${fileBase}.png`),
				fullPage: true
			});
			const html = await page.content();
			fs.writeFileSync(path.join(OUT_DIR, `${fileBase}.html`), html);
			const metrics = await page.evaluate(() => ({
				scrollWidth: document.documentElement.scrollWidth,
				clientWidth: document.documentElement.clientWidth,
				bodyHeight: document.body.scrollHeight
			}));
			fs.writeFileSync(
				path.join(OUT_DIR, `${fileBase}.report.json`),
				JSON.stringify({ status: res?.status() ?? null, ...metrics }, null, 2)
			);
			console.log(
				`[pc ${site.id} ${p}] status=${res?.status()} sw=${metrics.scrollWidth} cw=${metrics.clientWidth}`
			);
		});
	}

	test(`pc ${site.id} /item`, async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 720 });
		const url =
			site.id === 'hn'
				? `${site.baseURL}/item?id=${HN_ITEM_ID}`
				: `${site.baseURL}/item/${OURS_ITEM_ID}`;
		await page.goto(url, { waitUntil: 'load' });
		const fileBase = `pc-${site.id}-item`;
		await page.screenshot({ path: path.join(OUT_DIR, `${fileBase}.png`), fullPage: true });
		fs.writeFileSync(path.join(OUT_DIR, `${fileBase}.html`), await page.content());
	});

	test(`pc ${site.id} /user`, async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 720 });
		const url =
			site.id === 'hn'
				? `${site.baseURL}/user?id=${HN_USER}`
				: `${site.baseURL}/user/${OURS_USER}`;
		await page.goto(url, { waitUntil: 'load' });
		const fileBase = `pc-${site.id}-user`;
		await page.screenshot({ path: path.join(OUT_DIR, `${fileBase}.png`), fullPage: true });
		fs.writeFileSync(path.join(OUT_DIR, `${fileBase}.html`), await page.content());
	});
}
