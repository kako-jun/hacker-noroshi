import type { PageServerLoad } from './$types';
import { getDB, getFavoriteStoriesByUserId, getVotedStoryIds, getFlaggedItemIds } from '$lib/server/db';
import { resolveUserOrRedirect } from '$lib/server/userRoute';

export const load: PageServerLoad = async ({ params, url, platform, locals }) => {
	const db = getDB(platform);
	const username = params.id;
	const page = parseInt(url.searchParams.get('p') || '1', 10);

	const user = await resolveUserOrRedirect(db, username, '/favorites', url);

	// 削除済みユーザーの favorites はプライバシー観点で非公開（#76）。
	// 投稿・コメントはスレッド整合性のため [deleted] 名義で公開を続けるが、
	// 「何を気に入っていたか」は本人を辿る情報になりうるため空扱い。
	const showdead = locals.user?.showdead === 1;
	const favorites =
		user.deleted === 1 ? [] : await getFavoriteStoriesByUserId(db, user.id, page, 30, showdead);

	let votedIds: Set<number> = new Set();
	let flaggedIds: Set<number> = new Set();
	if (locals.user) {
		[votedIds, flaggedIds] = await Promise.all([
			getVotedStoryIds(db, locals.user.id, favorites.map((s) => s.id)),
			getFlaggedItemIds(db, locals.user.id, favorites.map((s) => s.id), 'story')
		]);
	}

	return {
		userDeleted: user.deleted,
		username: user.username,
		favorites,
		votedIds: Array.from(votedIds),
		flaggedIds: Array.from(flaggedIds),
		page
	};
};
