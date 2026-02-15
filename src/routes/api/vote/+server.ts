import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB, hasVoted } from '$lib/server/db';

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	if (!locals.user) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const db = getDB(platform);
	const body = (await request.json()) as { itemId: number; itemType: string };
	const { itemId, itemType } = body;

	if (!itemId || !itemType || !['story', 'comment'].includes(itemType)) {
		return json({ error: 'Invalid request' }, { status: 400 });
	}

	const alreadyVoted = await hasVoted(db, locals.user.id, itemId, itemType);

	if (alreadyVoted) {
		// Remove vote
		await db
			.prepare('DELETE FROM votes WHERE user_id = ? AND item_id = ? AND item_type = ?')
			.bind(locals.user.id, itemId, itemType)
			.run();

		// Decrement points
		const table = itemType === 'story' ? 'stories' : 'comments';
		await db
			.prepare(`UPDATE ${table} SET points = points - 1 WHERE id = ?`)
			.bind(itemId)
			.run();

		// Get updated points
		const row = await db
			.prepare(`SELECT points FROM ${table} WHERE id = ?`)
			.bind(itemId)
			.first<{ points: number }>();

		// Update karma for the item's author
		const authorRow = await db
			.prepare(`SELECT user_id as uid FROM ${table} WHERE id = ?`)
			.bind(itemId)
			.first<{ uid: number }>();
		if (authorRow) {
			await db
				.prepare('UPDATE users SET karma = karma - 1 WHERE id = ?')
				.bind(authorRow.uid)
				.run();
		}

		return json({ voted: false, points: row?.points ?? 0 });
	} else {
		// Add vote
		await db
			.prepare('INSERT INTO votes (user_id, item_id, item_type) VALUES (?, ?, ?)')
			.bind(locals.user.id, itemId, itemType)
			.run();

		// Increment points
		const table = itemType === 'story' ? 'stories' : 'comments';
		await db
			.prepare(`UPDATE ${table} SET points = points + 1 WHERE id = ?`)
			.bind(itemId)
			.run();

		// Get updated points
		const row = await db
			.prepare(`SELECT points FROM ${table} WHERE id = ?`)
			.bind(itemId)
			.first<{ points: number }>();

		// Update karma for the item's author
		const authorRow = await db
			.prepare(`SELECT user_id as uid FROM ${table} WHERE id = ?`)
			.bind(itemId)
			.first<{ uid: number }>();
		if (authorRow) {
			await db
				.prepare('UPDATE users SET karma = karma + 1 WHERE id = ?')
				.bind(authorRow.uid)
				.run();
		}

		return json({ voted: true, points: row?.points ?? 1 });
	}
};
