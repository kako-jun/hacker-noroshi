// GET /api/v0/beststories.json
// 本家 HN /beststories.json 互換。points 降順で id を返す。
import type { RequestHandler } from './$types';
import { getDB, getStories } from '$lib/server/db';
import { listingResponse, corsPreflight, API_LISTING_LIMIT } from '$lib/server/api';

export const GET: RequestHandler = ({ platform }) =>
	listingResponse('api/v0/beststories', async () => {
		const stories = await getStories(getDB(platform), {
			orderBy: 'best',
			page: 1,
			limit: API_LISTING_LIMIT,
			showdead: false
		});
		return stories.map((s) => s.id);
	});

export const OPTIONS: RequestHandler = () => corsPreflight();
