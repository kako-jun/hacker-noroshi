import { describe, it, expect } from 'vitest';
import { safeNext } from '../../src/lib/safe-next';

describe('safeNext', () => {
	describe('受理', () => {
		it('単純な相対パス', () => {
			expect(safeNext('/')).toBe('/');
			expect(safeNext('/newest')).toBe('/newest');
			expect(safeNext('/user/foo')).toBe('/user/foo');
		});

		it('クエリ・フラグメント付き', () => {
			expect(safeNext('/newest?p=2')).toBe('/newest?p=2');
			expect(safeNext('/item/1#23')).toBe('/item/1#23');
		});

		it('URL エンコードされた相対パス（ブラウザはこれを別オリジンに解決しない）', () => {
			expect(safeNext('/%2F%2Fevil.com')).toBe('/%2F%2Fevil.com');
		});
	});

	describe('拒否（オープンリダイレクト対策）', () => {
		it('null / undefined / 空文字 → /', () => {
			expect(safeNext(null)).toBe('/');
			expect(safeNext(undefined)).toBe('/');
			expect(safeNext('')).toBe('/');
		});

		it('プロトコル相対 //evil.com → /', () => {
			expect(safeNext('//evil.com')).toBe('/');
			expect(safeNext('//evil.com/path')).toBe('/');
		});

		it('バックスラッシュ正規化攻撃 /\\evil.com → /', () => {
			// 主要ブラウザは Location ヘッダ内の '\' を '/' として扱うため、
			// '/\\evil.com' は実質 '//evil.com' と等価。弾かないと別オリジンへ漏れる。
			expect(safeNext('/\\evil.com')).toBe('/');
			expect(safeNext('/\\/evil.com')).toBe('/');
			expect(safeNext('\\\\evil.com')).toBe('/');
			expect(safeNext('/path\\with\\backslash')).toBe('/');
		});

		it('絶対 URL → /', () => {
			expect(safeNext('http://evil.com')).toBe('/');
			expect(safeNext('https://evil.com/path')).toBe('/');
			expect(safeNext('javascript:alert(1)')).toBe('/');
			expect(safeNext('data:text/html,foo')).toBe('/');
		});

		it("'/' で始まらない値 → /", () => {
			expect(safeNext('newest')).toBe('/');
			expect(safeNext('?p=2')).toBe('/');
			expect(safeNext(' /newest')).toBe('/');
		});

		it('制御文字（CRLF Header Injection 対策） → /', () => {
			expect(safeNext('/path\r\nLocation: https://evil.com')).toBe('/');
			expect(safeNext('/path\nfoo')).toBe('/');
			expect(safeNext('/path\tfoo')).toBe('/');
			expect(safeNext('/path\x00')).toBe('/');
			expect(safeNext('/path\x7f')).toBe('/');
		});
	});
});
