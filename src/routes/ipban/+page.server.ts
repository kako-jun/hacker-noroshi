import { fail, redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { Actions, PageServerLoad } from './$types';
import { getDB, getActiveBan, removeActiveBansByIp } from '$lib/server/db';

// 自分の IP に active な ban があるか確認するページ。
// hooks の ban チェックは /ipban を除外しているため、ban の有無に関わらず到達できる。
// ban されていれば情報を表示、無ければ「ban されていません」と表示する。
// 履歴表示は将来要件。現状は active のみ。
//
// #91: ban 中ユーザー向けに Turnstile による セルフ unban を提供する。
// `data.turnstileSiteKey` は ban 中かつ env 設定済みのときのみ widget を表示するために返す。
export const load: PageServerLoad = async (event) => {
	const ip =
		event.request.headers.get('CF-Connecting-IP') ?? event.getClientAddress();
	let ban = null;
	try {
		const db = getDB(event.platform);
		ban = await getActiveBan(db, ip);
	} catch {
		// DB 未バインド時は ban=null として「banされていません」を表示する。
	}
	// site key が未設定（dev / 未デプロイ環境）なら null を返し、フロントで widget を出さない。
	// 'REPLACE_ME' は wrangler.toml の placeholder（dev/未設定）。null として扱い widget を出さない。
	const rawSiteKey = event.platform?.env?.TURNSTILE_SITE_KEY;
	const turnstileSiteKey = !rawSiteKey || rawSiteKey === 'REPLACE_ME' ? null : rawSiteKey;
	return { ip, ban, turnstileSiteKey };
};

// セルフ unban の cookie 名と上限。24h 以内 3 回までソフト制限する。
// cookie 削除で回避できることは許容（v1 範囲）。永続的な対策は将来 #91 後継で検討する。
const UNBAN_COOKIE = 'unban_attempts';
const UNBAN_MAX_ATTEMPTS = 3;
const UNBAN_COOKIE_MAX_AGE = 24 * 60 * 60; // 24h

export const actions: Actions = {
	// #91: Turnstile による IP ban のセルフサービス unban。
	// 1. cookie で 24h / 3 回までソフト制限
	// 2. 該当 IP が ban されていなければ 400（既に unban 済み or そもそも ban 中ではない）
	// 3. Turnstile token を siteverify で検証
	// 4. 通過したら removeActiveBansByIp で当該 IP の active を全削除し / へ 303
	// 5. 通過試行（成功・失敗どちらも）で cookie の試行カウンタを +1
	//    成功時は cookie を削除して次回の制限をリセット
	unban: async (event) => {
		const { request, platform, cookies } = event;
		const ip = request.headers.get('CF-Connecting-IP') ?? event.getClientAddress();

		// cookie 試行数チェック。3 回到達後はリクエスト本体を処理しない。
		const attemptsRaw = cookies.get(UNBAN_COOKIE);
		const attempts = attemptsRaw ? parseInt(attemptsRaw, 10) : 0;
		if (Number.isFinite(attempts) && attempts >= UNBAN_MAX_ATTEMPTS) {
			return fail(429, {
				unbanError:
					'24時間以内の試行回数を超えました。管理者に連絡してください。'
			});
		}

		// DB を取れない場合は 500（インフラエラー）。dev で DB バインドが無いと到達する。
		let db: D1Database;
		try {
			db = getDB(platform);
		} catch {
			return fail(500, {
				unbanError: '管理側の DB 設定が未完了です。管理者に連絡してください。'
			});
		}

		// ban 中でなければ unban する意味がない（バグ・直接 POST 攻撃の可能性）
		const ban = await getActiveBan(db, ip);
		if (!ban) {
			return fail(400, { unbanError: 'この IP は ban されていません。' });
		}

		const formData = await request.formData();
		const token = formData.get('cf-turnstile-response');
		if (typeof token !== 'string' || token.length === 0) {
			return fail(400, { unbanError: '認証 token が見つかりません。' });
		}

		const secret = platform?.env?.TURNSTILE_SECRET_KEY;
		if (!secret) {
			return fail(500, {
				unbanError: '管理側の認証設定が未完了です。管理者に連絡してください。'
			});
		}

		// Turnstile siteverify。Cloudflare 公式の検証エンドポイント。
		// remoteip も渡すと token 発行時の IP と一致するかを Cloudflare 側で確認できる。
		let verifyJson: { success: boolean; 'error-codes'?: string[] };
		try {
			const verifyRes = await fetch(
				'https://challenges.cloudflare.com/turnstile/v0/siteverify',
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
					body: new URLSearchParams({
						secret,
						response: token,
						remoteip: ip
					}).toString()
				}
			);
			verifyJson = (await verifyRes.json()) as {
				success: boolean;
				'error-codes'?: string[];
			};
		} catch {
			// fetch 失敗時は cookie をカウントしない（ユーザー側の責任ではない）
			return fail(502, {
				unbanError: '認証サーバーに接続できませんでした。時間を置いて再試行してください。'
			});
		}

		// 試行カウンタ +1（成功・失敗どちらでも）。
		// secure は本番（HTTPS）でのみ on。dev（http）は false にしておかないと cookie が落ちる。
		// HttpOnly + sameSite=lax で十分とする（v1 範囲）。
		cookies.set(UNBAN_COOKIE, String(attempts + 1), {
			path: '/',
			maxAge: UNBAN_COOKIE_MAX_AGE,
			httpOnly: true,
			sameSite: 'lax',
			secure: !dev
		});

		if (!verifyJson.success) {
			return fail(400, { unbanError: '認証に失敗しました。再度試してください。' });
		}

		// 通過。当該 IP の active な ban を全て物理削除し、cookie をリセットしてから / へ。
		await removeActiveBansByIp(db, ip);
		cookies.delete(UNBAN_COOKIE, { path: '/' });

		throw redirect(303, '/');
	}
};
