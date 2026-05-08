// GET /api/v0/user/{username}.json
// 本家 HN /user/{username}.json 互換のユーザープロフィール。
// submitted (投稿 id 配列) は HN にはあるが、件数が膨大になるため未実装とする
// （/api-docs でも明記する）。
//
// 削除済みアカウント (users.deleted = 1) でも 200 で返す（about は空文字、
// karma は残る）。これは本家 HN の挙動に揃えたもの。
// 完全に存在しない username のときは 404 + { error: 'not found' }。
import type { RequestHandler } from './$types';
import { getDB, getUserByUsername, validateUsernameFormat } from '$lib/server/db';
import {
	jsonResponse,
	notFound,
	internalError,
	corsPreflight,
	serializeUser,
	CACHE_USER
} from '$lib/server/api';

export const GET: RequestHandler = async ({ params, platform }) => {
	const username = params.username;
	if (!username || validateUsernameFormat(username) !== null) {
		// 不正フォーマットは 404 として返す（403 や 400 は誤解を招く）
		return notFound();
	}

	try {
		const db = getDB(platform);
		const user = await getUserByUsername(db, username);
		if (!user) {
			return notFound();
		}
		return jsonResponse(serializeUser(user), CACHE_USER);
	} catch (err) {
		console.error('[api/v0/user]', err);
		return internalError();
	}
};

export const OPTIONS: RequestHandler = () => corsPreflight();
