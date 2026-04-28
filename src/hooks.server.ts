import type { Handle } from '@sveltejs/kit';
import { getDB, getActiveBan } from '$lib/server/db';
import { getSession } from '$lib/server/auth';
import { redirect } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = null;

	// IP ban チェック (#77) ─ session 取得より前に判定する。
	// ban されたユーザーがログインで貫通できないようにするため。
	// /ipban 自身と /api/* は除外（無限ループ防止 + 静的 API は許可）。
	const pathname = event.url.pathname;
	const isBanExempt = pathname === '/ipban' || pathname.startsWith('/api/');
	if (!isBanExempt) {
		try {
			const db = getDB(event.platform);
			// CF-Connecting-IP は Cloudflare 越し本番、無いときは getClientAddress（dev/直結用）。
			const ip =
				event.request.headers.get('CF-Connecting-IP') ?? event.getClientAddress();
			const ban = await getActiveBan(db, ip);
			if (ban) {
				throw redirect(302, '/ipban');
			}
		} catch (e) {
			if (e && typeof e === 'object' && 'status' in e && 'location' in e) {
				throw e;
			}
			// DB 未バインド時（ビルド中など）は ban チェックをスキップ。
		}
	}

	const sessionId = event.cookies.get('session');
	if (sessionId) {
		try {
			const db = getDB(event.platform);
			const user = await getSession(db, sessionId);
			if (user) {
				event.locals.user = user;

				// noprocrast: アクセス制限チェック
				const noprocrastExempt = ['/noprocrast', '/logout', '/login', '/signup'];
				const isUserSettingsPage = event.url.pathname === `/user/${user.username}`;
				const isApiRoute = event.url.pathname.startsWith('/api/');
				const isExempt = noprocrastExempt.includes(event.url.pathname) || isUserSettingsPage || isApiRoute;

				if (user.noprocrast === 1 && !isExempt) {
					const now = new Date();
					const nowISO = now.toISOString().replace(/\.\d{3}Z$/, 'Z');

					if (!user.last_visit) {
						// 初回アクセス: last_visit をセット
						await db
							.prepare('UPDATE users SET last_visit = ? WHERE id = ?')
							.bind(nowISO, user.id)
							.run();
					} else {
						const lastVisit = new Date(user.last_visit);
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
