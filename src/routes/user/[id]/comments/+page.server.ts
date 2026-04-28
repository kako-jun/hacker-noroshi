import type { PageServerLoad } from './$types';
import { getDB, getCommentsByUserId, getCommentVoteStates, getFlaggedItemIds } from '$lib/server/db';
import { resolveUserOrRedirect } from '$lib/server/userRoute';

export const load: PageServerLoad = async ({ params, url, platform, locals }) => {
	const db = getDB(platform);
	const username = params.id;
	const page = parseInt(url.searchParams.get('p') || '1', 10);

	const user = await resolveUserOrRedirect(db, username, '/comments', url);

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
		userDeleted: user.deleted,
		username: user.username,
		comments,
		commentVoteStates: Object.fromEntries(commentVoteStates),
		flaggedCommentIds: Array.from(flaggedCommentIds),
		page
	};
};
