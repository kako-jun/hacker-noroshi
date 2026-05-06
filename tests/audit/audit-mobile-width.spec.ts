import { test } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_DIR = path.join(__dirname, 'screenshots');

// 当方は本番 (https://hn.llll-ll.com)。AUDIT_OURS_URL で上書き可。
const OURS_URL = process.env.AUDIT_OURS_URL ?? 'https://hn.llll-ll.com';

const SITES = [
	{ id: 'ours', baseURL: OURS_URL },
	{ id: 'hn', baseURL: 'https://news.ycombinator.com' }
] as const;

// iPhone 相当
const VIEWPORT = { width: 375, height: 812 };

// 主要ページ。/submit /signup は未認証で /login にリダイレクトされるため /login に集約。
// /item /user は site ごとに有効な ID が必要なので別 test で扱う。
const PATHS = [
	'/',
	'/newest',
	'/ask',
	'/show',
	'/best',
	'/active',
	'/newcomments',
	'/lists',
	'/front',
	'/guidelines',
	'/faq',
	'/login'
] as const;

type OverflowReport = {
	site: string;
	path: string;
	viewport: { width: number; height: number };
	scrollWidth: number;
	clientWidth: number;
	overflow: boolean;
	offenders: Array<{
		tag: string;
		id: string;
		cls: string;
		right: number;
		scrollWidth: number;
		text: string;
	}>;
};

function ensureOut() {
	if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
}

function safePathSeg(p: string): string {
	if (p === '/') return 'root';
	return p.replace(/^\//, '').replace(/\//g, '_');
}

test.beforeAll(() => {
	ensureOut();
});

for (const site of SITES) {
	for (const p of PATHS) {
		test(`mobile ${site.id} ${p}`, async ({ page }) => {
			await page.setViewportSize(VIEWPORT);
			const url = `${site.baseURL}${p}`;
			const resp = await page.goto(url, { waitUntil: 'load' });
			// 200/302 以外は検出だけして続行する
			const status = resp?.status() ?? 0;

			// 水平オーバーフロー判定 + 原因要素
			const result = await page.evaluate((vw) => {
				const html = document.documentElement;
				const body = document.body;
				const scrollWidth = Math.max(html.scrollWidth, body.scrollWidth);
				const clientWidth = html.clientWidth;
				const overflow = scrollWidth > clientWidth + 1;

				const offenders: Array<{
					tag: string;
					id: string;
					cls: string;
					right: number;
					scrollWidth: number;
					text: string;
				}> = [];

				if (overflow) {
					const all = document.querySelectorAll<HTMLElement>('*');
					for (const el of Array.from(all)) {
						const rect = el.getBoundingClientRect();
						const right = rect.right;
						const sw = el.scrollWidth;
						if (right > vw + 1 || (sw > vw && rect.width >= vw)) {
							// 親が既に offender ならスキップ（最深部に絞る）
							let parentOffending = false;
							let parent = el.parentElement;
							while (parent) {
								const pr = parent.getBoundingClientRect();
								if (pr.right > vw + 1 && pr.width <= rect.width + 1) {
									// 親も同じくらい広いなら親側に責任がある可能性 → スキップ判定はしない
									break;
								}
								parent = parent.parentElement;
							}
							if (parentOffending) continue;

							offenders.push({
								tag: el.tagName.toLowerCase(),
								id: el.id || '',
								cls: typeof el.className === 'string' ? el.className.slice(0, 120) : '',
								right: Math.round(right),
								scrollWidth: sw,
								text: (el.textContent ?? '').replace(/\s+/g, ' ').slice(0, 80)
							});
						}
					}
				}

				return { scrollWidth, clientWidth, overflow, offenders: offenders.slice(0, 20) };
			}, VIEWPORT.width);

			const report: OverflowReport = {
				site: site.id,
				path: p,
				viewport: VIEWPORT,
				scrollWidth: result.scrollWidth,
				clientWidth: result.clientWidth,
				overflow: result.overflow,
				offenders: result.offenders
			};

			const seg = safePathSeg(p);
			const stem = `mobile-${site.id}-${seg}`;

			fs.writeFileSync(
				path.join(OUT_DIR, `${stem}.report.json`),
				JSON.stringify({ status, ...report }, null, 2)
			);

			await page.screenshot({
				path: path.join(OUT_DIR, `${stem}.png`),
				fullPage: true
			});

			const html = await page.content();
			fs.writeFileSync(path.join(OUT_DIR, `${stem}.html`), html);

			// 結果を stdout にも出す（集計しやすさのため）
			console.log(
				`[${site.id} ${p}] status=${status} sw=${result.scrollWidth} cw=${result.clientWidth} overflow=${result.overflow} offenders=${result.offenders.length}`
			);
		});
	}
}

// /item/[id] と /user/[id] は site ごとに別の ID を使う
const ITEM_USER_TARGETS = [
	{ site: 'ours', baseURL: OURS_URL, item: 1, user: 'noroshi' },
	{ site: 'hn', baseURL: 'https://news.ycombinator.com', item: 1, user: 'pg' }
] as const;

for (const t of ITEM_USER_TARGETS) {
	for (const sub of [`/item?id=${t.item}`, `/user?id=${t.user}`] as const) {
		// 当方は /item/[id] と /user/[id] のフォーマット。本家は ?id= フォーマット。
		// 当方のときだけパスパターンを切り替える
		const ourPath =
			t.site === 'ours'
				? sub.startsWith('/item')
					? `/item/${t.item}`
					: `/user/${t.user}`
				: sub;
		test(`mobile ${t.site} ${ourPath}`, async ({ page }) => {
			await page.setViewportSize(VIEWPORT);
			const url = `${t.baseURL}${ourPath}`;
			const resp = await page.goto(url, { waitUntil: 'load' });
			const status = resp?.status() ?? 0;

			const result = await page.evaluate((vw) => {
				const html = document.documentElement;
				const body = document.body;
				const scrollWidth = Math.max(html.scrollWidth, body.scrollWidth);
				const clientWidth = html.clientWidth;
				const overflow = scrollWidth > clientWidth + 1;
				const offenders: Array<{
					tag: string;
					id: string;
					cls: string;
					right: number;
					scrollWidth: number;
					text: string;
				}> = [];
				if (overflow) {
					const all = document.querySelectorAll<HTMLElement>('*');
					for (const el of Array.from(all)) {
						const rect = el.getBoundingClientRect();
						if (rect.right > vw + 1 || (el.scrollWidth > vw && rect.width >= vw)) {
							offenders.push({
								tag: el.tagName.toLowerCase(),
								id: el.id || '',
								cls:
									typeof el.className === 'string' ? el.className.slice(0, 120) : '',
								right: Math.round(rect.right),
								scrollWidth: el.scrollWidth,
								text: (el.textContent ?? '').replace(/\s+/g, ' ').slice(0, 80)
							});
						}
					}
				}
				return { scrollWidth, clientWidth, overflow, offenders: offenders.slice(0, 20) };
			}, VIEWPORT.width);

			const seg = safePathSeg(ourPath).replace(/\?/g, '_').replace(/=/g, '_');
			const stem = `mobile-${t.site}-${seg}`;
			fs.writeFileSync(
				path.join(OUT_DIR, `${stem}.report.json`),
				JSON.stringify({ status, site: t.site, path: ourPath, ...result }, null, 2)
			);
			await page.screenshot({
				path: path.join(OUT_DIR, `${stem}.png`),
				fullPage: true
			});
			const html = await page.content();
			fs.writeFileSync(path.join(OUT_DIR, `${stem}.html`), html);
			console.log(
				`[${t.site} ${ourPath}] status=${status} sw=${result.scrollWidth} cw=${result.clientWidth} overflow=${result.overflow} offenders=${result.offenders.length}`
			);
		});
	}
}
