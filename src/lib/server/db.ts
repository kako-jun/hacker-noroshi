export function getDB(platform: App.Platform | undefined): D1Database {
	if (!platform?.env?.DB) {
		throw new Error(
			'D1 database not available. Make sure you are running with wrangler: npx wrangler pages dev'
		);
	}
	return platform.env.DB;
}

export interface StoryRow {
	id: number;
	title: string;
	url: string | null;
	text: string | null;
	user_id: number;
	points: number;
	comment_count: number;
	type: string;
	created_at: string;
	username: string;
	user_created_at: string;
}

export interface CommentRow {
	id: number;
	text: string;
	user_id: number;
	story_id: number;
	parent_id: number | null;
	points: number;
	created_at: string;
	username: string;
	user_created_at: string;
}

export interface UserRow {
	id: number;
	username: string;
	password_hash: string;
	karma: number;
	about: string;
	email: string;
	delay: number;
	noprocrast: number;
	maxvisit: number;
	minaway: number;
	showdead: number;
	last_visit: string | null;
	created_at: string;
}

export interface SessionRow {
	id: string;
	user_id: number;
	expires_at: string;
}

export async function getStories(
	db: D1Database,
	options: {
		type?: string;
		orderBy?: 'rank' | 'newest' | 'best';
		page?: number;
		limit?: number;
	} = {}
): Promise<StoryRow[]> {
	const { type, orderBy = 'rank', page = 1, limit = 30 } = options;
	const offset = (page - 1) * limit;

	let whereClause = '';
	const params: (string | number)[] = [];

	if (type) {
		whereClause = 'WHERE s.type = ?';
		params.push(type);
	}

	if (orderBy === 'best') {
		const sql = `
			SELECT s.*, u.username, u.created_at as user_created_at
			FROM stories s
			JOIN users u ON s.user_id = u.id
			${whereClause}
			ORDER BY s.points DESC, s.created_at DESC
			LIMIT ? OFFSET ?
		`;
		params.push(limit, offset);
		const result = await db.prepare(sql).bind(...params).all<StoryRow>();
		return result.results;
	}

	if (orderBy === 'newest') {
		const sql = `
			SELECT s.*, u.username, u.created_at as user_created_at
			FROM stories s
			JOIN users u ON s.user_id = u.id
			${whereClause}
			ORDER BY s.created_at DESC
			LIMIT ? OFFSET ?
		`;
		params.push(limit, offset);
		const result = await db.prepare(sql).bind(...params).all<StoryRow>();
		return result.results;
	}

	// Rank mode: fetch recent stories, sort by HN algorithm in JS
	const fetchLimit = 500;
	const sql = `
		SELECT s.*, u.username, u.created_at as user_created_at
		FROM stories s
		JOIN users u ON s.user_id = u.id
		${whereClause}
		ORDER BY s.created_at DESC
		LIMIT ?
	`;
	params.push(fetchLimit);
	const result = await db.prepare(sql).bind(...params).all<StoryRow>();
	const now = Date.now();
	const ranked = result.results
		.map((s) => {
			const hoursAge = (now - new Date(s.created_at).getTime()) / (1000 * 60 * 60);
			const score = (s.points - 1) / Math.pow(hoursAge + 2, 1.8);
			return { ...s, _score: score };
		})
		.sort((a, b) => b._score - a._score)
		.slice(offset, offset + limit);
	return ranked;
}

export async function getFrontPageStories(
	db: D1Database,
	day: string,
	page: number = 1,
	limit: number = 30
): Promise<StoryRow[]> {
	const offset = (page - 1) * limit;
	const dayStart = `${day}T00:00:00.000Z`;
	const dayEnd = `${day}T23:59:59.999Z`;

	const fetchLimit = 500;
	const sql = `
		SELECT s.*, u.username, u.created_at as user_created_at
		FROM stories s
		JOIN users u ON s.user_id = u.id
		WHERE s.created_at >= ? AND s.created_at <= ?
		ORDER BY s.created_at DESC
		LIMIT ?
	`;
	const result = await db.prepare(sql).bind(dayStart, dayEnd, fetchLimit).all<StoryRow>();

	const now = Date.now();
	const ranked = result.results
		.map((s) => {
			const hoursAge = (now - new Date(s.created_at).getTime()) / (1000 * 60 * 60);
			const score = (s.points - 1) / Math.pow(hoursAge + 2, 1.8);
			return { ...s, _score: score };
		})
		.sort((a, b) => b._score - a._score)
		.slice(offset, offset + limit);
	return ranked;
}

export async function getStoryById(db: D1Database, id: number): Promise<StoryRow | null> {
	const result = await db
		.prepare(
			`SELECT s.*, u.username, u.created_at as user_created_at
			FROM stories s
			JOIN users u ON s.user_id = u.id
			WHERE s.id = ?`
		)
		.bind(id)
		.first<StoryRow>();
	return result;
}

export async function getCommentsByStoryId(
	db: D1Database,
	storyId: number,
	currentUserId?: number
): Promise<CommentRow[]> {
	const result = await db
		.prepare(
			`SELECT c.*, u.username, u.created_at as user_created_at, u.delay as author_delay
			FROM comments c
			JOIN users u ON c.user_id = u.id
			WHERE c.story_id = ?
			ORDER BY c.created_at ASC`
		)
		.bind(storyId)
		.all<CommentRow & { author_delay: number }>();

	const now = Date.now();
	return result.results.filter((c) => {
		if (c.user_id === currentUserId) return true;
		if (c.author_delay <= 0) return true;
		const visibleAt = new Date(c.created_at).getTime() + c.author_delay * 60 * 1000;
		return now >= visibleAt;
	});
}

export async function getUserByUsername(db: D1Database, username: string): Promise<UserRow | null> {
	return db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first<UserRow>();
}

export async function getUserById(db: D1Database, id: number): Promise<UserRow | null> {
	return db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
}

export async function getStoriesByUserId(
	db: D1Database,
	userId: number,
	page: number = 1,
	limit: number = 30
): Promise<StoryRow[]> {
	const offset = (page - 1) * limit;
	const result = await db
		.prepare(
			`SELECT s.*, u.username, u.created_at as user_created_at
			FROM stories s
			JOIN users u ON s.user_id = u.id
			WHERE s.user_id = ?
			ORDER BY s.created_at DESC
			LIMIT ? OFFSET ?`
		)
		.bind(userId, limit, offset)
		.all<StoryRow>();
	return result.results;
}

export async function getVoteState(
	db: D1Database,
	userId: number,
	itemId: number,
	itemType: string
): Promise<'up' | 'down' | null> {
	const result = await db
		.prepare('SELECT vote_type FROM votes WHERE user_id = ? AND item_id = ? AND item_type = ?')
		.bind(userId, itemId, itemType)
		.first<{ vote_type: string }>();
	if (!result) return null;
	return result.vote_type as 'up' | 'down';
}

export async function getVotedStoryIds(
	db: D1Database,
	userId: number,
	storyIds: number[]
): Promise<Set<number>> {
	if (storyIds.length === 0) return new Set();
	const placeholders = storyIds.map(() => '?').join(',');
	const result = await db
		.prepare(
			`SELECT item_id FROM votes WHERE user_id = ? AND item_type = 'story' AND vote_type = 'up' AND item_id IN (${placeholders})`
		)
		.bind(userId, ...storyIds)
		.all<{ item_id: number }>();
	return new Set(result.results.map((r) => r.item_id));
}

export async function getCommentsByUserId(
	db: D1Database,
	userId: number,
	page: number = 1,
	limit: number = 30,
	currentUserId?: number
): Promise<(CommentRow & { story_title: string })[]> {
	const offset = (page - 1) * limit;
	const result = await db
		.prepare(
			`SELECT c.*, u.username, u.created_at as user_created_at, u.delay as author_delay, s.title as story_title
			FROM comments c
			JOIN users u ON c.user_id = u.id
			JOIN stories s ON c.story_id = s.id
			WHERE c.user_id = ?
			ORDER BY c.created_at DESC
			LIMIT ? OFFSET ?`
		)
		.bind(userId, limit, offset)
		.all<CommentRow & { story_title: string; author_delay: number }>();

	// If viewing own comments, show all; otherwise filter by delay
	if (userId === currentUserId) {
		return result.results;
	}

	const now = Date.now();
	return result.results.filter((c) => {
		if (c.author_delay <= 0) return true;
		const visibleAt = new Date(c.created_at).getTime() + c.author_delay * 60 * 1000;
		return now >= visibleAt;
	});
}

export async function getCommentById(db: D1Database, id: number): Promise<CommentRow | null> {
	const result = await db
		.prepare(
			`SELECT c.*, u.username, u.created_at as user_created_at
			FROM comments c
			JOIN users u ON c.user_id = u.id
			WHERE c.id = ?`
		)
		.bind(id)
		.first<CommentRow>();
	return result;
}

export async function getChildComments(
	db: D1Database,
	commentId: number,
	storyId: number,
	currentUserId?: number
): Promise<CommentRow[]> {
	// TODO: D1が再帰CTEに対応したらWITH RECURSIVEで直接子孫を取得する
	// 現状はストーリー全コメントを取得してJSでBFSフィルタ
	const all = await getCommentsByStoryId(db, storyId, currentUserId);
	const childIds = new Set<number>();
	const queue = [commentId];
	while (queue.length > 0) {
		const parentId = queue.shift()!;
		for (const c of all) {
			if (c.parent_id === parentId && !childIds.has(c.id)) {
				childIds.add(c.id);
				queue.push(c.id);
			}
		}
	}
	return all.filter((c) => childIds.has(c.id));
}

export async function getCommentVoteStates(
	db: D1Database,
	userId: number,
	commentIds: number[]
): Promise<Map<number, 'up' | 'down'>> {
	if (commentIds.length === 0) return new Map();
	const placeholders = commentIds.map(() => '?').join(',');
	const result = await db
		.prepare(
			`SELECT item_id, vote_type FROM votes WHERE user_id = ? AND item_type = 'comment' AND item_id IN (${placeholders})`
		)
		.bind(userId, ...commentIds)
		.all<{ item_id: number; vote_type: string }>();
	const map = new Map<number, 'up' | 'down'>();
	for (const r of result.results) {
		map.set(r.item_id, r.vote_type as 'up' | 'down');
	}
	return map;
}

export async function getActiveStories(
	db: D1Database,
	page: number = 1,
	limit: number = 30
): Promise<StoryRow[]> {
	const offset = (page - 1) * limit;
	const sql = `
		SELECT s.*, u.username, u.created_at as user_created_at
		FROM stories s
		JOIN users u ON s.user_id = u.id
		JOIN comments c ON c.story_id = s.id
		GROUP BY s.id
		ORDER BY MAX(c.created_at) DESC
		LIMIT ? OFFSET ?
	`;
	const result = await db.prepare(sql).bind(limit, offset).all<StoryRow>();
	return result.results;
}

export async function hasFavorited(
	db: D1Database,
	userId: number,
	storyId: number
): Promise<boolean> {
	const result = await db
		.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND story_id = ?')
		.bind(userId, storyId)
		.first();
	return result !== null;
}

export async function getFavoriteStoryIds(
	db: D1Database,
	userId: number,
	storyIds: number[]
): Promise<Set<number>> {
	if (storyIds.length === 0) return new Set();
	const placeholders = storyIds.map(() => '?').join(',');
	const result = await db
		.prepare(
			`SELECT story_id FROM favorites WHERE user_id = ? AND story_id IN (${placeholders})`
		)
		.bind(userId, ...storyIds)
		.all<{ story_id: number }>();
	return new Set(result.results.map((r) => r.story_id));
}

export async function getFavoriteStoriesByUserId(
	db: D1Database,
	userId: number,
	page: number = 1,
	limit: number = 30
): Promise<StoryRow[]> {
	const offset = (page - 1) * limit;
	const result = await db
		.prepare(
			`SELECT s.*, u.username, u.created_at as user_created_at
			FROM favorites f
			JOIN stories s ON f.story_id = s.id
			JOIN users u ON s.user_id = u.id
			WHERE f.user_id = ?
			ORDER BY f.created_at DESC
			LIMIT ? OFFSET ?`
		)
		.bind(userId, limit, offset)
		.all<StoryRow>();
	return result.results;
}

export async function hasHidden(
	db: D1Database,
	userId: number,
	storyId: number
): Promise<boolean> {
	const result = await db
		.prepare('SELECT 1 FROM hidden WHERE user_id = ? AND story_id = ?')
		.bind(userId, storyId)
		.first();
	return result !== null;
}

export async function getHiddenStoryIds(
	db: D1Database,
	userId: number
): Promise<Set<number>> {
	const result = await db
		.prepare('SELECT story_id FROM hidden WHERE user_id = ?')
		.bind(userId)
		.all<{ story_id: number }>();
	return new Set(result.results.map((r) => r.story_id));
}

export async function getHiddenStoriesByUserId(
	db: D1Database,
	userId: number,
	page: number = 1,
	limit: number = 30
): Promise<StoryRow[]> {
	const offset = (page - 1) * limit;
	const result = await db
		.prepare(
			`SELECT s.*, u.username, u.created_at as user_created_at
			FROM hidden h
			JOIN stories s ON h.story_id = s.id
			JOIN users u ON s.user_id = u.id
			WHERE h.user_id = ?
			ORDER BY h.created_at DESC
			LIMIT ? OFFSET ?`
		)
		.bind(userId, limit, offset)
		.all<StoryRow>();
	return result.results;
}

function escapeLikePattern(input: string): string {
	return input.replace(/[%_\\]/g, '\\$&');
}

export async function searchStories(
	db: D1Database,
	query: string,
	page: number = 1,
	limit: number = 30
): Promise<StoryRow[]> {
	const offset = (page - 1) * limit;
	const pattern = `%${escapeLikePattern(query)}%`;
	const sql = `
		SELECT s.*, u.username, u.created_at as user_created_at
		FROM stories s
		JOIN users u ON s.user_id = u.id
		WHERE s.title LIKE ? ESCAPE '\\' OR s.url LIKE ? ESCAPE '\\' OR s.text LIKE ? ESCAPE '\\'
		ORDER BY s.created_at DESC
		LIMIT ? OFFSET ?
	`;
	const result = await db.prepare(sql).bind(pattern, pattern, pattern, limit, offset).all<StoryRow>();
	return result.results;
}

export async function searchComments(
	db: D1Database,
	query: string,
	page: number = 1,
	limit: number = 30
): Promise<(CommentRow & { story_title: string })[]> {
	const offset = (page - 1) * limit;
	const pattern = `%${escapeLikePattern(query)}%`;
	const sql = `
		SELECT c.*, u.username, u.created_at as user_created_at, s.title as story_title
		FROM comments c
		JOIN users u ON c.user_id = u.id
		JOIN stories s ON c.story_id = s.id
		WHERE c.text LIKE ? ESCAPE '\\'
		ORDER BY c.created_at DESC
		LIMIT ? OFFSET ?
	`;
	const result = await db
		.prepare(sql)
		.bind(pattern, limit, offset)
		.all<CommentRow & { story_title: string }>();
	return result.results;
}

export async function getRecentComments(
	db: D1Database,
	page: number = 1,
	limit: number = 30,
	currentUserId?: number
): Promise<(CommentRow & { story_title: string })[]> {
	// Fetch extra rows to account for delay-filtered ones
	const fetchLimit = limit * 3;
	const offset = (page - 1) * limit;
	const result = await db
		.prepare(
			`SELECT c.*, u.username, u.created_at as user_created_at, u.delay as author_delay, s.title as story_title
			FROM comments c
			JOIN users u ON c.user_id = u.id
			JOIN stories s ON c.story_id = s.id
			ORDER BY c.created_at DESC
			LIMIT ? OFFSET ?`
		)
		.bind(fetchLimit, offset)
		.all<CommentRow & { story_title: string; author_delay: number }>();

	const now = Date.now();
	const filtered = result.results.filter((c) => {
		if (c.user_id === currentUserId) return true;
		if (c.author_delay <= 0) return true;
		const visibleAt = new Date(c.created_at).getTime() + c.author_delay * 60 * 1000;
		return now >= visibleAt;
	});
	return filtered.slice(0, limit);
}
