import type { PageServerLoad } from './$types';
import { getDB, getUserByUsername, getCommentsByUserId, getCommentVoteStates, getFlaggedItemIds } from '$lib/server/db';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, url, platform, locals }) => {
	const db = getDB(platform);
	const username = params.id;
	const page = parseInt(url.searchParams.get('p') || '1', 10);

	const user = await getUserByUsername(db, username);
	if (!user) {
		throw error(404, 'User not found');
	}

	const showdead = locals.user?.showdead === 1;
	const comments = await getCommentsByUserId(db, user.id, page, 30, locals.user?.id, showdead);

	let commentVoteStates: Map<number, 'up' | 'down'> = new Map();
	let flaggedCommentIds: Set<number> = new Set();
	if (locals.user) {
		[commentVoteStates, flaggedCommentIds] = await Promise.all([
			getCommentVoteStates(db, locals.user.id, comments.map((c: { id: number }) => c.id)),
			getFlaggedItemIds(db, locals.user.id, comments.map((c: { id: number }) => c.id), 'comment')
		]);
	}

	return {
		username: user.username,
		comments,
		commentVoteStates: Object.fromEntries(commentVoteStates),
		flaggedCommentIds: Array.from(flaggedCommentIds),
		page
	};
};
