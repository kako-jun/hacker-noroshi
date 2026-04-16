import type { PageServerLoad, Actions } from './$types';
import { getDB, getUserByUsername } from '$lib/server/db';
import { hashPassword } from '$lib/server/auth';
import { fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		throw redirect(302, '/');
	}
	return {};
};

export const actions: Actions = {
	default: async ({ request, platform }) => {
		const db = getDB(platform);
		const formData = await request.formData();
		const username = (formData.get('username') as string)?.trim();
		const email = (formData.get('email') as string)?.trim();

		if (!username || !email) {
			return fail(400, { error: 'Username and email are required.', username });
		}

		const user = await getUserByUsername(db, username);
		if (!user || !user.email || user.email.toLowerCase() !== email.toLowerCase()) {
			return fail(400, { error: 'Bad login.', username });
		}

		return { verified: true, username, email };
	},

	resetPassword: async ({ request, platform }) => {
		const db = getDB(platform);
		const formData = await request.formData();
		const username = (formData.get('username') as string)?.trim();
		const email = (formData.get('email') as string)?.trim();
		const password = formData.get('password') as string;

		if (!username || !email || !password) {
			return fail(400, { resetError: 'All fields are required.', verified: true, username, email });
		}

		if (password.length < 8) {
			return fail(400, { resetError: 'Password must be at least 8 characters.', verified: true, username, email });
		}

		const user = await getUserByUsername(db, username);
		if (!user || !user.email || user.email.toLowerCase() !== email.toLowerCase()) {
			return fail(400, { resetError: 'Verification failed.', verified: true, username, email });
		}

		const passwordHash = await hashPassword(password);
		await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(passwordHash, user.id).run();

		return { success: true };
	}
};
