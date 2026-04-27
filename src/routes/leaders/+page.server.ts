import type { PageServerLoad } from './$types';
import { getDB, getTopUsersByKarma } from '$lib/server/db';

export const load: PageServerLoad = async ({ url, platform }) => {
	const db = getDB(platform);
	const page = parseInt(url.searchParams.get('p') || '1', 10);
	// hasMore 判定のため 1件多めに取る
	const fetched = await getTopUsersByKarma(db, page, 31);
	const hasMore = fetched.length > 30;
	const users = fetched.slice(0, 30);

	return {
		users: users.map((u) => ({
			username: u.username,
			karma: u.karma,
			created_at: u.created_at
		})),
		page,
		hasMore
	};
};
