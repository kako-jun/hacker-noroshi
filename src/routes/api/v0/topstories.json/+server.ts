// GET /api/v0/topstories.json
// 本家 HN /topstories.json 互換。フロントページ相当のランキング上位 id を返す。
// dead は含めない（public API は showdead 非対応）。
import type { RequestHandler } from './$types';
import { getDB, getStories } from '$lib/server/db';
import { listingResponse, corsPreflight, API_LISTING_LIMIT } from '$lib/server/api';

export const GET: RequestHandler = ({ platform }) =>
	listingResponse('api/v0/topstories', async () => {
		const stories = await getStories(getDB(platform), {
			orderBy: 'rank',
			page: 1,
			limit: API_LISTING_LIMIT,
			showdead: false
		});
		return stories.map((s) => s.id);
	});

export const OPTIONS: RequestHandler = () => corsPreflight();
