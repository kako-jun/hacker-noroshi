// GET /api/v0/topstories.json
// 本家 HN /topstories.json 互換。フロントページ相当のランキング上位 id を返す。
// 内部実装は `/` と同じ `getStories({orderBy: 'rank'})`（HN スコアリング）。
// dead は含めない（public API は showdead 非対応）。
import type { RequestHandler } from './$types';
import { getDB, getStories } from '$lib/server/db';
import {
	jsonResponse,
	internalError,
	corsPreflight,
	API_LISTING_LIMIT,
	CACHE_LISTING
} from '$lib/server/api';

export const GET: RequestHandler = async ({ platform }) => {
	try {
		const db = getDB(platform);
		const stories = await getStories(db, {
			orderBy: 'rank',
			page: 1,
			limit: API_LISTING_LIMIT,
			showdead: false
		});
		return jsonResponse(stories.map((s) => s.id), CACHE_LISTING);
	} catch (err) {
		console.error('[api/v0/topstories]', err);
		return internalError();
	}
};

export const OPTIONS: RequestHandler = () => corsPreflight();
