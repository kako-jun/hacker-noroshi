import type { Handle } from '@sveltejs/kit';
import { getDB } from '$lib/server/db';
import { getSession } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = null;

	const sessionId = event.cookies.get('session');
	if (sessionId) {
		try {
			const db = getDB(event.platform);
			const user = await getSession(db, sessionId);
			if (user) {
				event.locals.user = user;
			} else {
				event.cookies.delete('session', { path: '/' });
			}
		} catch {
			// DB not available (e.g. during build), skip auth
		}
	}

	return resolve(event);
};
