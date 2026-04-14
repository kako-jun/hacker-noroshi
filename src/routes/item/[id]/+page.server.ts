import type { PageServerLoad, Actions } from './$types';
import { getDB, getStoryById, getCommentsByStoryId, getCommentById, getVotedCommentIds, hasVoted } from '$lib/server/db';
import { error, fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, platform, locals }) => {
	const db = getDB(platform);
	const id = parseInt(params.id, 10);

	if (isNaN(id)) {
		throw error(404, 'Story not found');
	}

	const story = await getStoryById(db, id);
	if (!story) {
		throw error(404, 'Story not found');
	}

	const comments = await getCommentsByStoryId(db, id);

	let storyVoted = false;
	let votedCommentIds: Set<number> = new Set();

	if (locals.user) {
		storyVoted = await hasVoted(db, locals.user.id, id, 'story');
		votedCommentIds = await getVotedCommentIds(
			db,
			locals.user.id,
			comments.map((c) => c.id)
		);
	}

	return {
		story,
		comments,
		storyVoted,
		votedCommentIds: Array.from(votedCommentIds)
	};
};

export const actions: Actions = {
	comment: async ({ request, platform, locals, params }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const db = getDB(platform);
		const formData = await request.formData();
		const text = (formData.get('text') as string)?.trim();
		const parentId = formData.get('parent_id') as string | null;
		const storyId = parseInt(params.id, 10);

		if (!text) {
			return fail(400, { error: 'Comment text is required' });
		}

		const parentIdNum = parentId ? parseInt(parentId, 10) : null;

		await db
			.prepare(
				'INSERT INTO comments (text, user_id, story_id, parent_id) VALUES (?, ?, ?, ?)'
			)
			.bind(text, locals.user.id, storyId, parentIdNum)
			.run();

		await db
			.prepare('UPDATE stories SET comment_count = comment_count + 1 WHERE id = ?')
			.bind(storyId)
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
	}
};
