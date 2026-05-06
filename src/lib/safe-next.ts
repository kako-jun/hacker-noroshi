/**
 * `?next=` 等で渡される「ログイン後の戻り先」をオープンリダイレクトから守るバリデータ。
 * 受理する: '/' で始まり、別オリジンへ抜ける可能性のない相対パスのみ。
 *
 * 攻撃カテゴリ:
 * - `//evil.com` プロトコル相対 → `startsWith('//')` で弾く
 * - `/\evil.com` バックスラッシュ正規化（Chrome / Firefox は `\` を `/` 扱い）
 *   → `'\\'` を含む値を弾く
 * - `\r\n` 改行混入による Header Injection
 *   → 制御文字（U+0000–U+001F, U+007F）を含む値を弾く
 * - 絶対 URL (`http://`, `data:` 等) → そもそも '/' で始まらないので弾く
 *
 * URL エンコード（`%2F%2Fevil.com` 等）はブラウザがリダイレクト解決時に
 * デコードしないため、サーバ側で見える文字列のままなら別オリジンには漏れない。
 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1f\x7f]/;

export function safeNext(raw: string | null | undefined): string {
	if (!raw) return '/';
	if (!raw.startsWith('/')) return '/';
	if (raw.startsWith('//')) return '/';
	if (raw.includes('\\')) return '/';
	if (CONTROL_CHARS.test(raw)) return '/';
	return raw;
}
