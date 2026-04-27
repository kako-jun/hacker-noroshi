import type { PageServerLoad } from './$types';
import { getDB, getUserByUsername, getFavoriteStoriesByUserId, getVotedStoryIds, getFlaggedItemIds } from '$lib/server/db';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, url, platform, locals }) => {
	const db = getDB(platform);
	const username = params.id;
	const page = parseInt(url.searchParams.get('p') || '1', 10);

	const user = await getUserByUsername(db, username);
	if (!user) {
		throw error(404, 'User not found');
	}

	const showdead = locals.user?.showdead === 1;
	const favorites = await getFavoriteStoriesByUserId(db, user.id, page, 30, showdead);

	let votedIds: Set<number> = new Set();
	let flaggedIds: Set<number> = new Set();
	if (locals.user) {
		[votedIds, flaggedIds] = await Promise.all([
			getVotedStoryIds(db, locals.user.id, favorites.map((s) => s.id)),
			getFlaggedItemIds(db, locals.user.id, favorites.map((s) => s.id), 'story')
		]);
	}

	return {
		username: user.username,
		favorites,
		votedIds: Array.from(votedIds),
		flaggedIds: Array.from(flaggedIds),
		page
	};
};
