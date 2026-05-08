// GET /api/v0/beststories.json
// 本家 HN /beststories.json 互換。points 降順で id を返す。
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
			orderBy: 'best',
			page: 1,
			limit: API_LISTING_LIMIT,
			showdead: false
		});
		return jsonResponse(stories.map((s) => s.id), CACHE_LISTING);
	} catch (err) {
		console.error('[api/v0/beststories]', err);
		return internalError();
	}
};

export const OPTIONS: RequestHandler = () => corsPreflight();
