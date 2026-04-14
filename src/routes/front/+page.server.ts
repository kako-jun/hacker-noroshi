import type { PageServerLoad } from './$types';
import { getDB, getFrontPageStories, getVotedStoryIds } from '$lib/server/db';

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

	const stories = await getFrontPageStories(db, day, page, 30);

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
		day,
		votedIds: Array.from(votedIds)
	};
};
