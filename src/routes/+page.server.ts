import type { PageServerLoad } from './$types';
import { getDB, getStories, getVotedStoryIds } from '$lib/server/db';

export const load: PageServerLoad = async ({ url, platform, locals }) => {
	const db = getDB(platform);
	const page = parseInt(url.searchParams.get('p') || '1', 10);
	const stories = await getStories(db, { orderBy: 'rank', page, limit: 30 });

	let votedIds: Set<number> = new Set();
	if (locals.user) {
		votedIds = await getVotedStoryIds(
			db,
			locals.user.id,
			stories.map((s) => s.id)
		);
	}

	return {
		stories,
		page,
		votedIds: Array.from(votedIds)
	};
};
