import type { PageServerLoad } from './$types';
import { getDB, getHighlightedComments, getCommentVoteStates, getFlaggedItemIds } from '$lib/server/db';

export const load: PageServerLoad = async ({ url, platform, locals }) => {
	const db = getDB(platform);
	const page = parseInt(url.searchParams.get('p') || '1', 10);
	const showdead = locals.user?.showdead === 1;
	// /bestcomments と差別化: 点数 5pt 以上 + ストーリー内コメント数 3 以上のスレッドのみ。
	// 60件取得して delay フィルタ後にも 30件埋まる確率を上げ、hasMore を確実に判定する
	let comments = await getHighlightedComments(db, {
		minPoints: 5,
		minStoryCommentCount: 3,
		page,
		limit: 60,
		currentUserId: locals.user?.id,
		showdead
	});

	const hasMore = comments.length > 30;
	comments = comments.slice(0, 30);

	let commentVoteStates: Map<number, 'up' | 'down'> = new Map();
	let flaggedCommentIds: Set<number> = new Set();
	if (locals.user) {
		[commentVoteStates, flaggedCommentIds] = await Promise.all([
			getCommentVoteStates(db, locals.user.id, comments.map((c) => c.id)),
			getFlaggedItemIds(db, locals.user.id, comments.map((c) => c.id), 'comment')
		]);
	}

	return {
		comments,
		commentVoteStates: Object.fromEntries(commentVoteStates),
		flaggedCommentIds: Array.from(flaggedCommentIds),
		page,
		hasMore
	};
};
