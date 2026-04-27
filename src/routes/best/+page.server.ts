import type { PageServerLoad } from './$types';
import { getDB, getStories, getVotedStoryIds, getHiddenStoryIds, getFlaggedItemIds } from '$lib/server/db';

export const load: PageServerLoad = async ({ url, platform, locals }) => {
	const db = getDB(platform);
	const page = parseInt(url.searchParams.get('p') || '1', 10);
	const showdead = locals.user?.showdead === 1;
	let stories = await getStories(db, { orderBy: 'best', page, limit: 60, showdead });

	let votedIds: Set<number> = new Set();
	let hiddenIds: Set<number> = new Set();
	let flaggedIds: Set<number> = new Set();
	if (locals.user) {
		[votedIds, hiddenIds, flaggedIds] = await Promise.all([
			getVotedStoryIds(db, locals.user.id, stories.map((s) => s.id)),
			getHiddenStoryIds(db, locals.user.id),
			getFlaggedItemIds(db, locals.user.id, stories.map((s) => s.id), 'story')
		]);
		stories = stories.filter((s) => !hiddenIds.has(s.id)).slice(0, 30);
	}

	return {
		stories,
		page,
		votedIds: Array.from(votedIds),
		flaggedIds: Array.from(flaggedIds)
	};
};
