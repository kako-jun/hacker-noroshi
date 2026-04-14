import type { PageServerLoad } from './$types';
import { getDB, getUserByUsername, getStoriesByUserId, getVotedStoryIds } from '$lib/server/db';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, url, platform, locals }) => {
	const db = getDB(platform);
	const username = params.id;
	const page = parseInt(url.searchParams.get('p') || '1', 10);

	const user = await getUserByUsername(db, username);
	if (!user) {
		throw error(404, 'User not found');
	}

	const submissions = await getStoriesByUserId(db, user.id, page, 30);

	let votedIds: Set<number> = new Set();
	if (locals.user) {
		votedIds = await getVotedStoryIds(
			db,
			locals.user.id,
			submissions.map((s) => s.id)
		);
	}

	return {
		username: user.username,
		submissions,
		votedIds: Array.from(votedIds),
		page
	};
};
