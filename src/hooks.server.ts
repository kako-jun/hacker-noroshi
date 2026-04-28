import type { Handle } from '@sveltejs/kit';
import { getDB, getActiveBan, type IpBanRow } from '$lib/server/db';
import { getSession } from '$lib/server/auth';
import { nowIsoSeconds } from '$lib/format';
import { redirect } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = null;

	// IP ban チェック (#77) ─ session 取得より前に判定する。
	// ban されたユーザーがログインで貫通できないようにするため。
	// 除外は /ipban 自身のみ（無限ループ防止）。デフォルトで API も ban を効かせる
	// ホワイトリスト方式。将来 ban 状態を返す API を作るときは /api/ipban/ プレフィックスを
	// ここに追加する（現状そのルートは無いので除外なし）。
	const pathname = event.url.pathname;
	const isBanExempt = pathname === '/ipban';
	if (!isBanExempt) {
		// DB / クエリエラー時は ban チェックをスキップ（フェイルオープン）。
		// redirect は try の外で throw し、握り潰さない。
		let activeBan: IpBanRow | null = null;
		try {
			const db = getDB(event.platform);
			// CF-Connecting-IP は Cloudflare 越し本番、無いときは getClientAddress（dev/直結用）。
			// 警告: 本番は必ず Cloudflare 経由でアクセスさせること。直結を許すと
			// CF-Connecting-IP ヘッダ偽装で ban を回避される。詳細は docs/operations.md。
			const ip =
				event.request.headers.get('CF-Connecting-IP') ?? event.getClientAddress();
			activeBan = await getActiveBan(db, ip);
		} catch {
			// DB 未バインド時（ビルド中など）や DB エラー時は ban チェックをスキップ。
		}
		if (activeBan) {
			throw redirect(302, '/ipban');
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
					const nowISO = nowIsoSeconds();

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
