import type { PageServerLoad } from './$types';
import { getDB, getBestComments, getCommentVoteStates, getFlaggedItemIds } from '$lib/server/db';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const load: PageServerLoad = async ({ url, platform, locals }) => {
	const db = getDB(platform);
	const page = parseInt(url.searchParams.get('p') || '1', 10);
	const showdead = locals.user?.showdead === 1;
	const comments = await getBestComments(db, {
		sinceMs: THIRTY_DAYS_MS,
		page,
		limit: 30,
		currentUserId: locals.user?.id,
		showdead
	});

	let commentVoteStates: Map<number, 'up' | 'down'> = new Map();
	let flaggedCommentIds: Set<number> = new Set();
	if (locals.user) {
		[commentVoteStates, flaggedCommentIds] = await Promise.all([
			getCommentVoteStates(db, locals.user.id, comments.map((c) => c.id)),
			getFlaggedItemIds(db, locals.user.id, comments.map((c) => c.id), 'comment')
		]);
	}

	return {
		comments,
		commentVoteStates: Object.fromEntries(commentVoteStates),
		flaggedCommentIds: Array.from(flaggedCommentIds),
		page
	};
};
