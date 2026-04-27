import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB, hasFlagged, getFlagCount, getStoryById, getCommentById } from '$lib/server/db';
import { FLAG_KARMA_THRESHOLD, DEAD_FLAG_THRESHOLD } from '$lib/constants';

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	if (!locals.user) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	if (locals.user.karma < FLAG_KARMA_THRESHOLD) {
		return json({ error: 'Insufficient karma to flag' }, { status: 403 });
	}

	const db = getDB(platform);
	const body = (await request.json()) as { itemId: unknown; itemType: unknown };
	const itemId = Number(body.itemId);
	const itemType = body.itemType;

	if (!Number.isInteger(itemId) || itemId <= 0) {
		return json({ error: 'Invalid itemId' }, { status: 400 });
	}
	if (itemType !== 'story' && itemType !== 'comment') {
		return json({ error: 'Invalid itemType' }, { status: 400 });
	}

	const typed = itemType;
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

	// 既に dead のアイテムへの新規 flag は無意味なので拒否（unflag は許可）
	if (!already && item.dead === 1) {
		return json({ error: 'Item is already dead' }, { status: 400 });
	}

	let dead = item.dead === 1;

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
		if (count > DEAD_FLAG_THRESHOLD && !dead) {
			await db
				.prepare(`UPDATE ${table} SET dead = 1 WHERE id = ?`)
				.bind(itemId)
				.run();
			dead = true;
		}
	}

	const newCount = await getFlagCount(db, itemId, typed);
	return json({ flagged: !already, flagCount: newCount, dead });
};
