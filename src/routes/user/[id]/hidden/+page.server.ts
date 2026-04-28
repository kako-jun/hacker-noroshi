import type { PageServerLoad } from './$types';
import { getDB, getHiddenStoriesByUserId, getVotedStoryIds, getFlaggedItemIds } from '$lib/server/db';
import { resolveUserOrRedirect } from '$lib/server/userRoute';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, url, platform, locals }) => {
	const db = getDB(platform);
	const username = params.id;
	const page = parseInt(url.searchParams.get('p') || '1', 10);

	const user = await resolveUserOrRedirect(db, username, '/hidden', url);

	// must-3: 認可は id ベース。旧名 URL から本人がアクセスした場合は
	// resolveUserOrRedirect が先に redirect するが、防御的に id で比較する。
	if (!locals.user || locals.user.id !== user.id) {
		throw error(403, 'Forbidden');
	}

	const showdead = locals.user?.showdead === 1;
	const hidden = await getHiddenStoriesByUserId(db, user.id, page, 30, showdead);

	let votedIds: Set<number> = new Set();
	let flaggedIds: Set<number> = new Set();
	if (locals.user) {
		[votedIds, flaggedIds] = await Promise.all([
			getVotedStoryIds(db, locals.user.id, hidden.map((s) => s.id)),
			getFlaggedItemIds(db, locals.user.id, hidden.map((s) => s.id), 'story')
		]);
	}

	return {
		username: user.username,
		hidden,
		votedIds: Array.from(votedIds),
		flaggedIds: Array.from(flaggedIds),
		page
	};
};
