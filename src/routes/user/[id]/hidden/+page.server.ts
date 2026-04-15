import type { PageServerLoad } from './$types';
import { getDB, getUserByUsername, getHiddenStoriesByUserId, getVotedStoryIds } from '$lib/server/db';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, url, platform, locals }) => {
	const db = getDB(platform);
	const username = params.id;
	const page = parseInt(url.searchParams.get('p') || '1', 10);

	const user = await getUserByUsername(db, username);
	if (!user) {
		throw error(404, 'User not found');
	}

	if (!locals.user || locals.user.username !== username) {
		throw error(403, 'Forbidden');
	}

	const hidden = await getHiddenStoriesByUserId(db, user.id, page, 30);

	let votedIds: Set<number> = new Set();
	if (locals.user) {
		votedIds = await getVotedStoryIds(
			db,
			locals.user.id,
			hidden.map((s) => s.id)
		);
	}

	return {
		username: user.username,
		hidden,
		votedIds: Array.from(votedIds),
		page
	};
};
