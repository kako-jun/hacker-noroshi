import type { LayoutServerLoad } from './$types';
import { error } from '@sveltejs/kit';

// /admin/* の全ページに対する認可ガード。
// is_admin = 1 のユーザー以外は 403 を返す。未ログインも 403。
// セッション未取得時の情報漏えい（admin URL 構造のヒント）を避けるため
// 401 / redirect ではなく 403 で統一する。
export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user || locals.user.is_admin !== 1) {
		throw error(403, '管理者専用ページです');
	}
	return { user: locals.user };
};
