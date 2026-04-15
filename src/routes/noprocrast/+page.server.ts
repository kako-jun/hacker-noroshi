import type { PageServerLoad } from './$types';
import { getDB } from '$lib/server/db';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ platform, locals }) => {
	if (!locals.user || locals.user.noprocrast !== 1) {
		throw redirect(302, '/');
	}

	const db = getDB(platform);
	const userRow = await db
		.prepare('SELECT last_visit, maxvisit, minaway FROM users WHERE id = ?')
		.bind(locals.user.id)
		.first<{ last_visit: string | null; maxvisit: number; minaway: number }>();

	if (!userRow?.last_visit) {
		throw redirect(302, '/');
	}

	const lastVisit = new Date(userRow.last_visit);
	const now = new Date();
	const elapsedMinutes = (now.getTime() - lastVisit.getTime()) / (1000 * 60);
	const totalWait = userRow.maxvisit + userRow.minaway;
	const remaining = Math.ceil(totalWait - elapsedMinutes);

	if (remaining <= 0) {
		throw redirect(302, '/');
	}

	return {
		remaining
	};
};
