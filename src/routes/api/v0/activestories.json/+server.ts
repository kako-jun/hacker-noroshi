// GET /api/v0/activestories.json
// hacker-noroshi 拡張。最近コメントが付いたストーリーを返す（/active 相当）。
// 本家 HN の Firebase API には無いが、ハッカーのろし のサイト機能と揃える。
import type { RequestHandler } from './$types';
import { getDB, getActiveStories } from '$lib/server/db';
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
		const stories = await getActiveStories(db, 1, API_LISTING_LIMIT, false);
		return jsonResponse(stories.map((s) => s.id), CACHE_LISTING);
	} catch (err) {
		console.error('[api/v0/activestories]', err);
		return internalError();
	}
};

export const OPTIONS: RequestHandler = () => corsPreflight();
