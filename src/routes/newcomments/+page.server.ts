import type { PageServerLoad } from './$types';
import { getDB, getRecentComments, getCommentVoteStates } from '$lib/server/db';

export const load: PageServerLoad = async ({ url, platform, locals }) => {
	const db = getDB(platform);
	const page = parseInt(url.searchParams.get('p') || '1', 10);

	const comments = await getRecentComments(db, page, 30);

	let commentVoteStates: Map<number, 'up' | 'down'> = new Map();
	if (locals.user) {
		commentVoteStates = await getCommentVoteStates(
			db,
			locals.user.id,
			comments.map((c: any) => c.id)
		);
	}

	return {
		comments,
		commentVoteStates: Object.fromEntries(commentVoteStates),
		page
	};
};
