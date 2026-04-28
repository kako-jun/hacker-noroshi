import type { LayoutServerLoad } from './$types';
import { requireAdmin } from '$lib/server/admin';

// /admin/* の全ページに対する認可ガード。
// is_admin = 1 のユーザー以外は 403 を返す。未ログインも 403。
// セッション未取得時の情報漏えい（admin URL 構造のヒント）を避けるため
// 401 / redirect ではなく 403 で統一する。
//
// /admin 直は 404（layout は子ルートのみ）。URL 構造を露出させない。
// SvelteKit は +page.svelte / +page.server.ts のないルートに対して
// デフォルトで 404 を返すので、ここでは layout の認可だけを書く。
export const load: LayoutServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	return { user: locals.user };
};
