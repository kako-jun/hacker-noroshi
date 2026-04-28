import type { PageServerLoad, Actions } from './$types';
import { getDB, createPoll } from '$lib/server/db';
import { fail, redirect } from '@sveltejs/kit';
import {
	POLL_OPTION_MIN,
	POLL_OPTION_MAX,
	POLL_OPTION_TEXT_MAX,
	POLL_TITLE_MAX,
	POLL_TEXT_MAX,
	parsePollOptions
} from './poll';

// 投票（poll）の投稿。本家HN /newpoll 相当。
// 仕様: タイトル 1-80、テキスト任意 4000 まで、選択肢 2-10 個、各 1-300 文字。
// karma 閾値はゼロ（誰でも投稿可）。type='poll' なので /submit と URL バリデーションは無関係。

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}
	return {};
};

export const actions: Actions = {
	default: async ({ request, platform, locals }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const db = getDB(platform);
		const formData = await request.formData();
		const title = (formData.get('title') as string)?.trim() ?? '';
		const text = ((formData.get('text') as string) ?? '').trim() || null;
		const optionsRaw = (formData.get('options') as string) ?? '';

		if (!title) {
			return fail(400, { error: 'Title is required', title, text, options: optionsRaw });
		}
		if (title.length > POLL_TITLE_MAX) {
			return fail(400, {
				error: `Title must be ${POLL_TITLE_MAX} characters or less`,
				title,
				text,
				options: optionsRaw
			});
		}
		if (text && text.length > POLL_TEXT_MAX) {
			return fail(400, {
				error: `Text must be ${POLL_TEXT_MAX} characters or less`,
				title,
				text,
				options: optionsRaw
			});
		}

		const options = parsePollOptions(optionsRaw);
		if (options.length < POLL_OPTION_MIN) {
			return fail(400, {
				error: `At least ${POLL_OPTION_MIN} choices are required`,
				title,
				text,
				options: optionsRaw
			});
		}
		if (options.length > POLL_OPTION_MAX) {
			return fail(400, {
				error: `At most ${POLL_OPTION_MAX} choices are allowed`,
				title,
				text,
				options: optionsRaw
			});
		}
		for (const opt of options) {
			if (opt.length > POLL_OPTION_TEXT_MAX) {
				return fail(400, {
					error: `Each choice must be ${POLL_OPTION_TEXT_MAX} characters or less`,
					title,
					text,
					options: optionsRaw
				});
			}
		}

		// Rate limit: 10 minutes between story submissions（poll も submit と同枠で扱う）。
		const lastStory = await db
			.prepare(
				'SELECT created_at FROM stories WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
			)
			.bind(locals.user.id)
			.first<{ created_at: string }>();
		if (lastStory) {
			const elapsed = Date.now() - new Date(lastStory.created_at).getTime();
			if (elapsed < 10 * 60 * 1000) {
				return fail(429, {
					error: "You're submitting too fast. Please slow down.",
					title,
					text,
					options: optionsRaw
				});
			}
		}

		const newId = await createPoll(db, {
			userId: locals.user.id,
			title,
			text,
			options
		});

		throw redirect(302, `/item/${newId}`);
	}
};
