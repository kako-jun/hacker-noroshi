import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB, getVoteState, getCommentById } from '$lib/server/db';

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	if (!locals.user) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const db = getDB(platform);
	const body = (await request.json()) as { itemId: number; itemType: string; direction?: string };
	const { itemId, itemType } = body;
	const direction = body.direction === 'down' ? 'down' : 'up';

	if (!itemId || !itemType || !['story', 'comment'].includes(itemType)) {
		return json({ error: 'Invalid request' }, { status: 400 });
	}

	// Downvote restrictions
	if (direction === 'down') {
		// Only comments can be downvoted
		if (itemType !== 'comment') {
			return json({ error: 'Stories cannot be downvoted' }, { status: 400 });
		}

		// Karma check
		if (locals.user.karma < 500) {
			return json({ error: 'Insufficient karma for downvoting' }, { status: 403 });
		}

		// Cannot downvote direct replies to own comments
		const comment = await getCommentById(db, itemId);
		if (comment && comment.parent_id) {
			const parentComment = await getCommentById(db, comment.parent_id);
			if (parentComment && parentComment.user_id === locals.user.id) {
				return json({ error: 'Cannot downvote replies to your own comments' }, { status: 403 });
			}
		}
	}

	const currentVote = await getVoteState(db, locals.user.id, itemId, itemType);
	const table = itemType === 'story' ? 'stories' : 'comments';

	// Get author for karma updates
	const authorRow = await db
		.prepare(`SELECT user_id as uid FROM ${table} WHERE id = ?`)
		.bind(itemId)
		.first<{ uid: number }>();

	if (currentVote === null) {
		// No existing vote → add new vote
		await db
			.prepare('INSERT INTO votes (user_id, item_id, item_type, vote_type) VALUES (?, ?, ?, ?)')
			.bind(locals.user.id, itemId, itemType, direction)
			.run();

		const pointsDelta = direction === 'up' ? 1 : -1;
		await db
			.prepare(`UPDATE ${table} SET points = points + ? WHERE id = ?`)
			.bind(pointsDelta, itemId)
			.run();

		if (authorRow) {
			await db
				.prepare('UPDATE users SET karma = karma + ? WHERE id = ?')
				.bind(pointsDelta, authorRow.uid)
				.run();
		}
	} else if (currentVote === direction) {
		// Same direction → remove vote (toggle off)
		await db
			.prepare('DELETE FROM votes WHERE user_id = ? AND item_id = ? AND item_type = ?')
			.bind(locals.user.id, itemId, itemType)
			.run();

		const pointsDelta = direction === 'up' ? -1 : 1;
		await db
			.prepare(`UPDATE ${table} SET points = points + ? WHERE id = ?`)
			.bind(pointsDelta, itemId)
			.run();

		if (authorRow) {
			await db
				.prepare('UPDATE users SET karma = karma + ? WHERE id = ?')
				.bind(pointsDelta, authorRow.uid)
				.run();
		}
	} else {
		// Opposite direction → switch vote
		await db
			.prepare(
				'UPDATE votes SET vote_type = ?, created_at = strftime(\'%Y-%m-%dT%H:%M:%SZ\', \'now\') WHERE user_id = ? AND item_id = ? AND item_type = ?'
			)
			.bind(direction, locals.user.id, itemId, itemType)
			.run();

		const pointsDelta = direction === 'up' ? 2 : -2;
		await db
			.prepare(`UPDATE ${table} SET points = points + ? WHERE id = ?`)
			.bind(pointsDelta, itemId)
			.run();

		if (authorRow) {
			await db
				.prepare('UPDATE users SET karma = karma + ? WHERE id = ?')
				.bind(pointsDelta, authorRow.uid)
				.run();
		}
	}

	// Get updated points
	const row = await db
		.prepare(`SELECT points FROM ${table} WHERE id = ?`)
		.bind(itemId)
		.first<{ points: number }>();

	// Determine new vote state
	let voteState: 'up' | 'down' | null;
	if (currentVote === null) {
		voteState = direction;
	} else if (currentVote === direction) {
		voteState = null;
	} else {
		voteState = direction;
	}

	return json({ voteState, points: row?.points ?? 0 });
};
