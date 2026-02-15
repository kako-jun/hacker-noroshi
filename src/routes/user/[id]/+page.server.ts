import type { PageServerLoad } from './$types';
import { getDB, getUserByUsername, getStoriesByUserId, getVotedStoryIds } from '$lib/server/db';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, platform, locals }) => {
	const db = getDB(platform);
	const username = params.id;

	const user = await getUserByUsername(db, username);
	if (!user) {
		throw error(404, 'User not found');
	}

	const submissions = await getStoriesByUserId(db, user.id, 1, 30);

	let votedIds: Set<number> = new Set();
	if (locals.user) {
		votedIds = await getVotedStoryIds(
			db,
			locals.user.id,
			submissions.map((s) => s.id)
		);
	}

	return {
		profile: {
			id: user.id,
			username: user.username,
			karma: user.karma,
			about: user.about,
			created_at: user.created_at
		},
		submissions,
		votedIds: Array.from(votedIds)
	};
};
