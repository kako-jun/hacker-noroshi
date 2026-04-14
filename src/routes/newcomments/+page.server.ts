import type { PageServerLoad } from './$types';
import { getDB, getRecentComments, getVotedCommentIds } from '$lib/server/db';

export const load: PageServerLoad = async ({ url, platform, locals }) => {
	const db = getDB(platform);
	const page = parseInt(url.searchParams.get('p') || '1', 10);

	const comments = await getRecentComments(db, page, 30);

	let votedIds: Set<number> = new Set();
	if (locals.user) {
		votedIds = await getVotedCommentIds(
			db,
			locals.user.id,
			comments.map((c: any) => c.id)
		);
	}

	return {
		comments,
		votedIds: Array.from(votedIds),
		page
	};
};
