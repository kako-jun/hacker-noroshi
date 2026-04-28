import { error, redirect } from '@sveltejs/kit';
import { getUserByUsername, getOldUsernameRedirect, type UserRow } from './db';

/**
 * /user/[id] とその子ルート (submissions/comments/favorites/hidden) で共通の
 * username 解決処理。username が見つからなければ username_history を引いて
 * 最新の名前へ 301 リダイレクトし、それでも無ければ 404。
 */
export async function resolveUserOrRedirect(
	db: D1Database,
	username: string,
	subpath: string = ''
): Promise<UserRow> {
	const user = await getUserByUsername(db, username);
	if (user) return user;

	const newName = await getOldUsernameRedirect(db, username);
	if (newName) {
		throw redirect(301, `/user/${newName}${subpath}`);
	}
	throw error(404, 'User not found');
}
