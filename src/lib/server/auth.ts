export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.randomUUID().replace(/-/g, '');
	const data = new TextEncoder().encode(salt + password);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
	return salt + ':' + hashHex;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
	const [salt, storedHash] = hash.split(':');
	if (!salt || !storedHash) return false;
	const data = new TextEncoder().encode(salt + password);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
	return hashHex === storedHash;
}

export async function createSession(db: D1Database, userId: number): Promise<string> {
	const sessionId = crypto.randomUUID();
	const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
	await db
		.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
		.bind(sessionId, userId, expiresAt)
		.run();
	return sessionId;
}

export async function getSession(
	db: D1Database,
	sessionId: string
): Promise<{
	id: number;
	username: string;
	karma: number;
	delay: number;
	noprocrast: number;
	maxvisit: number;
	minaway: number;
	showdead: number;
} | null> {
	const result = await db
		.prepare(
			`SELECT u.id, u.username, u.karma, u.delay, u.noprocrast, u.maxvisit, u.minaway, u.showdead
			FROM sessions s
			JOIN users u ON s.user_id = u.id
			WHERE s.id = ? AND s.expires_at > datetime('now')`
		)
		.bind(sessionId)
		.first<{
			id: number;
			username: string;
			karma: number;
			delay: number;
			noprocrast: number;
			maxvisit: number;
			minaway: number;
			showdead: number;
		}>();
	return result;
}

export async function deleteSession(db: D1Database, sessionId: string): Promise<void> {
	await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
}
