import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || locals.user.noprocrast !== 1 || !locals.user.last_visit) {
		throw redirect(302, '/');
	}

	const lastVisit = new Date(locals.user.last_visit);
	const now = new Date();
	const elapsedMinutes = (now.getTime() - lastVisit.getTime()) / (1000 * 60);
	const totalWait = locals.user.maxvisit + locals.user.minaway;
	const remaining = Math.ceil(totalWait - elapsedMinutes);

	if (remaining <= 0) {
		throw redirect(302, '/');
	}

	return {
		remaining
	};
};
