import type { PageServerLoad, Actions } from './$types';
import {
	getDB,
	getUserByUsername,
	isUsernameTaken,
	validateUsernameFormat,
	recordLoginFailure,
	countRecentLoginFailures,
	getActiveBan,
	createIpBan
} from '$lib/server/db';
import { verifyPassword, hashPassword, createSession } from '$lib/server/auth';
import { fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		throw redirect(302, '/');
	}
	return {};
};

// 自動 ban 閾値（#92）。閾値・継続時間は両方ここで一元管理する。
// 5 分窓 / 10 失敗 → 1 時間 ban、1 時間窓 / 30 失敗 → 24 時間 ban。
// 24h 条件を先に評価し、合致したらそちらを採用（より長い ban を優先）。
const SHORT_WINDOW_MINUTES = 5;
const SHORT_WINDOW_THRESHOLD = 10;
const SHORT_WINDOW_BAN_HOURS = 1;
const LONG_WINDOW_MINUTES = 60;
const LONG_WINDOW_THRESHOLD = 30;
const LONG_WINDOW_BAN_HOURS = 24;

// パスワード不一致 / ユーザー不在 / deleted ユーザーいずれの "Bad login" でも
// IP 単位で失敗を記録し、閾値を越えたら自動 ban を発動する（#92）。
// - validation エラー（username/password 空）は攻撃ではないため対象外（呼ばない）
// - 既に active な ban があるときは何もしない（重複 ban を作らない）
// - DB エラーは握り潰す（ログイン応答自体は元のとおり Bad login で返したい）
async function handleLoginFailure(
	db: D1Database,
	ip: string
): Promise<void> {
	try {
		await recordLoginFailure(db, ip);

		// 既に active な ban が積まれていれば、追加で ban を作らない。
		const existing = await getActiveBan(db, ip);
		if (existing) return;

		// 24h 条件を先に評価（より長い ban を優先）。
		const longCount = await countRecentLoginFailures(db, ip, LONG_WINDOW_MINUTES);
		if (longCount >= LONG_WINDOW_THRESHOLD) {
			const expiresAt = new Date(
				Date.now() + LONG_WINDOW_BAN_HOURS * 60 * 60 * 1000
			)
				.toISOString()
				.replace(/\.\d{3}Z$/, 'Z');
			await createIpBan(db, {
				ip,
				reason: `auto: ${LONG_WINDOW_MINUTES}min/${LONG_WINDOW_THRESHOLD} login failures`,
				expiresAt,
				bannedBy: null
			});
			return;
		}

		const shortCount = await countRecentLoginFailures(db, ip, SHORT_WINDOW_MINUTES);
		if (shortCount >= SHORT_WINDOW_THRESHOLD) {
			const expiresAt = new Date(
				Date.now() + SHORT_WINDOW_BAN_HOURS * 60 * 60 * 1000
			)
				.toISOString()
				.replace(/\.\d{3}Z$/, 'Z');
			await createIpBan(db, {
				ip,
				reason: `auto: ${SHORT_WINDOW_MINUTES}min/${SHORT_WINDOW_THRESHOLD} login failures`,
				expiresAt,
				bannedBy: null
			});
		}
	} catch {
		// 失敗計測の失敗で本来の login レスポンスを壊さない。
	}
}

function getClientIp(event: {
	request: { headers: Headers };
	getClientAddress: () => string;
}): string {
	return event.request.headers.get('CF-Connecting-IP') ?? event.getClientAddress();
}

export const actions: Actions = {
	login: async (event) => {
		const { request, platform, cookies } = event;
		const db = getDB(platform);
		const formData = await request.formData();
		const username = (formData.get('username') as string)?.trim();
		const password = formData.get('password') as string;

		if (!username || !password) {
			// バリデーションエラーは攻撃ではないため失敗ログに記録しない（#92）
			return fail(400, { loginError: 'Username and password are required', loginUsername: username });
		}

		const ip = getClientIp(event);

		const user = await getUserByUsername(db, username);
		if (!user) {
			await handleLoginFailure(db, ip);
			return fail(400, { loginError: 'Bad login', loginUsername: username });
		}

		// 削除済みアカウントはログイン不可（#76）。情報量を増やさないため
		// 通常の "Bad login" と同じメッセージで返す（ユーザー存在の列挙防止）。
		if (user.deleted === 1) {
			await handleLoginFailure(db, ip);
			return fail(400, { loginError: 'Bad login', loginUsername: username });
		}

		const valid = await verifyPassword(password, user.password_hash);
		if (!valid) {
			await handleLoginFailure(db, ip);
			return fail(400, { loginError: 'Bad login', loginUsername: username });
		}

		const sessionId = await createSession(db, user.id);

		cookies.set('session', sessionId, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: false,
			maxAge: 30 * 24 * 60 * 60
		});

		throw redirect(302, '/');
	},

	signup: async ({ request, platform, cookies }) => {
		const db = getDB(platform);
		const formData = await request.formData();
		const username = (formData.get('username') as string)?.trim();
		const password = formData.get('password') as string;

		if (!username || !password) {
			return fail(400, { signupError: 'Username and password are required', signupUsername: username });
		}

		const formatError = validateUsernameFormat(username);
		if (formatError) {
			return fail(400, { signupError: formatError, signupUsername: username });
		}

		if (password.length < 8) {
			return fail(400, { signupError: 'Password must be at least 8 characters', signupUsername: username });
		}

		// 過去に使われた username も含めて重複チェック（永久ロック）。
		if (await isUsernameTaken(db, username)) {
			return fail(400, { signupError: 'That username is taken', signupUsername: username });
		}

		const passwordHash = await hashPassword(password);

		const result = await db
			.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
			.bind(username, passwordHash)
			.run();

		const userId = result.meta.last_row_id;
		const sessionId = await createSession(db, userId as number);

		cookies.set('session', sessionId, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: false,
			maxAge: 30 * 24 * 60 * 60
		});

		throw redirect(302, '/');
	}
};
