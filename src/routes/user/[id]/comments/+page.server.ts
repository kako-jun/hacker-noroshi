import type { PageServerLoad } from './$types';
import { getDB, getUserByUsername, getCommentsByUserId, getCommentVoteStates } from '$lib/server/db';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, url, platform, locals }) => {
	const db = getDB(platform);
	const username = params.id;
	const page = parseInt(url.searchParams.get('p') || '1', 10);

	const user = await getUserByUsername(db, username);
	if (!user) {
		throw error(404, 'User not found');
	}

	const comments = await getCommentsByUserId(db, user.id, page, 30);

	let commentVoteStates: Map<number, 'up' | 'down'> = new Map();
	if (locals.user) {
		commentVoteStates = await getCommentVoteStates(
			db,
			locals.user.id,
			comments.map((c: any) => c.id)
		);
	}

	return {
		username: user.username,
		comments,
		commentVoteStates: Object.fromEntries(commentVoteStates),
		page
	};
};
