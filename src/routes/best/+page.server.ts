import type { PageServerLoad } from './$types';
import { getDB, getStories, getVotedStoryIds, getHiddenStoryIds } from '$lib/server/db';

export const load: PageServerLoad = async ({ url, platform, locals }) => {
	const db = getDB(platform);
	const page = parseInt(url.searchParams.get('p') || '1', 10);
	let stories = await getStories(db, { orderBy: 'best', page, limit: 30 });

	let votedIds: Set<number> = new Set();
	let hiddenIds: Set<number> = new Set();
	if (locals.user) {
		[votedIds, hiddenIds] = await Promise.all([
			getVotedStoryIds(db, locals.user.id, stories.map((s) => s.id)),
			getHiddenStoryIds(db, locals.user.id)
		]);
		stories = stories.filter((s) => !hiddenIds.has(s.id));
	}

	return {
		stories,
		page,
		votedIds: Array.from(votedIds),
		hiddenIds: Array.from(hiddenIds)
	};
};
