import { error } from '@sveltejs/kit';

/**
 * 管理者ガード（#77）。/admin/* 配下の load / action 共通で使う。
 *
 * - 未ログイン or is_admin !== 1 のときは 403 を throw する。
 * - 401 / redirect ではなく 403 で統一する。これは admin URL 構造のヒントを
 *   未認証クライアントに渡さないため（layout 側のポリシーと一致させる）。
 *
 * action 内では throw 後の戻り値型を満たすため、呼び出し側は
 * `requireAdmin(locals)` の後に通常処理を続けて書ける。
 */
export function requireAdmin(locals: App.Locals): asserts locals is App.Locals & {
	user: NonNullable<App.Locals['user']> & { is_admin: 1 };
} {
	if (!locals.user || locals.user.is_admin !== 1) {
		throw error(403, '管理者専用ページです');
	}
}
