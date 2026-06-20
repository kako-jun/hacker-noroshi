import type { RequestEvent } from '@sveltejs/kit';
import { getDB, getStoryById, getCommentById } from '$lib/server/db';
import { TWO_WEEKS_MS } from '$lib/ranking';
import { error, fail, redirect } from '@sveltejs/kit';

/**
 * /item/[id]（story 専用）と /comment/[id]（comment permalink）の両ルートで
 * 共有するフォームアクション。route の `./$types` には依存できないので、
 * `RequestEvent` で受けて route 非依存に型付けする。
 *
 * #164: stories と comments は id 空間が衝突する別テーブル。コメント permalink
 * （/comment/{commentId}）上で params.id を story として解決すると、衝突時に
 * 誤った story へ返信が付いた。返信の story 解決は params.id を使わず、フォームの
 * parent_id（=親コメント）から `getCommentById → story_id → getStoryById` で
 * 辿るように修正した。top-level コメント（parent_id 無し = story ページのみ）は
 * 従来どおり params.id を story id として解決する。
 */
export const actions = {
	comment: async ({ request, platform, locals, params }: RequestEvent) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const db = getDB(platform);
		const formData = await request.formData();
		const text = (formData.get('text') as string)?.trim();
		const parentId = formData.get('parent_id') as string | null;

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

		const parentIdNum = parentId ? parseInt(parentId, 10) : null;

		// #164: story の解決は params.id ではなく parent_id 起点で行う。
		// 返信（parent_id あり）: 親コメントの story_id から story を引く。これで
		// /item でも /comment でも、id 衝突に関係なく正しい story に返信が付く。
		// top-level（parent_id 無し）: story ページからの投稿なので params.id が story id。
		let story: { id: number; created_at: string } | null;
		if (parentIdNum !== null) {
			const parentComment = await getCommentById(db, parentIdNum);
			if (!parentComment) {
				return fail(404, { error: 'Parent comment not found', errorFor: 'comment' });
			}
			story = await getStoryById(db, parentComment.story_id);
		} else {
			story = await getStoryById(db, parseInt(params.id ?? '', 10));
		}

		if (!story) {
			return fail(404, { error: 'Story not found', errorFor: 'comment' });
		}

		const elapsed = Date.now() - new Date(story.created_at).getTime();
		if (elapsed >= TWO_WEEKS_MS) {
			return fail(403, { error: 'Thread is closed' });
		}

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

	editStory: async ({ request, platform, locals, params }: RequestEvent) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const db = getDB(platform);
		const storyId = parseInt(params.id ?? '', 10);
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

		// poll の編集では type='poll' を維持する。タイトル先頭が "Ask HN:" / "Show HN:"
		// に変わっても type を書き換えない（書き換えると poll_options への参照は残るが
		// /polls 一覧や [poll] タグから外れて poll 機能が事実上消失するため）。
		// poll 以外は従来どおり title から自動判定。
		let type: string;
		if (story.type === 'poll') {
			type = 'poll';
		} else if (title.startsWith('Ask HN:')) {
			type = 'ask';
		} else if (title.startsWith('Show HN:')) {
			type = 'show';
		} else {
			type = 'story';
		}

		await db
			.prepare('UPDATE stories SET title = ?, text = ?, type = ? WHERE id = ?')
			.bind(title, text || null, type, storyId)
			.run();

		return { success: true };
	},

	editComment: async ({ request, platform, locals }: RequestEvent) => {
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

	deleteStory: async ({ platform, locals, params }: RequestEvent) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const db = getDB(platform);
		const storyId = parseInt(params.id ?? '', 10);
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

	deleteComment: async ({ request, platform, locals }: RequestEvent) => {
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
} satisfies Record<string, (event: RequestEvent) => unknown>;
