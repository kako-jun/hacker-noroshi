import type { PageServerLoad } from './$types';
import { getDB, getStoryById, getCommentById, getChildComments, getCommentVoteStates, getFlaggedItemIds, hasFlagged, getPollOptions } from '$lib/server/db';
import { error } from '@sveltejs/kit';
import { actions } from '$lib/server/itemActions';

// /comment/[id] はコメント permalink 専用（#164）。stories と comments は id 空間が
// 衝突する別テーブルなので、コメントは story と分離したこのルートで解決する。
export const load: PageServerLoad = async ({ params, platform, locals }) => {
	const db = getDB(platform);
	const id = parseInt(params.id, 10);

	if (isNaN(id)) {
		throw error(404, 'Not found');
	}

	const showdead = locals.user?.showdead === 1;

	const comment = await getCommentById(db, id);
	if (!comment) {
		throw error(404, 'Not found');
	}

	const parentStory = await getStoryById(db, comment.story_id);
	if (!parentStory) {
		throw error(404, 'Parent story not found');
	}

	const childComments = await getChildComments(db, comment.id, comment.story_id, locals.user?.id, showdead);

	let commentVoted = false;
	let commentFlagged = false;
	let commentVoteStates: Map<number, 'up' | 'down'> = new Map();
	let flaggedCommentIds: Set<number> = new Set();

	if (locals.user) {
		const allCommentIds = [comment.id, ...childComments.map((c) => c.id)];
		[commentVoteStates, flaggedCommentIds, commentFlagged] = await Promise.all([
			getCommentVoteStates(db, locals.user.id, allCommentIds),
			getFlaggedItemIds(db, locals.user.id, allCommentIds, 'comment'),
			hasFlagged(db, locals.user.id, comment.id, 'comment')
		]);
		commentVoted = commentVoteStates.get(comment.id) === 'up';
	}

	return {
		mode: 'comment' as const,
		targetComment: comment,
		parentStory,
		comments: childComments,
		commentVoted,
		commentFlagged,
		commentVoteStates: Object.fromEntries(commentVoteStates),
		flaggedCommentIds: Array.from(flaggedCommentIds),
		pollOptions: [] as Awaited<ReturnType<typeof getPollOptions>>,
		pollVotedOptionIds: [] as number[]
	};
};

export { actions };
