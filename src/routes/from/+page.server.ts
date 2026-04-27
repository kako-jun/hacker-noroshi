import type { PageServerLoad } from './$types';
import { getDB, getStoriesByDomain, getVotedStoryIds, getHiddenStoryIds, getFlaggedItemIds } from '$lib/server/db';
import { extractDomain } from '$lib/ranking';

export const load: PageServerLoad = async ({ url, platform, locals }) => {
	const db = getDB(platform);
	const rawSite = url.searchParams.get('site') ?? '';
	const site = rawSite.trim().toLowerCase().replace(/^www\./, '');
	const page = parseInt(url.searchParams.get('p') || '1', 10);

	const showdead = locals.user?.showdead === 1;

	let stories = site
		? await getStoriesByDomain(db, site, page, 30, showdead)
		: [];

	// Re-filter by extracted domain (LIKE patterns can over-match path segments)
	stories = stories.filter((s) => extractDomain(s.url) === site);

	let votedIds: Set<number> = new Set();
	let hiddenIds: Set<number> = new Set();
	let flaggedIds: Set<number> = new Set();
	if (locals.user && stories.length > 0) {
		[votedIds, hiddenIds, flaggedIds] = await Promise.all([
			getVotedStoryIds(db, locals.user.id, stories.map((s) => s.id)),
			getHiddenStoryIds(db, locals.user.id),
			getFlaggedItemIds(db, locals.user.id, stories.map((s) => s.id), 'story')
		]);
		stories = stories.filter((s) => !hiddenIds.has(s.id));
	}

	return {
		site,
		stories,
		page,
		votedIds: Array.from(votedIds),
		flaggedIds: Array.from(flaggedIds)
	};
};
