import type { PageServerLoad, Actions } from './$types';
import { getDB, getStoryById, getCommentsByStoryId, getVotedCommentIds, hasVoted } from '$lib/server/db';
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
	}
};
