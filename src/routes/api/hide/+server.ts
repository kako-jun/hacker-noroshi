import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB, hasHidden, getStoryById } from '$lib/server/db';

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	if (!locals.user) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const db = getDB(platform);
	const body = (await request.json()) as { storyId: number };
	const { storyId } = body;

	if (!storyId || typeof storyId !== 'number') {
		return json({ error: 'Invalid request' }, { status: 400 });
	}

	const story = await getStoryById(db, storyId);
	if (!story) {
		return json({ error: 'Story not found' }, { status: 404 });
	}

	const alreadyHidden = await hasHidden(db, locals.user.id, storyId);

	if (alreadyHidden) {
		await db
			.prepare('DELETE FROM hidden WHERE user_id = ? AND story_id = ?')
			.bind(locals.user.id, storyId)
			.run();
		return json({ hidden: false });
	} else {
		await db
			.prepare('INSERT INTO hidden (user_id, story_id) VALUES (?, ?)')
			.bind(locals.user.id, storyId)
			.run();
		return json({ hidden: true });
	}
};
