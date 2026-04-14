import type { PageServerLoad, Actions } from './$types';
import { getDB, getUserByUsername, getStoriesByUserId, getVotedStoryIds } from '$lib/server/db';
import { error, fail } from '@sveltejs/kit';

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

	const isOwnProfile = locals.user?.username === user.username;

	return {
		profile: {
			id: user.id,
			username: user.username,
			karma: user.karma,
			about: user.about,
			created_at: user.created_at
		},
		submissions,
		votedIds: Array.from(votedIds),
		isOwnProfile
	};
};

export const actions: Actions = {
	update: async ({ request, platform, locals, params }) => {
		if (!locals.user) {
			throw error(401, 'Not logged in');
		}

		if (locals.user.username !== params.id) {
			throw error(403, 'Cannot edit another user\'s profile');
		}

		const db = getDB(platform);
		const formData = await request.formData();
		const about = (formData.get('about') as string) ?? '';

		await db
			.prepare('UPDATE users SET about = ? WHERE username = ?')
			.bind(about, params.id)
			.run();

		return { success: true };
	}
};
