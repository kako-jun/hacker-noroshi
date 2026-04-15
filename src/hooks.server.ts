import type { Handle } from '@sveltejs/kit';
import { getDB } from '$lib/server/db';
import { getSession } from '$lib/server/auth';
import { redirect } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = null;

	const sessionId = event.cookies.get('session');
	if (sessionId) {
		try {
			const db = getDB(event.platform);
			const user = await getSession(db, sessionId);
			if (user) {
				event.locals.user = user;

				// noprocrast: アクセス制限チェック
				if (user.noprocrast === 1 && event.url.pathname !== '/noprocrast') {
					const now = new Date();
					const nowISO = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
					const userRow = await db
						.prepare('SELECT last_visit FROM users WHERE id = ?')
						.bind(user.id)
						.first<{ last_visit: string | null }>();

					if (!userRow?.last_visit) {
						// 初回アクセス: last_visit をセット
						await db
							.prepare('UPDATE users SET last_visit = ? WHERE id = ?')
							.bind(nowISO, user.id)
							.run();
					} else {
						const lastVisit = new Date(userRow.last_visit);
						const elapsed = (now.getTime() - lastVisit.getTime()) / (1000 * 60);

						if (elapsed <= user.maxvisit) {
							// maxvisit 以内: 通常アクセス許可
						} else if (elapsed >= user.maxvisit + user.minaway) {
							// minaway 経過済み: last_visit リセットして許可
							await db
								.prepare('UPDATE users SET last_visit = ? WHERE id = ?')
								.bind(nowISO, user.id)
								.run();
						} else {
							// maxvisit 超過 & minaway 未到達: ブロック
							throw redirect(302, '/noprocrast');
						}
					}
				}
			} else {
				event.cookies.delete('session', { path: '/' });
			}
		} catch (e) {
			// redirect はキャッチしない
			if (e && typeof e === 'object' && 'status' in e && 'location' in e) {
				throw e;
			}
			// DB not available (e.g. during build), skip auth
		}
	}

	return resolve(event);
};
