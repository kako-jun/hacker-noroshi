import { error, redirect } from '@sveltejs/kit';
import { getUserByUsername, getOldUsernameRedirect, type UserRow } from './db';

/**
 * /user/[id] とその子ルート (submissions/comments/favorites/hidden) で共通の
 * username 解決処理。username が見つからなければ username_history を引いて
 * 最新の名前へ 301 リダイレクトし、それでも無ければ 404。
 *
 * リダイレクト先は元 URL の querystring (`?p=2` 等のページング) を保持する。
 */
export async function resolveUserOrRedirect(
	db: D1Database,
	username: string,
	subpath: string = '',
	url?: URL
): Promise<UserRow> {
	const user = await getUserByUsername(db, username);
	if (user) return user;

	const newName = await getOldUsernameRedirect(db, username);
	if (newName) {
		const search = url?.search ?? '';
		throw redirect(301, `/user/${newName}${subpath}${search}`);
	}
	throw error(404, 'User not found');
}
