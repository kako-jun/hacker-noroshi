import type { PageServerLoad } from './$types';
import {
	getDB,
	searchStories,
	searchComments,
	getVotedStoryIds,
	getHiddenStoryIds,
	getCommentVoteStates,
	getFlaggedItemIds
} from '$lib/server/db';

export const load: PageServerLoad = async ({ url, platform, locals }) => {
	const db = getDB(platform);
	const q = url.searchParams.get('q')?.trim() || '';
	const rawType = url.searchParams.get('type') || 'all';
	const type = ['all', 'stories', 'comments'].includes(rawType) ? rawType : 'all';
	const page = parseInt(url.searchParams.get('p') || '1', 10);

	if (!q) {
		return { q, type, page, stories: [], comments: [], votedIds: [], flaggedIds: [], flaggedCommentIds: [], commentVoteStates: {} };
	}

	const showdead = locals.user?.showdead === 1;
	let stories: Awaited<ReturnType<typeof searchStories>> = [];
	let comments: Awaited<ReturnType<typeof searchComments>> = [];

	if (type === 'all' || type === 'stories') {
		stories = await searchStories(db, q, page, 30, showdead);
	}
	if (type === 'all' || type === 'comments') {
		comments = await searchComments(db, q, page, 30, locals.user?.id, showdead);
	}

	let votedIds: Set<number> = new Set();
	let hiddenIds: Set<number> = new Set();
	let flaggedIds: Set<number> = new Set();
	let flaggedCommentIds: Set<number> = new Set();
	let commentVoteStates: Map<number, 'up' | 'down'> = new Map();

	if (locals.user) {
		const storyIds = stories.map((s) => s.id);
		const commentIds = comments.map((c) => c.id);

		[votedIds, hiddenIds, commentVoteStates, flaggedIds, flaggedCommentIds] = await Promise.all([
			storyIds.length > 0
				? getVotedStoryIds(db, locals.user.id, storyIds)
				: Promise.resolve(new Set<number>()),
			getHiddenStoryIds(db, locals.user.id),
			commentIds.length > 0
				? getCommentVoteStates(db, locals.user.id, commentIds)
				: Promise.resolve(new Map<number, 'up' | 'down'>()),
			storyIds.length > 0
				? getFlaggedItemIds(db, locals.user.id, storyIds, 'story')
				: Promise.resolve(new Set<number>()),
			commentIds.length > 0
				? getFlaggedItemIds(db, locals.user.id, commentIds, 'comment')
				: Promise.resolve(new Set<number>())
		]);

		stories = stories.filter((s) => !hiddenIds.has(s.id));
	}

	return {
		q,
		type,
		page,
		stories,
		comments,
		votedIds: Array.from(votedIds),
		flaggedIds: Array.from(flaggedIds),
		flaggedCommentIds: Array.from(flaggedCommentIds),
		commentVoteStates: Object.fromEntries(commentVoteStates)
	};
};
