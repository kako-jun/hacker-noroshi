import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB, getStoryById, getCommentById } from '$lib/server/db';

const KARMA_THRESHOLD = 30;

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	if (!locals.user) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	if (locals.user.karma < KARMA_THRESHOLD) {
		return json({ error: 'Insufficient karma to vouch' }, { status: 403 });
	}

	const db = getDB(platform);
	const body = (await request.json()) as { itemId: number; itemType: string };
	const { itemId, itemType } = body;

	if (!itemId || !itemType || !['story', 'comment'].includes(itemType)) {
		return json({ error: 'Invalid request' }, { status: 400 });
	}

	const typed = itemType as 'story' | 'comment';
	const table = typed === 'story' ? 'stories' : 'comments';

	const item =
		typed === 'story'
			? await getStoryById(db, itemId)
			: await getCommentById(db, itemId);
	if (!item) {
		return json({ error: 'Item not found' }, { status: 404 });
	}
	if (!item.dead) {
		return json({ error: 'Item is not dead' }, { status: 400 });
	}
	if (item.user_id === locals.user.id) {
		return json({ error: 'Cannot vouch your own post' }, { status: 403 });
	}

	// Revive: set dead=0 and clear all flags so the item cannot be re-killed by stale flags
	await db.batch([
		db.prepare(`UPDATE ${table} SET dead = 0 WHERE id = ?`).bind(itemId),
		db
			.prepare('DELETE FROM flags WHERE item_id = ? AND item_type = ?')
			.bind(itemId, typed)
	]);

	return json({ vouched: true });
};
