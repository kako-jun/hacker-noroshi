// GET /api/v0/activestories.json
// hacker-noroshi 拡張。最近コメントが付いたストーリーを返す（/active 相当）。
// 本家 HN の Firebase API には無いが、ハッカーのろし のサイト機能と揃える。
import type { RequestHandler } from './$types';
import { getDB, getActiveStories } from '$lib/server/db';
import { listingResponse, corsPreflight, API_LISTING_LIMIT } from '$lib/server/api';

export const GET: RequestHandler = ({ platform }) =>
	listingResponse('api/v0/activestories', async () => {
		const stories = await getActiveStories(getDB(platform), 1, API_LISTING_LIMIT, false);
		return stories.map((s) => s.id);
	});

export const OPTIONS: RequestHandler = () => corsPreflight();
