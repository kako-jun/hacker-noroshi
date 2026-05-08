// GET /api/v0/showstories.json
// 本家 HN /showstories.json 互換。type='show' を rank 順で返す。
import type { RequestHandler } from './$types';
import { getDB, getStories } from '$lib/server/db';
import { listingResponse, corsPreflight, API_LISTING_LIMIT } from '$lib/server/api';

export const GET: RequestHandler = ({ platform }) =>
	listingResponse('api/v0/showstories', async () => {
		const stories = await getStories(getDB(platform), {
			type: 'show',
			orderBy: 'rank',
			page: 1,
			limit: API_LISTING_LIMIT,
			showdead: false
		});
		return stories.map((s) => s.id);
	});

export const OPTIONS: RequestHandler = () => corsPreflight();
