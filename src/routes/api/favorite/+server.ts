import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB, hasFavorited } from '$lib/server/db';

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	if (!locals.user) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const db = getDB(platform);
	const body = (await request.json()) as { storyId: number };
	const { storyId } = body;

	if (!storyId) {
		return json({ error: 'Invalid request' }, { status: 400 });
	}

	const alreadyFavorited = await hasFavorited(db, locals.user.id, storyId);

	if (alreadyFavorited) {
		await db
			.prepare('DELETE FROM favorites WHERE user_id = ? AND story_id = ?')
			.bind(locals.user.id, storyId)
			.run();
		return json({ favorited: false });
	} else {
		await db
			.prepare('INSERT INTO favorites (user_id, story_id) VALUES (?, ?)')
			.bind(locals.user.id, storyId)
			.run();
		return json({ favorited: true });
	}
};
