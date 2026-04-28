import type { PageServerLoad, Actions } from './$types';
import { getDB, getUserByUsername, isUsernameTaken, validateUsernameFormat } from '$lib/server/db';
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

		const formatError = validateUsernameFormat(username);
		if (formatError) {
			return fail(400, { signupError: formatError, signupUsername: username });
		}

		if (password.length < 8) {
			return fail(400, { signupError: 'Password must be at least 8 characters', signupUsername: username });
		}

		// 過去に使われた username も含めて重複チェック（永久ロック）。
		if (await isUsernameTaken(db, username)) {
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
