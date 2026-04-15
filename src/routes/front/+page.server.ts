import type { PageServerLoad } from './$types';
import { getDB, getFrontPageStories, getVotedStoryIds, getHiddenStoryIds } from '$lib/server/db';

export const load: PageServerLoad = async ({ url, platform, locals }) => {
	const db = getDB(platform);
	const page = parseInt(url.searchParams.get('p') || '1', 10);

	// Default to yesterday UTC
	const dayParam = url.searchParams.get('day');
	let day: string;
	if (dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam)) {
		day = dayParam;
	} else {
		const yesterday = new Date();
		yesterday.setUTCDate(yesterday.getUTCDate() - 1);
		day = yesterday.toISOString().slice(0, 10);
	}

	let stories = await getFrontPageStories(db, day, page, 60);

	let votedIds: Set<number> = new Set();
	let hiddenIds: Set<number> = new Set();
	if (locals.user) {
		[votedIds, hiddenIds] = await Promise.all([
			getVotedStoryIds(db, locals.user.id, stories.map((s) => s.id)),
			getHiddenStoryIds(db, locals.user.id)
		]);
		stories = stories.filter((s) => !hiddenIds.has(s.id)).slice(0, 30);
	}

	return {
		stories,
		page,
		day,
		votedIds: Array.from(votedIds)
	};
};
