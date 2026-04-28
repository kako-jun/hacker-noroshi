import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB, getVoteState, getCommentById, getPollOptionById } from '$lib/server/db';

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	if (!locals.user) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const db = getDB(platform);
	const body = (await request.json()) as { itemId: number; itemType: string; direction?: string };
	const { itemId, itemType } = body;
	const direction = body.direction === 'down' ? 'down' : 'up';

	if (!itemId || !itemType || !['story', 'comment', 'poll_option'].includes(itemType)) {
		return json({ error: 'Invalid request' }, { status: 400 });
	}

	// poll_option の場合は実在確認 + type='poll' の story に紐づくことを検証する。
	// poll_option は points/karma カラムを持たないため、独自の分岐で処理する。
	if (itemType === 'poll_option') {
		if (direction === 'down') {
			return json({ error: 'Poll options cannot be downvoted' }, { status: 400 });
		}
		const option = await getPollOptionById(db, itemId);
		if (!option) {
			return json({ error: 'Poll option not found' }, { status: 404 });
		}
		const currentVote = await getVoteState(db, locals.user.id, itemId, 'poll_option');
		// INSERT/DELETE と COUNT を D1 batch で一括化して原子性を保つ
		// （部分失敗で UI と DB が乖離するのを防ぐ）。
		const mutateStmt =
			currentVote === null
				? db
						.prepare(
							"INSERT INTO votes (user_id, item_id, item_type, vote_type) VALUES (?, ?, 'poll_option', 'up')"
						)
						.bind(locals.user.id, itemId)
				: db
						.prepare(
							"DELETE FROM votes WHERE user_id = ? AND item_id = ? AND item_type = 'poll_option'"
						)
						.bind(locals.user.id, itemId);
		const countStmt = db
			.prepare(
				"SELECT COUNT(*) as n FROM votes WHERE item_id = ? AND item_type = 'poll_option' AND vote_type = 'up'"
			)
			.bind(itemId);
		const batchResults = await db.batch<{ n: number }>([mutateStmt, countStmt]);
		const countRow = batchResults[1].results?.[0];
		const newState = currentVote === null ? 'up' : null;
		return json({ voteState: newState, points: countRow?.n ?? 0 });
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

		// Cannot downvote own comments
		const comment = await getCommentById(db, itemId);
		if (comment && comment.user_id === locals.user.id) {
			return json({ error: 'Cannot downvote your own comments' }, { status: 403 });
		}

		// Cannot downvote direct replies to own comments
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
		// No existing vote → add new vote (points and karma move together)
		const delta = direction === 'up' ? 1 : -1;
		const stmts = [
			db.prepare('INSERT INTO votes (user_id, item_id, item_type, vote_type) VALUES (?, ?, ?, ?)')
				.bind(locals.user.id, itemId, itemType, direction),
			db.prepare(`UPDATE ${table} SET points = points + ? WHERE id = ?`)
				.bind(delta, itemId)
		];
		if (authorRow) {
			stmts.push(
				db.prepare('UPDATE users SET karma = karma + ? WHERE id = ?')
					.bind(delta, authorRow.uid)
			);
		}
		await db.batch(stmts);
	} else if (currentVote === direction) {
		// Same direction → remove vote (undo: points and karma move together)
		const delta = direction === 'up' ? -1 : 1;
		const stmts = [
			db.prepare('DELETE FROM votes WHERE user_id = ? AND item_id = ? AND item_type = ?')
				.bind(locals.user.id, itemId, itemType),
			db.prepare(`UPDATE ${table} SET points = points + ? WHERE id = ?`)
				.bind(delta, itemId)
		];
		if (authorRow) {
			stmts.push(
				db.prepare('UPDATE users SET karma = karma + ? WHERE id = ?')
					.bind(delta, authorRow.uid)
			);
		}
		await db.batch(stmts);
	} else {
		// Opposite direction → switch vote (±2: undo old + apply new, points and karma move together)
		const delta = direction === 'up' ? 2 : -2;
		const stmts = [
			db.prepare(
				'UPDATE votes SET vote_type = ?, created_at = strftime(\'%Y-%m-%dT%H:%M:%SZ\', \'now\') WHERE user_id = ? AND item_id = ? AND item_type = ?'
			).bind(direction, locals.user.id, itemId, itemType),
			db.prepare(`UPDATE ${table} SET points = points + ? WHERE id = ?`)
				.bind(delta, itemId)
		];
		if (authorRow) {
			stmts.push(
				db.prepare('UPDATE users SET karma = karma + ? WHERE id = ?')
					.bind(delta, authorRow.uid)
			);
		}
		await db.batch(stmts);
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
