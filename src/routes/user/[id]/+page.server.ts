import type { PageServerLoad, Actions } from './$types';
import {
	getDB,
	getLastUsernameChange,
	isUsernameTaken,
	updateUsername,
	validateUsernameFormat,
	USERNAME_CHANGE_COOLDOWN_MS
} from '$lib/server/db';
import { resolveUserOrRedirect } from '$lib/server/userRoute';
import { error, fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, platform, locals }) => {
	const db = getDB(platform);
	const username = params.id;

	const user = await resolveUserOrRedirect(db, username);

	const isOwnProfile = locals.user?.username === user.username;

	let nextUsernameChangeAt: string | null = null;
	if (isOwnProfile) {
		const last = await getLastUsernameChange(db, user.id);
		if (last) {
			const nextMs = new Date(last).getTime() + USERNAME_CHANGE_COOLDOWN_MS;
			if (nextMs > Date.now()) {
				nextUsernameChangeAt = new Date(nextMs).toISOString();
			}
		}
	}

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
		isOwnProfile,
		nextUsernameChangeAt
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
	},

	changeUsername: async ({ request, platform, locals, params }) => {
		if (!locals.user) {
			throw error(401, 'Not logged in');
		}
		if (locals.user.username !== params.id) {
			throw error(403, "Cannot edit another user's profile");
		}

		const db = getDB(platform);
		const formData = await request.formData();
		const newUsername = ((formData.get('newUsername') as string) ?? '').trim();

		const formatError = validateUsernameFormat(newUsername);
		if (formatError) {
			return fail(400, { changeUsernameError: formatError });
		}

		// 自分の現在 username と同じなら no-op エラーで返す
		if (newUsername === locals.user.username) {
			return fail(400, { changeUsernameError: 'New username must differ from the current one' });
		}

		// 90日に1回の頻度制限
		const last = await getLastUsernameChange(db, locals.user.id);
		if (last) {
			const nextMs = new Date(last).getTime() + USERNAME_CHANGE_COOLDOWN_MS;
			if (Date.now() < nextMs) {
				const nextDate = new Date(nextMs).toISOString().split('T')[0];
				return fail(429, {
					changeUsernameError: `You can change your username again on ${nextDate}`
				});
			}
		}

		// 重複チェック（履歴も含む）
		if (await isUsernameTaken(db, newUsername)) {
			return fail(400, { changeUsernameError: 'That username is taken' });
		}

		const oldUsername = locals.user.username;
		await updateUsername(db, locals.user.id, oldUsername, newUsername);

		// セッションの username も更新（hooks.server.ts で users から再取得されるが、
		// 即時反映のため redirect 先 URL を新名にする）。Cookie 自体は user_id を
		// 引いているので変更不要。
		// 自分のプロフィールページの URL が変わるので新しい URL に redirect する。
		throw redirect(303, `/user/${newUsername}`);
	}
};
