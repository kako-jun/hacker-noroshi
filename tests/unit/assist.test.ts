import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, sep } from 'node:path';
import {
	assistAboutLabel,
	assistAboutUrl,
	assistHint,
	assistIntro,
	assistSwitchLabel
} from '../../src/lib/assist';

/**
 * fs で src/routes を走査し、`+page.svelte` を持つディレクトリから SvelteKit の route id を導出する。
 * 例: src/routes/+page.svelte → '/'、src/routes/user/[id]/favorites/+page.svelte → '/user/[id]/favorites'。
 * 動的セグメント（[id] 等）はそのまま維持。グループルート（(...)）があればパスから除去する。
 * このリポには現状グループルートは無いが、将来追加されても route id が正しく導出されるよう対応する。
 */
function discoverRouteIds(): string[] {
	const routesRoot = fileURLToPath(new URL('../../src/routes', import.meta.url));
	const ids = new Set<string>();

	function walk(dir: string): void {
		const entries = readdirSync(dir, { withFileTypes: true });
		if (entries.some((e) => e.isFile() && e.name === '+page.svelte')) {
			const rel = relative(routesRoot, dir);
			const segments = rel
				.split(sep)
				.filter((s) => s.length > 0)
				// グループルート (foo) は route id に現れないので除去する。
				.filter((s) => !(s.startsWith('(') && s.endsWith(')')));
			ids.add(segments.length === 0 ? '/' : '/' + segments.join('/'));
		}
		for (const e of entries) {
			if (e.isDirectory()) walk(join(dir, e.name));
		}
	}

	walk(routesRoot);
	return [...ids].sort();
}

/**
 * #160: アシストトグル横の常設インフォ ⓘ リンク。
 * assistAboutUrl / assistAboutLabel はロケール別の純関数なので単体で固定できる。
 * URL は ja のみ `/ja/` prefix を付け、それ以外（en）は prefix 無しへ fallthrough する。
 */
describe('assistAboutUrl', () => {
	it("'ja' は /ja/posts/hacker-noroshi/ を含む ja URL を返す", () => {
		const url = assistAboutUrl('ja');
		expect(url).toBe('https://llll-ll.com/ja/posts/hacker-noroshi/');
		expect(url).toContain('/ja/posts/hacker-noroshi/');
	});

	it("'en' は ja prefix 無しの /posts/hacker-noroshi/ を返す", () => {
		const url = assistAboutUrl('en');
		expect(url).toBe('https://llll-ll.com/posts/hacker-noroshi/');
		expect(url).not.toContain('/ja/');
	});

	it("ja 以外は en と同じ（locale fallthrough）", () => {
		// LOCALES は 'en' | 'ja' の2つだが、ロジックは ja 判定のみで他は全部 else 枝に落ちる。
		expect(assistAboutUrl('en')).toBe(assistAboutUrl('en'));
		expect(assistAboutUrl('en')).not.toBe(assistAboutUrl('ja'));
	});
});

describe('assistAboutLabel', () => {
	it("ja と en で異なる文字列を返す", () => {
		expect(assistAboutLabel('ja')).not.toBe(assistAboutLabel('en'));
	});

	it("ja は日本語ラベル（「目的」を含む）", () => {
		const label = assistAboutLabel('ja');
		expect(label).toContain('目的');
		expect(label).toBe('このサイトはなに？ — ハッカーのろしの目的');
	});

	it("en は英語ラベル（'Hacker Noroshi' を含む）", () => {
		const label = assistAboutLabel('en');
		expect(label).toContain('Hacker Noroshi');
		expect(label).toBe('What is Hacker Noroshi? — why it exists');
	});
});

/**
 * 対称性の確認: 右下スイッチ本体のラベル（既存だが unit が無かったので軽く添える）。
 */
describe('assistSwitchLabel', () => {
	it("ja は「アシスト」", () => {
		expect(assistSwitchLabel('ja')).toBe('アシスト');
	});

	it("en は 'Assist'", () => {
		expect(assistSwitchLabel('en')).toBe('Assist');
	});
});

/**
 * A. 全ルート intro 網羅ガード（#170）。
 * fs で src/routes を走査して全 route id を導出し、公開 API `assistIntro` 越しに
 * ja/en 両方の intro が「非空」かつ「ja・en で集合が完全一致」であることを保証する。
 * 将来ルートを足したのに intro を付け忘れたら（または ja/en 片方だけ書いたら）即座に落ちる。
 * 内部辞書 ASSIST_INTRO には依存せず、公開関数だけで検証する。
 */
describe('assistIntro は全ルートを網羅する', () => {
	const routeIds = discoverRouteIds();

	it('src/routes から route id を1件以上導出できる（走査の健全性チェック）', () => {
		// 取りこぼし／パス導出バグで空配列になると後続の網羅ガードが空回りするので先に確認する。
		expect(routeIds.length).toBeGreaterThan(0);
		// ルート '/' は必ず存在する。
		expect(routeIds).toContain('/');
	});

	it('全 route id に ja の intro がある（非空文字列）', () => {
		const missing = routeIds.filter((id) => assistIntro(id, 'ja').trim() === '');
		expect(missing, `ja の intro が欠けている route id: ${JSON.stringify(missing)}`).toEqual([]);
	});

	it('全 route id に en の intro がある（非空文字列）', () => {
		const missing = routeIds.filter((id) => assistIntro(id, 'en').trim() === '');
		expect(missing, `en の intro が欠けている route id: ${JSON.stringify(missing)}`).toEqual([]);
	});

	it('ja と en で intro を持つ route id 集合が完全一致する（非対称検出）', () => {
		const jaIds = routeIds.filter((id) => assistIntro(id, 'ja').trim() !== '').sort();
		const enIds = routeIds.filter((id) => assistIntro(id, 'en').trim() !== '').sort();
		const jaOnly = jaIds.filter((id) => !enIds.includes(id));
		const enOnly = enIds.filter((id) => !jaIds.includes(id));
		expect(
			{ jaOnly, enOnly },
			`intro が ja/en で非対称: ja のみ=${JSON.stringify(jaOnly)} en のみ=${JSON.stringify(enOnly)}`
		).toEqual({ jaOnly: [], enOnly: [] });
	});
});

/**
 * B. 併記ルールの軽い回帰（#170）。
 * ja ヒントは画面の和名ラベルと英語を「和名（英語）」で併記する。UI 上の語とアシストの語を一致させ、
 * かつ英語へのデビュー練習にする狙い。en 側は英語のままで日本語を混ぜない（ロケール分離）。
 */
describe('assistHint の和名併記とロケール分離', () => {
	it("story.controls(ja) は『非表示（hide）』『通報（flag）』を併記する", () => {
		const hint = assistHint('story.controls', 'ja');
		expect(hint).toContain('非表示（hide）');
		expect(hint).toContain('通報（flag）');
	});

	it("item.controls(ja) は『お気に入り（favorite）』『編集（edit）』『削除（delete）』『返信（reply）』を併記する", () => {
		const hint = assistHint('item.controls', 'ja');
		expect(hint).toContain('お気に入り（favorite）');
		expect(hint).toContain('編集（edit）');
		expect(hint).toContain('削除（delete）');
		expect(hint).toContain('返信（reply）');
	});

	it("item.controls(en) は英語のまま＝日本語ラベルを含まない（ロケール分離）", () => {
		const hint = assistHint('item.controls', 'en');
		expect(hint).not.toBe('');
		expect(hint).not.toContain('お気に入り');
		expect(hint).not.toContain('編集');
		expect(hint).not.toContain('削除');
		expect(hint).not.toContain('返信');
	});
});
