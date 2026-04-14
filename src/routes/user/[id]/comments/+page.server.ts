import type { PageServerLoad } from './$types';
import { getDB, getUserByUsername, getCommentsByUserId } from '$lib/server/db';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, url, platform }) => {
	const db = getDB(platform);
	const username = params.id;
	const page = parseInt(url.searchParams.get('p') || '1', 10);

	const user = await getUserByUsername(db, username);
	if (!user) {
		throw error(404, 'User not found');
	}

	const comments = await getCommentsByUserId(db, user.id, page, 30);

	return {
		username: user.username,
		comments,
		page
	};
};
