import { describe, it, expect } from 'vitest';
import { assistAboutLabel, assistAboutUrl, assistSwitchLabel } from '../../src/lib/assist';

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
