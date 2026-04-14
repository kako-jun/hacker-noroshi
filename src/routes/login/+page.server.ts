import type { PageServerLoad, Actions } from './$types';
import { getDB, getUserByUsername } from '$lib/server/db';
import { verifyPassword, hashPassword, createSession } from '$lib/server/auth';
import { fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		throw redirect(302, '/');
	}
	return {};
};

export const actions: Actions = {
	login: async ({ request, platform, cookies }) => {
		const db = getDB(platform);
		const formData = await request.formData();
		const username = (formData.get('username') as string)?.trim();
		const password = formData.get('password') as string;

		if (!username || !password) {
			return fail(400, { loginError: 'Username and password are required', loginUsername: username });
		}

		const user = await getUserByUsername(db, username);
		if (!user) {
			return fail(400, { loginError: 'Bad login', loginUsername: username });
		}

		const valid = await verifyPassword(password, user.password_hash);
		if (!valid) {
			return fail(400, { loginError: 'Bad login', loginUsername: username });
		}

		const sessionId = await createSession(db, user.id);

		cookies.set('session', sessionId, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: false,
			maxAge: 30 * 24 * 60 * 60
		});

		throw redirect(302, '/');
	},

	signup: async ({ request, platform, cookies }) => {
		const db = getDB(platform);
		const formData = await request.formData();
		const username = (formData.get('username') as string)?.trim();
		const password = formData.get('password') as string;

		if (!username || !password) {
			return fail(400, { signupError: 'Username and password are required', signupUsername: username });
		}

		if (username.length < 3 || username.length > 15) {
			return fail(400, { signupError: 'Username must be between 3 and 15 characters', signupUsername: username });
		}

		if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
			return fail(400, {
				signupError: 'Username can only contain letters, numbers, underscores, and hyphens',
				signupUsername: username
			});
		}

		if (password.length < 8) {
			return fail(400, { signupError: 'Password must be at least 8 characters', signupUsername: username });
		}

		const existing = await getUserByUsername(db, username);
		if (existing) {
			return fail(400, { signupError: 'That username is taken', signupUsername: username });
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
