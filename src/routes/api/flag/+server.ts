import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB, hasFlagged, getFlagCount, getStoryById, getCommentById } from '$lib/server/db';

const KARMA_THRESHOLD = 30;
const DEAD_THRESHOLD = 4; // 5本目（>4）で dead

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	if (!locals.user) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	if (locals.user.karma < KARMA_THRESHOLD) {
		return json({ error: 'Insufficient karma to flag' }, { status: 403 });
	}

	const db = getDB(platform);
	const body = (await request.json()) as { itemId: number; itemType: string };
	const { itemId, itemType } = body;

	if (!itemId || !itemType || !['story', 'comment'].includes(itemType)) {
		return json({ error: 'Invalid request' }, { status: 400 });
	}

	const typed = itemType as 'story' | 'comment';
	const table = typed === 'story' ? 'stories' : 'comments';

	// Check item exists and is not authored by current user
	const item =
		typed === 'story'
			? await getStoryById(db, itemId)
			: await getCommentById(db, itemId);
	if (!item) {
		return json({ error: 'Item not found' }, { status: 404 });
	}
	if (item.user_id === locals.user.id) {
		return json({ error: 'Cannot flag your own post' }, { status: 403 });
	}

	const already = await hasFlagged(db, locals.user.id, itemId, typed);

	if (already) {
		// unflag
		await db
			.prepare('DELETE FROM flags WHERE user_id = ? AND item_id = ? AND item_type = ?')
			.bind(locals.user.id, itemId, typed)
			.run();
	} else {
		await db
			.prepare('INSERT INTO flags (user_id, item_id, item_type) VALUES (?, ?, ?)')
			.bind(locals.user.id, itemId, typed)
			.run();

		// Auto-dead when flag count exceeds threshold
		const count = await getFlagCount(db, itemId, typed);
		if (count > DEAD_THRESHOLD) {
			await db
				.prepare(`UPDATE ${table} SET dead = 1 WHERE id = ?`)
				.bind(itemId)
				.run();
		}
	}

	const newCount = await getFlagCount(db, itemId, typed);
	return json({ flagged: !already, flagCount: newCount });
};
