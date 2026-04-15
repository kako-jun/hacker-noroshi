import type { PageServerLoad, Actions } from './$types';
import { getDB, getUserByUsername } from '$lib/server/db';
import { error, fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, platform, locals }) => {
	const db = getDB(platform);
	const username = params.id;

	const user = await getUserByUsername(db, username);
	if (!user) {
		throw error(404, 'User not found');
	}

	const isOwnProfile = locals.user?.username === user.username;

	return {
		profile: {
			id: user.id,
			username: user.username,
			karma: user.karma,
			about: user.about,
			email: isOwnProfile ? user.email : '',
			delay: isOwnProfile ? user.delay : 0,
			noprocrast: isOwnProfile ? user.noprocrast : 0,
			maxvisit: isOwnProfile ? user.maxvisit : 20,
			minaway: isOwnProfile ? user.minaway : 180,
			showdead: isOwnProfile ? user.showdead : 0,
			created_at: user.created_at
		},
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
		const email = (formData.get('email') as string) ?? '';
		const delay = Math.max(0, Math.min(10, parseInt(formData.get('delay') as string) || 0));
		const noprocrast = formData.get('noprocrast') === 'yes' ? 1 : 0;
		const maxvisit = Math.max(1, Math.min(1440, parseInt(formData.get('maxvisit') as string) || 20));
		const minaway = Math.max(1, Math.min(1440, parseInt(formData.get('minaway') as string) || 180));
		const showdead = formData.get('showdead') === 'yes' ? 1 : 0;

		// noprocrast を OFF にしたとき last_visit をリセット
		const lastVisitClause = noprocrast === 0 ? ', last_visit = NULL' : '';

		await db
			.prepare(
				`UPDATE users SET about = ?, email = ?, delay = ?, noprocrast = ?, maxvisit = ?, minaway = ?, showdead = ?${lastVisitClause} WHERE username = ?`
			)
			.bind(about, email, delay, noprocrast, maxvisit, minaway, showdead, params.id)
			.run();

		return { success: true };
	}
};
