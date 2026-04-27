import type { PageServerLoad } from './$types';
import { getDB, getTopUsersByKarma } from '$lib/server/db';

export const load: PageServerLoad = async ({ url, platform }) => {
	const db = getDB(platform);
	const page = parseInt(url.searchParams.get('p') || '1', 10);
	const users = await getTopUsersByKarma(db, page, 30);

	return {
		users: users.map((u) => ({
			username: u.username,
			karma: u.karma,
			created_at: u.created_at
		})),
		page
	};
};
