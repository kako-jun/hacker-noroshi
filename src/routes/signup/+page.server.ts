import type { PageServerLoad, Actions } from './$types';
import { getDB, getUserByUsername } from '$lib/server/db';
import { hashPassword, createSession } from '$lib/server/auth';
import { fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		throw redirect(302, '/');
	}
	return {};
};

export const actions: Actions = {
	default: async ({ request, platform, cookies }) => {
		const db = getDB(platform);
		const formData = await request.formData();
		const username = (formData.get('username') as string)?.trim();
		const password = formData.get('password') as string;

		if (!username || !password) {
			return fail(400, { error: 'Username and password are required', username });
		}

		if (username.length < 3 || username.length > 15) {
			return fail(400, { error: 'Username must be between 3 and 15 characters', username });
		}

		if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
			return fail(400, {
				error: 'Username can only contain letters, numbers, underscores, and hyphens',
				username
			});
		}

		if (password.length < 8) {
			return fail(400, { error: 'Password must be at least 8 characters', username });
		}

		const existing = await getUserByUsername(db, username);
		if (existing) {
			return fail(400, { error: 'That username is taken', username });
		}

		const passwordHash = await hashPassword(password);

		const result = await db
			.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
			.bind(username, passwordHash)
			.run();

		const userId = result.meta.last_row_id;
		const sessionId = await createSession(db, userId as number);

		cookies.set('session', sessionId, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: false,
			maxAge: 30 * 24 * 60 * 60
		});

		throw redirect(302, '/');
	}
};
