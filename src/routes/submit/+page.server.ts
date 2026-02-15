import type { PageServerLoad, Actions } from './$types';
import { getDB } from '$lib/server/db';
import { fail, redirect } from '@sveltejs/kit';

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
		const title = (formData.get('title') as string)?.trim();
		const url = (formData.get('url') as string)?.trim() || null;
		const text = (formData.get('text') as string)?.trim() || null;

		if (!title) {
			return fail(400, { error: 'Title is required', title, url, text });
		}

		if (title.length > 80) {
			return fail(400, { error: 'Title must be 80 characters or less', title, url, text });
		}

		if (!url && !text) {
			return fail(400, { error: 'Either URL or text is required', title, url, text });
		}

		if (url && text) {
			return fail(400, {
				error: 'Please submit either a URL or text, not both',
				title,
				url,
				text
			});
		}

		if (url) {
			try {
				new URL(url);
			} catch {
				return fail(400, { error: 'Invalid URL', title, url, text });
			}
		}

		let type = 'story';
		if (title.toLowerCase().startsWith('ask hn:') || title.startsWith('Ask HN:')) {
			type = 'ask';
		} else if (title.toLowerCase().startsWith('show hn:') || title.startsWith('Show HN:')) {
			type = 'show';
		}

		const result = await db
			.prepare(
				'INSERT INTO stories (title, url, text, user_id, type) VALUES (?, ?, ?, ?, ?)'
			)
			.bind(title, url, text, locals.user.id, type)
			.run();

		const storyId = result.meta.last_row_id;

		// Auto-upvote by the submitter
		await db
			.prepare("INSERT INTO votes (user_id, item_id, item_type) VALUES (?, ?, 'story')")
			.bind(locals.user.id, storyId)
			.run();

		throw redirect(302, `/item/${storyId}`);
	}
};
