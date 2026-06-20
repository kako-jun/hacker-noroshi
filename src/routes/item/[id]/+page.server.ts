import type { PageServerLoad } from './$types';
import { getDB, getStoryById, getCommentsByStoryId, getCommentVoteStates, getVoteState, hasFavorited, hasFlagged, hasHidden, getFlaggedItemIds, getPollOptions, getPollOptionsVoted } from '$lib/server/db';
import { error, redirect } from '@sveltejs/kit';
import { actions } from '$lib/server/itemActions';

// /item/[id] は story 専用。コメント permalink は /comment/[id] に分離した（#164）。
// story でない id（コメント id 等）は /comment/{id} へ 308 リダイレクトする。
export const load: PageServerLoad = async ({ params, platform, locals }) => {
	const db = getDB(platform);
	const id = parseInt(params.id, 10);

	if (isNaN(id)) {
		throw error(404, 'Not found');
	}

	const showdead = locals.user?.showdead === 1;

	const story = await getStoryById(db, id);
	if (!story) {
		// story でなければコメント permalink とみなして /comment/{id} へ恒久転送する。
		throw redirect(308, '/comment/' + id);
	}

	const comments = await getCommentsByStoryId(db, id, locals.user?.id, showdead);

	let storyVoted = false;
	let storyFavorited = false;
	let storyFlagged = false;
	let storyHidden = false;
	let commentVoteStates: Map<number, 'up' | 'down'> = new Map();
	let flaggedCommentIds: Set<number> = new Set();

	if (locals.user) {
		const [storyVoteState, fav, cvs, flag, fcids, hidden] = await Promise.all([
			getVoteState(db, locals.user.id, id, 'story'),
			hasFavorited(db, locals.user.id, id),
			getCommentVoteStates(db, locals.user.id, comments.map((c) => c.id)),
			hasFlagged(db, locals.user.id, id, 'story'),
			getFlaggedItemIds(db, locals.user.id, comments.map((c) => c.id), 'comment'),
			hasHidden(db, locals.user.id, id)
		]);
		storyVoted = storyVoteState === 'up';
		storyFavorited = fav;
		storyFlagged = flag;
		commentVoteStates = cvs;
		flaggedCommentIds = fcids;
		storyHidden = hidden;
	}

	// poll の場合は選択肢と投票状況も取得する。
	let pollOptions: Awaited<ReturnType<typeof getPollOptions>> = [];
	let pollVotedOptionIds: number[] = [];
	if (story.type === 'poll') {
		pollOptions = await getPollOptions(db, story.id);
		if (locals.user) {
			const voted = await getPollOptionsVoted(db, locals.user.id, story.id);
			pollVotedOptionIds = Array.from(voted);
		}
	}

	return {
		mode: 'story' as const,
		story,
		comments,
		storyVoted,
		storyFavorited,
		storyFlagged,
		storyHidden,
		commentVoteStates: Object.fromEntries(commentVoteStates),
		flaggedCommentIds: Array.from(flaggedCommentIds),
		pollOptions,
		pollVotedOptionIds
	};
};

export { actions };
