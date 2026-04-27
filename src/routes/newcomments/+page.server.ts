import type { PageServerLoad } from './$types';
import { getDB, getRecentComments, getCommentVoteStates, getFlaggedItemIds } from '$lib/server/db';

export const load: PageServerLoad = async ({ url, platform, locals }) => {
	const db = getDB(platform);
	const page = parseInt(url.searchParams.get('p') || '1', 10);

	const showdead = locals.user?.showdead === 1;
	const comments = await getRecentComments(db, page, 30, locals.user?.id, showdead);

	let commentVoteStates: Map<number, 'up' | 'down'> = new Map();
	let flaggedCommentIds: Set<number> = new Set();
	if (locals.user) {
		[commentVoteStates, flaggedCommentIds] = await Promise.all([
			getCommentVoteStates(db, locals.user.id, comments.map((c: { id: number }) => c.id)),
			getFlaggedItemIds(db, locals.user.id, comments.map((c: { id: number }) => c.id), 'comment')
		]);
	}

	return {
		comments,
		commentVoteStates: Object.fromEntries(commentVoteStates),
		flaggedCommentIds: Array.from(flaggedCommentIds),
		page
	};
};
