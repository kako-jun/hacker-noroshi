import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDB, getStoriesByDomain, getVotedStoryIds, getHiddenStoryIds, getFlaggedItemIds } from '$lib/server/db';
import { extractDomain } from '$lib/ranking';

export const load: PageServerLoad = async ({ url, platform, locals }) => {
	const db = getDB(platform);
	const rawSite = url.searchParams.get('site') ?? '';
	const site = rawSite.trim().toLowerCase().replace(/^www\./, '');
	if (!site) {
		throw redirect(303, '/');
	}
	const page = parseInt(url.searchParams.get('p') || '1', 10);

	const showdead = locals.user?.showdead === 1;

	// Fetch double the limit so re-filter and hidden exclusion don't strand pages
	let stories = await getStoriesByDomain(db, site, page, 60, showdead);

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

	const hasMore = stories.length > 30;
	stories = stories.slice(0, 30);

	return {
		site,
		stories,
		page,
		hasMore,
		votedIds: Array.from(votedIds),
		flaggedIds: Array.from(flaggedIds)
	};
};
