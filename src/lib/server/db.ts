import { nowIsoSeconds } from '../format';

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
	dead: number;
	created_at: string;
	username: string;
	user_created_at: string;
	user_deleted?: number;
	flag_count?: number;
}

export interface CommentRow {
	id: number;
	text: string;
	user_id: number;
	story_id: number;
	parent_id: number | null;
	points: number;
	dead: number;
	created_at: string;
	username: string;
	user_created_at: string;
	user_deleted?: number;
	flag_count?: number;
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
	deleted: number;
	deleted_at: string | null;
	is_admin: number;
}

// IP ban の行型（#77）。expires_at が NULL のときは無期限 ban、
// 未来の ISO8601 文字列のときは時限 ban、過去のときは active ではない（自動失効）。
export interface IpBanRow {
	id: number;
	ip: string;
	reason: string;
	banned_at: string;
	expires_at: string | null;
	banned_by: number | null;
}

export interface PollOptionRow {
	id: number;
	story_id: number;
	text: string;
	position: number;
	created_at: string;
	vote_count: number;
}

export interface SessionRow {
	id: string;
	user_id: number;
	expires_at: string;
}

const STORY_FLAG_COUNT_SQL = `(SELECT COUNT(*) FROM flags WHERE flags.item_id = s.id AND flags.item_type = 'story') AS flag_count`;
const COMMENT_FLAG_COUNT_SQL = `(SELECT COUNT(*) FROM flags WHERE flags.item_id = c.id AND flags.item_type = 'comment') AS flag_count`;

export async function getStories(
	db: D1Database,
	options: {
		type?: string;
		orderBy?: 'rank' | 'newest' | 'best';
		page?: number;
		limit?: number;
		showdead?: boolean;
	} = {}
): Promise<StoryRow[]> {
	const { type, orderBy = 'rank', page = 1, limit = 30, showdead = false } = options;
	const offset = (page - 1) * limit;

	const conds: string[] = [];
	const params: (string | number)[] = [];

	if (type) {
		conds.push('s.type = ?');
		params.push(type);
	}
	if (!showdead) {
		conds.push('s.dead = 0');
	}
	const whereClause = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';

	if (orderBy === 'best') {
		const sql = `
			SELECT s.*, u.username, u.created_at as user_created_at, u.deleted as user_deleted, ${STORY_FLAG_COUNT_SQL}
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
			SELECT s.*, u.username, u.created_at as user_created_at, u.deleted as user_deleted, ${STORY_FLAG_COUNT_SQL}
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
		SELECT s.*, u.username, u.created_at as user_created_at, u.deleted as user_deleted, ${STORY_FLAG_COUNT_SQL}
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
			const flagPenalty = Math.pow((s.flag_count ?? 0) + 1, 1.5);
			const score = ((s.points - 1) / Math.pow(hoursAge + 2, 1.8)) / flagPenalty;
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
	limit: number = 30,
	showdead: boolean = false
): Promise<StoryRow[]> {
	const offset = (page - 1) * limit;
	const dayStart = `${day}T00:00:00.000Z`;
	const dayEnd = `${day}T23:59:59.999Z`;

	const fetchLimit = 500;
	const deadFilter = showdead ? '' : 'AND s.dead = 0';
	const sql = `
		SELECT s.*, u.username, u.created_at as user_created_at, u.deleted as user_deleted, ${STORY_FLAG_COUNT_SQL}
		FROM stories s
		JOIN users u ON s.user_id = u.id
		WHERE s.created_at >= ? AND s.created_at <= ? ${deadFilter}
		ORDER BY s.created_at DESC
		LIMIT ?
	`;
	const result = await db.prepare(sql).bind(dayStart, dayEnd, fetchLimit).all<StoryRow>();

	const now = Date.now();
	const ranked = result.results
		.map((s) => {
			const hoursAge = (now - new Date(s.created_at).getTime()) / (1000 * 60 * 60);
			const flagPenalty = Math.pow((s.flag_count ?? 0) + 1, 1.5);
			const score = ((s.points - 1) / Math.pow(hoursAge + 2, 1.8)) / flagPenalty;
			return { ...s, _score: score };
		})
		.sort((a, b) => b._score - a._score)
		.slice(offset, offset + limit);
	return ranked;
}

export async function getStoryById(db: D1Database, id: number): Promise<StoryRow | null> {
	const result = await db
		.prepare(
			`SELECT s.*, u.username, u.created_at as user_created_at, u.deleted as user_deleted, ${STORY_FLAG_COUNT_SQL}
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
	currentUserId?: number,
	showdead: boolean = false
): Promise<CommentRow[]> {
	const deadFilter = showdead ? '' : 'AND c.dead = 0';
	const result = await db
		.prepare(
			`SELECT c.*, u.username, u.created_at as user_created_at, u.deleted as user_deleted, u.delay as author_delay, ${COMMENT_FLAG_COUNT_SQL}
			FROM comments c
			JOIN users u ON c.user_id = u.id
			WHERE c.story_id = ? ${deadFilter}
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

// username 変更の頻度制限（90日に1回）。本家HN FAQ #31 相当の運用に合わせる。
// UTC ベースの ms 差で判定。閏秒・DST 非依存（new Date().getTime() の差分比較）。
export const USERNAME_CHANGE_COOLDOWN_DAYS = 90;
export const USERNAME_CHANGE_COOLDOWN_MS = USERNAME_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

// signup と共通のユーザー名バリデーション。signup 側 (src/routes/login/+page.server.ts) と
// 規則を必ず一致させること。
export function validateUsernameFormat(username: string): string | null {
	if (!username) return 'Username is required';
	if (username.length < 3 || username.length > 15) {
		return 'Username must be between 3 and 15 characters';
	}
	if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
		return 'Username can only contain letters, numbers, underscores, and hyphens';
	}
	return null;
}

// users.username と username_history.old_username の両方を見て、過去に使われた
// 名前も含めて重複判定する（履歴も永久ロック）。1 クエリ（UNION ALL）でラウンドトリップを削減。
// 削除済みユーザー (users.deleted = 1) も username 行は残るため UNIQUE 制約で
// 自動的にロックされ、再取得は不可能。本家HN FAQ #32 相当の永久ロック挙動。
export async function isUsernameTaken(db: D1Database, username: string): Promise<boolean> {
	const r = await db
		.prepare(
			`SELECT 1 AS hit FROM users WHERE username = ?
			UNION ALL
			SELECT 1 AS hit FROM username_history WHERE old_username = ?
			LIMIT 1`
		)
		.bind(username, username)
		.first<{ hit: number }>();
	return r !== null;
}

// 旧 username から最新の new_username を返す。同じ old_username が複数あれば
// 最新の changed_at を採用する。連鎖変更（A→B→C）は while ループで辿る。
// 循環履歴や深すぎる連鎖（壊れたデータ）でも無限ループにならないよう、
// 訪問済み Set + 深さ上限 10 で停止する。
const USERNAME_REDIRECT_MAX_DEPTH = 10;
export async function getOldUsernameRedirect(
	db: D1Database,
	oldUsername: string
): Promise<string | null> {
	const visited = new Set<string>();
	let current = oldUsername;
	let result: string | null = null;
	for (let i = 0; i < USERNAME_REDIRECT_MAX_DEPTH; i++) {
		if (visited.has(current)) {
			// 循環検出。リダイレクト先が現存しない可能性が高いため null を返し、
			// 呼び出し側を 404 に倒す（壊れた履歴データに対する防御）
			return null;
		}
		visited.add(current);
		const row = await db
			.prepare(
				`SELECT new_username FROM username_history
				WHERE old_username = ?
				ORDER BY changed_at DESC LIMIT 1`
			)
			.bind(current)
			.first<{ new_username: string }>();
		if (!row) break;
		result = row.new_username;
		current = row.new_username;
	}
	return result;
}

// 該当ユーザーの最後の username 変更時刻（ISO8601）。なければ null。
export async function getLastUsernameChange(
	db: D1Database,
	userId: number
): Promise<string | null> {
	const row = await db
		.prepare(
			`SELECT changed_at FROM username_history
			WHERE user_id = ?
			ORDER BY changed_at DESC LIMIT 1`
		)
		.bind(userId)
		.first<{ changed_at: string }>();
	return row?.changed_at ?? null;
}

// users.username を更新し、username_history に旧 username を記録する。
// D1 はトランザクションを batch で表現する。
// users.username は UNIQUE 制約があるため、isUsernameTaken のチェックと
// batch 実行の間に他リクエストが同名を取得した場合は UNIQUE 違反で失敗する。
// 呼び出し側はエラーメッセージに 'UNIQUE' を含むかで race を検出する。
export async function updateUsername(
	db: D1Database,
	userId: number,
	oldUsername: string,
	newUsername: string
): Promise<void> {
	await db.batch([
		db
			.prepare('UPDATE users SET username = ? WHERE id = ?')
			.bind(newUsername, userId),
		db
			.prepare(
				'INSERT INTO username_history (user_id, old_username, new_username) VALUES (?, ?, ?)'
			)
			.bind(userId, oldUsername, newUsername)
	]);
}

// updateUsername が UNIQUE 制約違反（同時取得レース）で失敗したかを判定する。
// D1 / SQLite のエラーメッセージに 'UNIQUE' を含むかで判定。
export function isUsernameUniqueConstraintError(err: unknown): boolean {
	if (!(err instanceof Error)) return false;
	return /UNIQUE/i.test(err.message) && /username/i.test(err.message);
}

export async function getUserById(db: D1Database, id: number): Promise<UserRow | null> {
	return db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
}

// アカウント削除（#76）。本家HN FAQ #32 相当のセルフサービス削除。
// 投稿・コメントはスレッド整合性のため保持し、users 行も username の永久ロックのため保持する。
// 個人情報フィールド (email, about, password_hash) を空にし、
// 設定系 (delay, noprocrast, maxvisit, minaway, showdead) をデフォルトに戻し、
// deleted=1 / deleted_at=now を立てる。同時に sessions を全削除して即時ログアウト。
// D1 batch でシリアル実行（部分失敗時はクライアント側で再試行可能）。
// 順序は sessions DELETE → users UPDATE。
// 部分失敗時に「セッション残存だが削除済み」より「再ログイン強制（実質ログアウト済み）」の方が安全側。
export async function deleteAccount(db: D1Database, userId: number): Promise<void> {
	const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
	await db.batch([
		db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId),
		db
			.prepare(
				`UPDATE users SET
					deleted = 1,
					deleted_at = ?,
					email = '',
					about = '',
					password_hash = '',
					delay = 0,
					noprocrast = 0,
					maxvisit = 20,
					minaway = 180,
					showdead = 0,
					last_visit = NULL
				WHERE id = ?`
			)
			.bind(nowIso, userId)
	]);
}

export async function getStoriesByUserId(
	db: D1Database,
	userId: number,
	page: number = 1,
	limit: number = 30,
	showdead: boolean = false
): Promise<StoryRow[]> {
	const offset = (page - 1) * limit;
	const deadFilter = showdead ? '' : 'AND s.dead = 0';
	const result = await db
		.prepare(
			`SELECT s.*, u.username, u.created_at as user_created_at, u.deleted as user_deleted, ${STORY_FLAG_COUNT_SQL}
			FROM stories s
			JOIN users u ON s.user_id = u.id
			WHERE s.user_id = ? ${deadFilter}
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
	currentUserId?: number,
	showdead: boolean = false
): Promise<(CommentRow & { story_title: string })[]> {
	const offset = (page - 1) * limit;
	const deadFilter = showdead ? '' : 'AND c.dead = 0';
	const result = await db
		.prepare(
			`SELECT c.*, u.username, u.created_at as user_created_at, u.deleted as user_deleted, u.delay as author_delay, s.title as story_title, ${COMMENT_FLAG_COUNT_SQL}
			FROM comments c
			JOIN users u ON c.user_id = u.id
			JOIN stories s ON c.story_id = s.id
			WHERE c.user_id = ? ${deadFilter}
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
			`SELECT c.*, u.username, u.created_at as user_created_at, u.deleted as user_deleted, ${COMMENT_FLAG_COUNT_SQL}
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
	currentUserId?: number,
	showdead: boolean = false
): Promise<CommentRow[]> {
	// TODO: D1が再帰CTEに対応したらWITH RECURSIVEで直接子孫を取得する
	// 現状はストーリー全コメントを取得してJSでBFSフィルタ
	const all = await getCommentsByStoryId(db, storyId, currentUserId, showdead);
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
	limit: number = 30,
	showdead: boolean = false
): Promise<StoryRow[]> {
	const offset = (page - 1) * limit;
	const deadFilter = showdead ? '' : 'WHERE s.dead = 0 AND c.dead = 0';
	const sql = `
		SELECT s.*, u.username, u.created_at as user_created_at, u.deleted as user_deleted, ${STORY_FLAG_COUNT_SQL}
		FROM stories s
		JOIN users u ON s.user_id = u.id
		JOIN comments c ON c.story_id = s.id
		${deadFilter}
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
	limit: number = 30,
	showdead: boolean = false
): Promise<StoryRow[]> {
	const offset = (page - 1) * limit;
	const deadFilter = showdead ? '' : 'AND s.dead = 0';
	const result = await db
		.prepare(
			`SELECT s.*, u.username, u.created_at as user_created_at, u.deleted as user_deleted, ${STORY_FLAG_COUNT_SQL}
			FROM favorites f
			JOIN stories s ON f.story_id = s.id
			JOIN users u ON s.user_id = u.id
			WHERE f.user_id = ? ${deadFilter}
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
	limit: number = 30,
	showdead: boolean = false
): Promise<StoryRow[]> {
	const offset = (page - 1) * limit;
	const deadFilter = showdead ? '' : 'AND s.dead = 0';
	const result = await db
		.prepare(
			`SELECT s.*, u.username, u.created_at as user_created_at, u.deleted as user_deleted, ${STORY_FLAG_COUNT_SQL}
			FROM hidden h
			JOIN stories s ON h.story_id = s.id
			JOIN users u ON s.user_id = u.id
			WHERE h.user_id = ? ${deadFilter}
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

export async function getStoriesByDomain(
	db: D1Database,
	domain: string,
	page: number = 1,
	limit: number = 30,
	showdead: boolean = false
): Promise<StoryRow[]> {
	const offset = (page - 1) * limit;
	const pattern = `%://${escapeLikePattern(domain)}%`;
	const wwwPattern = `%://www.${escapeLikePattern(domain)}%`;
	const deadFilter = showdead ? '' : 'AND s.dead = 0';
	const sql = `
		SELECT s.*, u.username, u.created_at as user_created_at, u.deleted as user_deleted, ${STORY_FLAG_COUNT_SQL}
		FROM stories s
		JOIN users u ON s.user_id = u.id
		WHERE s.url IS NOT NULL
		  AND (s.url LIKE ? ESCAPE '\\' OR s.url LIKE ? ESCAPE '\\') ${deadFilter}
		ORDER BY s.created_at DESC
		LIMIT ? OFFSET ?
	`;
	const result = await db.prepare(sql).bind(pattern, wwwPattern, limit, offset).all<StoryRow>();
	return result.results;
}

export async function searchStories(
	db: D1Database,
	query: string,
	page: number = 1,
	limit: number = 30,
	showdead: boolean = false
): Promise<StoryRow[]> {
	const offset = (page - 1) * limit;
	const pattern = `%${escapeLikePattern(query)}%`;
	const deadFilter = showdead ? '' : 'AND s.dead = 0';
	const sql = `
		SELECT s.*, u.username, u.created_at as user_created_at, u.deleted as user_deleted, ${STORY_FLAG_COUNT_SQL}
		FROM stories s
		JOIN users u ON s.user_id = u.id
		WHERE (s.title LIKE ? ESCAPE '\\' OR s.url LIKE ? ESCAPE '\\' OR s.text LIKE ? ESCAPE '\\') ${deadFilter}
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
	limit: number = 30,
	currentUserId?: number,
	showdead: boolean = false
): Promise<(CommentRow & { story_title: string })[]> {
	const fetchLimit = limit * 3;
	const offset = (page - 1) * limit;
	const pattern = `%${escapeLikePattern(query)}%`;
	const deadFilter = showdead ? '' : 'AND c.dead = 0';
	const sql = `
		SELECT c.*, u.username, u.created_at as user_created_at, u.deleted as user_deleted, u.delay as author_delay, s.title as story_title, ${COMMENT_FLAG_COUNT_SQL}
		FROM comments c
		JOIN users u ON c.user_id = u.id
		JOIN stories s ON c.story_id = s.id
		WHERE c.text LIKE ? ESCAPE '\\' ${deadFilter}
		ORDER BY c.created_at DESC
		LIMIT ? OFFSET ?
	`;
	const result = await db
		.prepare(sql)
		.bind(pattern, fetchLimit, offset)
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

export async function getRecentComments(
	db: D1Database,
	page: number = 1,
	limit: number = 30,
	currentUserId?: number,
	showdead: boolean = false
): Promise<(CommentRow & { story_title: string })[]> {
	// Fetch extra rows to account for delay-filtered ones
	const fetchLimit = limit * 3;
	const offset = (page - 1) * limit;
	const deadFilter = showdead ? '' : 'WHERE c.dead = 0';
	const result = await db
		.prepare(
			`SELECT c.*, u.username, u.created_at as user_created_at, u.deleted as user_deleted, u.delay as author_delay, s.title as story_title, ${COMMENT_FLAG_COUNT_SQL}
			FROM comments c
			JOIN users u ON c.user_id = u.id
			JOIN stories s ON c.story_id = s.id
			${deadFilter}
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

export type LeaderRow = Pick<UserRow, 'id' | 'username' | 'karma' | 'created_at'>;

export async function getTopUsersByKarma(
	db: D1Database,
	page: number = 1,
	limit: number = 30
): Promise<LeaderRow[]> {
	const offset = (page - 1) * limit;
	// 列限定: password_hash など機微フィールドを取らない（将来のフィールド追加事故も回避）
	// 同 karma は古参優先（本家HN準拠）
	// 削除済みユーザーはランキングから除外（#76）。karma が残っていても本人がいないため。
	const result = await db
		.prepare(
			`SELECT id, username, karma, created_at FROM users
			WHERE deleted = 0
			ORDER BY karma DESC, created_at ASC
			LIMIT ? OFFSET ?`
		)
		.bind(limit, offset)
		.all<LeaderRow>();
	return result.results;
}

export async function getBestComments(
	db: D1Database,
	options: {
		sinceMs?: number; // null/undefined: 全期間
		page?: number;
		limit?: number;
		currentUserId?: number;
		showdead?: boolean;
	} = {}
): Promise<(CommentRow & { story_title: string })[]> {
	const { sinceMs, page = 1, limit = 30, currentUserId, showdead = false } = options;
	const fetchLimit = limit * 3;
	const offset = (page - 1) * limit;
	const conds: string[] = [];
	const params: (string | number)[] = [];

	if (!showdead) conds.push('c.dead = 0');
	if (sinceMs !== undefined) {
		const sinceIso = new Date(Date.now() - sinceMs).toISOString().replace(/\.\d{3}Z$/, 'Z');
		conds.push('c.created_at >= ?');
		params.push(sinceIso);
	}
	const whereClause = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';

	const sql = `
		SELECT c.*, u.username, u.created_at as user_created_at, u.deleted as user_deleted, u.delay as author_delay, s.title as story_title, ${COMMENT_FLAG_COUNT_SQL}
		FROM comments c
		JOIN users u ON c.user_id = u.id
		JOIN stories s ON c.story_id = s.id
		${whereClause}
		ORDER BY c.points DESC, c.created_at DESC
		LIMIT ? OFFSET ?
	`;
	params.push(fetchLimit, offset);
	const result = await db
		.prepare(sql)
		.bind(...params)
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

// 新規ユーザー判定は呼び出し側が thresholdMs を指定する。/noobstories では TWO_WEEKS_MS（14日）を渡す。
// `isNewUser()` のグリーン表示と一貫させるため、しきい値は両者で揃えること。
export async function getStoriesByNewUsers(
	db: D1Database,
	thresholdMs: number,
	page: number = 1,
	limit: number = 30,
	showdead: boolean = false
): Promise<StoryRow[]> {
	const offset = (page - 1) * limit;
	const sinceIso = new Date(Date.now() - thresholdMs).toISOString().replace(/\.\d{3}Z$/, 'Z');
	const deadFilter = showdead ? '' : 'AND s.dead = 0';
	const sql = `
		SELECT s.*, u.username, u.created_at as user_created_at, u.deleted as user_deleted, ${STORY_FLAG_COUNT_SQL}
		FROM stories s
		JOIN users u ON s.user_id = u.id
		WHERE u.created_at >= ? ${deadFilter}
		ORDER BY s.created_at DESC
		LIMIT ? OFFSET ?
	`;
	const result = await db.prepare(sql).bind(sinceIso, limit, offset).all<StoryRow>();
	return result.results;
}

// 新規ユーザー判定は呼び出し側が thresholdMs を指定する。/noobcomments では TWO_WEEKS_MS（14日）を渡す。
// `isNewUser()` のグリーン表示と一貫させるため、しきい値は両者で揃えること。
export async function getCommentsByNewUsers(
	db: D1Database,
	thresholdMs: number,
	page: number = 1,
	limit: number = 30,
	currentUserId?: number,
	showdead: boolean = false
): Promise<(CommentRow & { story_title: string })[]> {
	const fetchLimit = limit * 3;
	const offset = (page - 1) * limit;
	const sinceIso = new Date(Date.now() - thresholdMs).toISOString().replace(/\.\d{3}Z$/, 'Z');
	const deadFilter = showdead ? '' : 'AND c.dead = 0';
	const sql = `
		SELECT c.*, u.username, u.created_at as user_created_at, u.deleted as user_deleted, u.delay as author_delay, s.title as story_title, ${COMMENT_FLAG_COUNT_SQL}
		FROM comments c
		JOIN users u ON c.user_id = u.id
		JOIN stories s ON c.story_id = s.id
		WHERE u.created_at >= ? ${deadFilter}
		ORDER BY c.created_at DESC
		LIMIT ? OFFSET ?
	`;
	const result = await db
		.prepare(sql)
		.bind(sinceIso, fetchLimit, offset)
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

export async function hasFlagged(
	db: D1Database,
	userId: number,
	itemId: number,
	itemType: 'story' | 'comment'
): Promise<boolean> {
	const result = await db
		.prepare('SELECT 1 FROM flags WHERE user_id = ? AND item_id = ? AND item_type = ?')
		.bind(userId, itemId, itemType)
		.first();
	return result !== null;
}

export async function getFlaggedItemIds(
	db: D1Database,
	userId: number,
	itemIds: number[],
	itemType: 'story' | 'comment'
): Promise<Set<number>> {
	if (itemIds.length === 0) return new Set();
	const placeholders = itemIds.map(() => '?').join(',');
	const result = await db
		.prepare(
			`SELECT item_id FROM flags WHERE user_id = ? AND item_type = ? AND item_id IN (${placeholders})`
		)
		.bind(userId, itemType, ...itemIds)
		.all<{ item_id: number }>();
	return new Set(result.results.map((r) => r.item_id));
}

export async function getFlagCount(
	db: D1Database,
	itemId: number,
	itemType: 'story' | 'comment'
): Promise<number> {
	const result = await db
		.prepare('SELECT COUNT(*) AS n FROM flags WHERE item_id = ? AND item_type = ?')
		.bind(itemId, itemType)
		.first<{ n: number }>();
	return result?.n ?? 0;
}

// ===== IP ban (#77) =====
//
// active な ban の判定: expires_at IS NULL（無期限）または expires_at > now。
// 過去日時の expires_at は自動失効扱いとし、active には含めない。
// 失効した行は DELETE で物理削除（履歴保持は将来要件）。
//
// CAPTCHA セルフ unban (#91) と自動 ban (#92) は別 Issue で実装する。

// 該当 IP に active な ban があれば返す。なければ null。
// 同 IP に複数 ban が積まれていた場合は banned_at 最新を採用。
export async function getActiveBan(db: D1Database, ip: string): Promise<IpBanRow | null> {
	const nowIso = nowIsoSeconds();
	const row = await db
		.prepare(
			`SELECT * FROM ip_bans
			WHERE ip = ? AND (expires_at IS NULL OR expires_at > ?)
			ORDER BY banned_at DESC LIMIT 1`
		)
		.bind(ip, nowIso)
		.first<IpBanRow>();
	return row;
}

// admin 一覧用。active な ban のみを新しい順で返す。
export async function listActiveBans(db: D1Database): Promise<IpBanRow[]> {
	const nowIso = nowIsoSeconds();
	const result = await db
		.prepare(
			`SELECT * FROM ip_bans
			WHERE expires_at IS NULL OR expires_at > ?
			ORDER BY banned_at DESC`
		)
		.bind(nowIso)
		.all<IpBanRow>();
	return result.results;
}

// IP ban を作成する。expiresAt が null のときは無期限 ban。
// 重複防止のため、同 IP の既存 active ban は INSERT 前に物理削除して上書きする。
// （should-1: 同 IP に複数 active が積み上がると一覧の見通しが悪くなるため）
export async function createIpBan(
	db: D1Database,
	params: { ip: string; reason: string; expiresAt: string | null; bannedBy: number }
): Promise<void> {
	const nowIso = nowIsoSeconds();
	// 既存の active ban を全て物理削除してから INSERT。
	await db
		.prepare(
			'DELETE FROM ip_bans WHERE ip = ? AND (expires_at IS NULL OR expires_at > ?)'
		)
		.bind(params.ip, nowIso)
		.run();
	await db
		.prepare(
			'INSERT INTO ip_bans (ip, reason, expires_at, banned_by) VALUES (?, ?, ?, ?)'
		)
		.bind(params.ip, params.reason, params.expiresAt, params.bannedBy)
		.run();
}

// IP ban を物理削除する（unban）。
export async function removeIpBan(db: D1Database, id: number): Promise<void> {
	await db.prepare('DELETE FROM ip_bans WHERE id = ?').bind(id).run();
}

// IP ban を論理失効させる（expires_at = now）。履歴を残したいときに使う。
// 現状の運用では removeIpBan を使う。将来の「unban 履歴を見たい」要件に備えて用意。
export async function expireIpBan(db: D1Database, id: number): Promise<void> {
	const nowIso = nowIsoSeconds();
	await db
		.prepare('UPDATE ip_bans SET expires_at = ? WHERE id = ?')
		.bind(nowIso, id)
		.run();
}

// ===== Poll (#74) =====
//
// 本家HN の /newpoll 相当。type='poll' の stories と poll_options を 1:N で対応させ、
// 各 option への投票は votes(item_type='poll_option') として記録する。
// karma は **加算しない**（HN 仕様）。複数 option への重複投票可。

// poll を新規作成する。
//
// SQLite の last_insert_rowid() は「直近に rowid テーブルへ INSERT された行の rowid」を
// テーブル無関係に返す仕様のため、batch 内で複数 poll_options を last_insert_rowid() で
// 連結すると 2 つ目以降は直前の poll_option.id を story_id として保存してしまう。
// よって以下の 2 段階で実装する:
//   1. stories INSERT を単独実行し meta.last_row_id から storyId を取得
//   2. storyId を明示 bind した poll_options 全件 + 自動 upvote を 1 batch で投入
//      失敗時は手動で stories を DELETE してロールバック（孤児 stories を残さない）
export async function createPoll(
	db: D1Database,
	params: { userId: number; title: string; text: string | null; options: string[] }
): Promise<number> {
	const storyResult = await db
		.prepare(
			"INSERT INTO stories (title, url, text, user_id, type) VALUES (?, NULL, ?, ?, 'poll')"
		)
		.bind(params.title, params.text, params.userId)
		.run();
	const storyId = storyResult.meta.last_row_id as number;

	const stmts: D1PreparedStatement[] = params.options.map((text, i) =>
		db
			.prepare('INSERT INTO poll_options (story_id, text, position) VALUES (?, ?, ?)')
			.bind(storyId, text, i)
	);
	// 投稿者本人の自動 upvote（story 本体）
	stmts.push(
		db
			.prepare("INSERT INTO votes (user_id, item_id, item_type) VALUES (?, ?, 'story')")
			.bind(params.userId, storyId)
	);

	try {
		await db.batch(stmts);
	} catch (err) {
		// options or vote の batch が失敗したら stories を手動で消して整合を保つ
		await db.prepare('DELETE FROM stories WHERE id = ?').bind(storyId).run();
		throw err;
	}
	return storyId;
}

// 指定 story の poll_options を position 順で取得する。各 option の vote_count は
// votes(item_type='poll_option', vote_type='up') の COUNT。
export async function getPollOptions(
	db: D1Database,
	storyId: number
): Promise<PollOptionRow[]> {
	const result = await db
		.prepare(
			`SELECT po.id, po.story_id, po.text, po.position, po.created_at,
				(SELECT COUNT(*) FROM votes v
					WHERE v.item_id = po.id AND v.item_type = 'poll_option' AND v.vote_type = 'up') AS vote_count
			FROM poll_options po
			WHERE po.story_id = ?
			ORDER BY po.position ASC`
		)
		.bind(storyId)
		.all<PollOptionRow>();
	return result.results;
}

// ログインユーザーが投票済みの option_id Set を返す。
export async function getPollOptionsVoted(
	db: D1Database,
	userId: number,
	storyId: number
): Promise<Set<number>> {
	const result = await db
		.prepare(
			`SELECT v.item_id FROM votes v
			JOIN poll_options po ON po.id = v.item_id
			WHERE v.user_id = ? AND v.item_type = 'poll_option' AND v.vote_type = 'up' AND po.story_id = ?`
		)
		.bind(userId, storyId)
		.all<{ item_id: number }>();
	return new Set(result.results.map((r) => r.item_id));
}

// poll_option の存在確認 + どの story に紐づくかを返す。/api/vote のバリデーション用。
// dead な poll への投票は弾く（s.dead = 0 で絞り込み）。
export async function getPollOptionById(
	db: D1Database,
	id: number
): Promise<{ id: number; story_id: number } | null> {
	const result = await db
		.prepare(
			`SELECT po.id, po.story_id FROM poll_options po
			JOIN stories s ON s.id = po.story_id
			WHERE po.id = ? AND s.type = 'poll' AND s.dead = 0`
		)
		.bind(id)
		.first<{ id: number; story_id: number }>();
	return result;
}

// /polls 一覧用。type='poll' の stories を points 降順 + 新しい順で返す。
export async function getPolls(
	db: D1Database,
	page: number = 1,
	limit: number = 30,
	showdead: boolean = false
): Promise<StoryRow[]> {
	const offset = (page - 1) * limit;
	const deadFilter = showdead ? '' : 'AND s.dead = 0';
	const sql = `
		SELECT s.*, u.username, u.created_at as user_created_at, u.deleted as user_deleted, ${STORY_FLAG_COUNT_SQL}
		FROM stories s
		JOIN users u ON s.user_id = u.id
		WHERE s.type = 'poll' ${deadFilter}
		ORDER BY s.points DESC, s.created_at DESC
		LIMIT ? OFFSET ?
	`;
	const result = await db.prepare(sql).bind(limit, offset).all<StoryRow>();
	return result.results;
}
