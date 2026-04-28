import type { PageServerLoad } from './$types';
import { getDB, getPolls, getVotedStoryIds, getFlaggedItemIds, getHiddenStoryIds } from '$lib/server/db';

export const load: PageServerLoad = async ({ url, platform, locals }) => {
	const db = getDB(platform);
	const page = parseInt(url.searchParams.get('p') ?? '1', 10);
	const showdead = locals.user?.showdead === 1;

	const stories = await getPolls(db, page, 30, showdead);

	let votedIds: number[] = [];
	let flaggedIds: number[] = [];
	let hiddenIds: number[] = [];
	if (locals.user) {
		const ids = stories.map((s) => s.id);
		const [votedSet, flaggedSet, hiddenSet] = await Promise.all([
			getVotedStoryIds(db, locals.user.id, ids),
			getFlaggedItemIds(db, locals.user.id, ids, 'story'),
			getHiddenStoryIds(db, locals.user.id)
		]);
		votedIds = Array.from(votedSet);
		flaggedIds = Array.from(flaggedSet);
		hiddenIds = Array.from(hiddenSet);
	}

	return {
		stories,
		page,
		votedIds,
		flaggedIds,
		hiddenIds
	};
};
