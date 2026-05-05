/**
 * SvelteKit form action を直接呼び出して検証するためのテストヘルパ。
 *
 * SvelteKit の `error()` / `redirect()` は throw、`fail()` は ActionFailure を return する。
 * `callAction` は両者を吸収し、status 中心の統一フォーマットを返す。
 *
 * ファイル名 vs API:
 *   - `buildRequestEvent(opts)`     RequestEvent を mock する。formData / locals / params /
 *                                   platform / url / cookies などを必要な分だけ詰める。
 *   - `callAction(action, opts)`    action を呼び、redirect / error / fail / 通常返り値を
 *                                   `{ status, body?, redirect?, thrownError? }` で返す。
 *
 * 設計方針:
 *   - production コードはいじらない。テスト目的の薄い shim のみ。
 *   - 厳密な RequestEvent 互換ではなく、+page.server.ts の action が実際に触るプロパティのみ
 *     用意する（destructure ベースなので過不足なくて OK）。
 */

import { isHttpError, isRedirect, isActionFailure } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

export interface MockUser {
	id: number;
	username: string;
	karma?: number;
	delay?: number;
	noprocrast?: number;
	maxvisit?: number;
	minaway?: number;
	showdead?: number;
	last_visit?: string | null;
	is_admin?: number;
}

export interface BuildEventOpts {
	formData?: Record<string, string>;
	params?: Record<string, string>;
	user?: MockUser | null;
	platform?: { env: { DB: D1Database } };
	url?: URL;
	cookies?: Record<string, string>;
	getClientAddress?: () => string;
	request?: { headers?: Record<string, string> };
}

/**
 * +page.server.ts の action は通常以下しか触らない:
 *   - request.formData()
 *   - request.headers (rate-limit や IP ban のときのみ)
 *   - locals.user
 *   - params
 *   - platform.env.DB
 *   - cookies (set/get)
 *   - getClientAddress()
 *
 * 必要に応じて拡張する。型は RequestEvent 互換にキャスト。
 */
export function buildRequestEvent(opts: BuildEventOpts): RequestEvent {
	const formData = opts.formData ?? {};
	const cookieStore = new Map(Object.entries(opts.cookies ?? {}));
	// cookie set 時に渡された options を name 単位で保存する。
	// secure / httpOnly / sameSite 等の検証をテスト側で行えるようにするため。
	const cookieOptions = new Map<string, Record<string, unknown>>();
	const headers = new Headers(opts.request?.headers ?? {});

	const fakeRequest = {
		formData: async () => {
			const fd = new FormData();
			for (const [k, v] of Object.entries(formData)) {
				fd.set(k, v);
			}
			return fd;
		},
		headers
	};

	const event = {
		request: fakeRequest as unknown as Request,
		params: opts.params ?? {},
		locals: { user: opts.user ?? null } as App.Locals,
		platform: opts.platform,
		url: opts.url ?? new URL('http://localhost/'),
		cookies: {
			get: (name: string) => cookieStore.get(name),
			set: (name: string, value: string, options?: Record<string, unknown>) => {
				cookieStore.set(name, value);
				if (options) cookieOptions.set(name, options);
			},
			delete: (name: string) => {
				cookieStore.delete(name);
				cookieOptions.delete(name);
			},
			getAll: () =>
				Array.from(cookieStore.entries()).map(([name, value]) => ({ name, value })),
			serialize: () => '',
			// テスト専用: 直近 set された options を取得するための拡張。
			// production code 側からは触らないので型キャストで隠す。
			__getOptions: (name: string) => cookieOptions.get(name)
		},
		getClientAddress: opts.getClientAddress ?? (() => '127.0.0.1'),
		fetch: globalThis.fetch,
		setHeaders: () => {},
		isDataRequest: false,
		isSubRequest: false,
		route: { id: null },
		// Svelte 5 / Kit 2 の最近の追加プロパティはテストでは使わないので最小化
		isRemoteRequest: false
	};

	return event as unknown as RequestEvent;
}

export interface CallActionResult<T = unknown> {
	/** HTTP-ish status: 200 = 通常返り値, 302/303/... = redirect, 400-599 = error/fail */
	status: number;
	/** action の通常返り値、または fail() の data */
	body?: T;
	/** redirect 先（throw redirect 時） */
	redirect?: string;
	/** error() で throw された body（{ message } など） */
	thrownError?: unknown;
	/** fail() の生 ActionFailure（必要時のため） */
	failure?: unknown;
}

/**
 * action 関数を呼び、redirect / error / fail / 通常返り値を統一フォーマットで返す。
 *
 * @example
 *   const r = await callAction(actions.editStory, { user: alice, params: { id: '1' }, ...});
 *   expect(r.status).toBe(403);
 */
export async function callAction<T = unknown>(
	action: (event: RequestEvent) => Promise<T> | T,
	opts: BuildEventOpts
): Promise<CallActionResult<T>> {
	const event = buildRequestEvent(opts);
	try {
		const result = await action(event);
		// fail() は throw ではなく ActionFailure を return する
		if (isActionFailure(result)) {
			const af = result as unknown as { status: number; data: unknown };
			return { status: af.status, body: af.data as T, failure: result };
		}
		return { status: 200, body: result as T };
	} catch (e) {
		if (isRedirect(e)) {
			return { status: e.status, redirect: e.location };
		}
		if (isHttpError(e)) {
			return { status: e.status, thrownError: e.body };
		}
		throw e;
	}
}
