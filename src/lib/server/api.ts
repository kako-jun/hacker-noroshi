// 公開 API v0 用の共通ヘルパ (Issue #131)
//
// 本家 HN の Firebase API (https://github.com/HackerNews/API) と互換に近い
// 読み取り専用 JSON エンドポイントを提供する。
//
// 設計方針:
// - 認証は不要（locals.user は使わない）。`platform.env.DB` のみ参照する
// - レスポンスは HN 互換形（id 配列 / story object / comment object / user object）
// - 時刻は ISO-8601 (D1) → Unix 秒に変換して返す
// - CORS は `*`（誰でも叩ける）。Cache-Control で edge / browser の TTL を分ける
// - dead / deleted は隠蔽せず、フィールドとして真偽値で返す（HN と同様）
// - listing endpoint は dead を含めない（showdead=true は public API では未対応）

import type { CommentRow, StoryRow, UserRow } from './db';

// ISO-8601 文字列（"2026-01-01T00:00:00Z" 形式 / D1 が返す形式）を Unix 秒に変換する。
// 不正な値や null/undefined のときは 0 を返す（API レスポンスから除外しない方針）。
// 実運用では DB の created_at は NOT NULL DEFAULT で常に値が入っているため、
// 0 が返るのはテーブル外データを通したときの保険的な分岐。
export function isoToUnix(iso: string | null | undefined): number {
	if (!iso) return 0;
	const ms = new Date(iso).getTime();
	if (Number.isNaN(ms)) return 0;
	return Math.floor(ms / 1000);
}

export interface JsonResponseOptions {
	status?: number;
	// browser cache 秒数。Cache-Control: max-age=<maxAge>
	maxAge?: number;
	// edge (Cloudflare) cache 秒数。Cache-Control: s-maxage=<sMaxAge>
	sMaxAge?: number;
}

// 公開 API 共通の JSON レスポンス。CORS / Cache-Control / Content-Type をまとめて付ける。
// edge cache を使うが Vary: Origin は付けない（CORS は `*` で誰でも同じレスポンス）。
export function jsonResponse(data: unknown, opts: JsonResponseOptions = {}): Response {
	const { status = 200, maxAge, sMaxAge } = opts;
	const headers: Record<string, string> = {
		'Content-Type': 'application/json; charset=utf-8',
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type'
	};
	if (status === 200 && (maxAge !== undefined || sMaxAge !== undefined)) {
		const parts: string[] = ['public'];
		if (maxAge !== undefined) parts.push(`max-age=${maxAge}`);
		if (sMaxAge !== undefined) parts.push(`s-maxage=${sMaxAge}`);
		headers['Cache-Control'] = parts.join(', ');
	} else if (status >= 400) {
		// エラーは絶対にキャッシュさせない
		headers['Cache-Control'] = 'no-store';
	}
	return new Response(JSON.stringify(data), { status, headers });
}

// よく使う 404 / 500 のショートカット。
export function notFound(): Response {
	return jsonResponse({ error: 'not found' }, { status: 404 });
}

export function internalError(): Response {
	return jsonResponse({ error: 'internal' }, { status: 500 });
}

// 投稿者削除済み (user_deleted=1) の表示名。サイト UI の `displayUsername` と
// 揃えて API でも "[deleted]" を返し、元の username を露出させない。
const DELETED_BY = '[deleted]';

// HN 互換の story item オブジェクト。`type` は stories.type をそのまま返す
// （schema 上 'story' / 'ask' / 'show' / 'poll' の 4 種、HN の 'job' は無し）。
// HN には `kids` (immediate children id), `descendants` (total comment count) がある。
export interface ApiStory {
	id: number;
	type: string;
	by: string; // 投稿者削除時は "[deleted]"
	time: number; // Unix 秒
	title: string;
	url: string | null;
	text: string | null;
	score: number;
	descendants: number;
	kids: number[];
	dead: boolean;
	// 投稿者のアカウント削除を示す独自フィールド。HN の `deleted` (投稿そのもの削除) とは
	// 意味が異なる。詳細は /api-docs の Differences from HN を参照。
	deleted: boolean;
}

export function serializeStory(row: StoryRow, kids: number[]): ApiStory {
	const deleted = row.user_deleted === 1;
	return {
		id: row.id,
		type: row.type,
		by: deleted ? DELETED_BY : row.username,
		time: isoToUnix(row.created_at),
		title: row.title,
		url: row.url ?? null,
		text: row.text ?? null,
		score: row.points,
		descendants: row.comment_count,
		kids,
		dead: row.dead === 1,
		deleted
	};
}

// HN 互換の comment item オブジェクト。`type: "comment"`、`parent` 必須。
export interface ApiComment {
	id: number;
	type: 'comment';
	by: string;
	time: number;
	text: string;
	parent: number;
	score: number;
	kids: number[];
	dead: boolean;
	deleted: boolean;
}

export function serializeComment(row: CommentRow, kids: number[]): ApiComment {
	const deleted = row.user_deleted === 1;
	return {
		id: row.id,
		type: 'comment',
		by: deleted ? DELETED_BY : row.username,
		time: isoToUnix(row.created_at),
		text: row.text,
		// HN の `parent` は「直接の親」。トップレベルなら story id、ネストなら親 comment id。
		parent: row.parent_id ?? row.story_id,
		score: row.points,
		kids,
		dead: row.dead === 1,
		deleted
	};
}

// HN 互換の user オブジェクト。submitted 配列は重いので返さない（未実装）。
export interface ApiUser {
	id: string; // username
	created: number; // Unix 秒
	karma: number;
	about: string;
}

export function serializeUser(row: UserRow): ApiUser {
	return {
		id: row.username,
		created: isoToUnix(row.created_at),
		karma: row.karma,
		// 削除済みアカウントは about を空にしている（deleteAccount で消去）。
		// HN は about を string で返す（HTML 含むこともある）ので素通しする。
		about: row.about ?? ''
	};
}

// CORS preflight 用の OPTIONS ハンドラ。各 +server.ts から再エクスポートする。
// `Allow-Origin: *` + `Allow-Credentials` 無し前提（読み取り API、Cookie 不要）。
// 将来 POST を追加するときは Allow-Methods を更新するだけでなく credentialed
// リクエストの扱いも見直すこと。
export function corsPreflight(): Response {
	return new Response(null, {
		status: 204,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
			'Access-Control-Max-Age': '86400'
		}
	});
}

// listing endpoint の最大件数。HN は 500 だが、まずは 60 で開始（front page 6 ページ分相当）。
export const API_LISTING_LIMIT = 60;

// キャッシュ TTL プリセット
export const CACHE_LISTING = { maxAge: 10, sMaxAge: 60 } as const;
export const CACHE_ITEM = { maxAge: 30, sMaxAge: 300 } as const;
export const CACHE_USER = { maxAge: 60, sMaxAge: 300 } as const;

// listing 6 エンドポイントの共通実装。`fetchIds` は dead を含めない id 配列を
// 返すこと（API 仕様）。エラーは 500、成功は CACHE_LISTING で返す。
export async function listingResponse(
	logTag: string,
	fetchIds: () => Promise<number[]>
): Promise<Response> {
	try {
		const ids = await fetchIds();
		return jsonResponse(ids, CACHE_LISTING);
	} catch (err) {
		console.error(`[${logTag}]`, err);
		return internalError();
	}
}
