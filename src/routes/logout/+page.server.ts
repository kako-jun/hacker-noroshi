import type { PageServerLoad } from './$types';
import { getDB } from '$lib/server/db';
import { deleteSession } from '$lib/server/auth';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ platform, cookies }) => {
	const sessionId = cookies.get('session');
	if (sessionId) {
		try {
			const db = getDB(platform);
			await deleteSession(db, sessionId);
		} catch {
			// If DB is unavailable, just clear cookie
		}
	}
	cookies.delete('session', { path: '/' });
	throw redirect(302, '/');
};
