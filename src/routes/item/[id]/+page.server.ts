import type { PageServerLoad, Actions } from './$types';
import { getDB, getStoryById, getCommentsByStoryId, getCommentById, getChildComments, getCommentVoteStates, getVoteState, hasFavorited, hasFlagged, getFlaggedItemIds } from '$lib/server/db';
import { TWO_WEEKS_MS } from '$lib/ranking';
import { error, fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, platform, locals }) => {
	const db = getDB(platform);
	const id = parseInt(params.id, 10);

	if (isNaN(id)) {
		throw error(404, 'Not found');
	}

	const showdead = locals.user?.showdead === 1;

	// Try story first
	const story = await getStoryById(db, id);
	if (story) {
		const comments = await getCommentsByStoryId(db, id, locals.user?.id, showdead);

		let storyVoted = false;
		let storyFavorited = false;
		let storyFlagged = false;
		let commentVoteStates: Map<number, 'up' | 'down'> = new Map();
		let flaggedCommentIds: Set<number> = new Set();

		if (locals.user) {
			const [storyVoteState, fav, cvs, flag, fcids] = await Promise.all([
				getVoteState(db, locals.user.id, id, 'story'),
				hasFavorited(db, locals.user.id, id),
				getCommentVoteStates(db, locals.user.id, comments.map((c) => c.id)),
				hasFlagged(db, locals.user.id, id, 'story'),
				getFlaggedItemIds(db, locals.user.id, comments.map((c) => c.id), 'comment')
			]);
			storyVoted = storyVoteState === 'up';
			storyFavorited = fav;
			storyFlagged = flag;
			commentVoteStates = cvs;
			flaggedCommentIds = fcids;
		}

		return {
			mode: 'story' as const,
			story,
			comments,
			storyVoted,
			storyFavorited,
			storyFlagged,
			commentVoteStates: Object.fromEntries(commentVoteStates),
			flaggedCommentIds: Array.from(flaggedCommentIds)
		};
	}

	// Not a story — try comment
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
		flaggedCommentIds: Array.from(flaggedCommentIds)
	};
};

async function resolveStory(db: D1Database, itemId: number): Promise<{ id: number; created_at: string }> {
	const story = await getStoryById(db, itemId);
	if (story) return story;
	const comment = await getCommentById(db, itemId);
	if (comment) {
		const parentStory = await getStoryById(db, comment.story_id);
		if (parentStory) return parentStory;
	}
	throw error(404, 'Not found');
}

export const actions: Actions = {
	comment: async ({ request, platform, locals, params }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const db = getDB(platform);
		const formData = await request.formData();
		const text = (formData.get('text') as string)?.trim();
		const parentId = formData.get('parent_id') as string | null;
		const itemId = parseInt(params.id, 10);

		if (!text) {
			return fail(400, { error: 'Comment text is required', errorFor: 'comment' });
		}

		// Rate limit: 2 minutes between comments
		const lastComment = await db
			.prepare('SELECT created_at FROM comments WHERE user_id = ? ORDER BY created_at DESC LIMIT 1')
			.bind(locals.user.id)
			.first<{ created_at: string }>();

		if (lastComment) {
			const elapsed = Date.now() - new Date(lastComment.created_at).getTime();
			if (elapsed < 2 * 60 * 1000) {
				return fail(429, { error: "You're posting too fast. Please slow down.", text, errorFor: 'comment' });
			}
		}

		const story = await resolveStory(db, itemId);

		const elapsed = Date.now() - new Date(story.created_at).getTime();
		if (elapsed >= TWO_WEEKS_MS) {
			return fail(403, { error: 'Thread is closed' });
		}
		const parentIdNum = parentId ? parseInt(parentId, 10) : null;

		await db
			.prepare(
				'INSERT INTO comments (text, user_id, story_id, parent_id) VALUES (?, ?, ?, ?)'
			)
			.bind(text, locals.user.id, story.id, parentIdNum)
			.run();

		await db
			.prepare('UPDATE stories SET comment_count = comment_count + 1 WHERE id = ?')
			.bind(story.id)
			.run();

		return { success: true };
	},

	editStory: async ({ request, platform, locals, params }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const db = getDB(platform);
		const storyId = parseInt(params.id, 10);
		const story = await getStoryById(db, storyId);

		if (!story) {
			throw error(404, 'Story not found');
		}

		if (story.user_id !== locals.user.id) {
			throw error(403, 'Cannot edit another user\'s story');
		}

		const elapsed = Date.now() - new Date(story.created_at).getTime();
		if (elapsed >= 2 * 60 * 60 * 1000) {
			return fail(400, { error: 'Editing window has expired (2 hours)' });
		}

		const formData = await request.formData();
		const title = (formData.get('title') as string)?.trim();
		const text = (formData.get('text') as string) ?? '';

		if (!title) {
			return fail(400, { error: 'Title is required' });
		}

		let type = 'story';
		if (title.startsWith('Ask HN:')) {
			type = 'ask';
		} else if (title.startsWith('Show HN:')) {
			type = 'show';
		}

		await db
			.prepare('UPDATE stories SET title = ?, text = ?, type = ? WHERE id = ?')
			.bind(title, text || null, type, storyId)
			.run();

		return { success: true };
	},

	editComment: async ({ request, platform, locals }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const db = getDB(platform);
		const formData = await request.formData();
		const commentId = parseInt(formData.get('comment_id') as string, 10);
		const text = (formData.get('text') as string)?.trim();

		if (!text) {
			return fail(400, { error: 'Comment text is required' });
		}

		const comment = await getCommentById(db, commentId);
		if (!comment) {
			throw error(404, 'Comment not found');
		}

		if (comment.user_id !== locals.user.id) {
			throw error(403, 'Cannot edit another user\'s comment');
		}

		const elapsed = Date.now() - new Date(comment.created_at).getTime();
		if (elapsed >= 2 * 60 * 60 * 1000) {
			return fail(400, { error: 'Editing window has expired (2 hours)' });
		}

		await db
			.prepare('UPDATE comments SET text = ? WHERE id = ?')
			.bind(text, commentId)
			.run();

		return { success: true };
	},

	deleteStory: async ({ platform, locals, params }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const db = getDB(platform);
		const storyId = parseInt(params.id, 10);
		const story = await getStoryById(db, storyId);

		if (!story) {
			throw error(404, 'Story not found');
		}

		if (story.user_id !== locals.user.id) {
			throw error(403, "Cannot delete another user's story");
		}

		const elapsed = Date.now() - new Date(story.created_at).getTime();
		if (elapsed >= 2 * 60 * 60 * 1000) {
			return fail(400, { error: 'Cannot delete after 2 hours' });
		}

		// 既に削除済みなら DB 書き込みをスキップ（冪等）
		if (story.title === '[deleted]') {
			return { success: true };
		}

		await db
			.prepare('UPDATE stories SET title = ?, url = ?, text = ? WHERE id = ?')
			.bind('[deleted]', null, '[deleted]', storyId)
			.run();

		return { success: true };
	},

	deleteComment: async ({ request, platform, locals }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const db = getDB(platform);
		const formData = await request.formData();
		const commentId = parseInt(formData.get('comment_id') as string, 10);

		const comment = await getCommentById(db, commentId);
		if (!comment) {
			throw error(404, 'Comment not found');
		}

		if (comment.user_id !== locals.user.id) {
			throw error(403, "Cannot delete another user's comment");
		}

		const elapsed = Date.now() - new Date(comment.created_at).getTime();
		if (elapsed >= 2 * 60 * 60 * 1000) {
			return fail(400, { error: 'Cannot delete after 2 hours' });
		}

		// 既に削除済みなら DB 書き込みをスキップ（冪等）
		if (comment.text === '[deleted]') {
			return { success: true };
		}

		await db
			.prepare('UPDATE comments SET text = ? WHERE id = ?')
			.bind('[deleted]', commentId)
			.run();

		return { success: true };
	}
};
