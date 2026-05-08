// GET /api/v0/item/{id}.json
// 本家 HN /item/{id}.json 互換。stories と comments を同じ id 空間で扱う。
//
// stories と comments は別テーブルだが、本家 HN の挙動に合わせて
// 「同じ id を story と comment 両方検索 → 当たった方を返す」方式とする。
// hacker-noroshi では stories.id と comments.id は別 sequence なので衝突しうるが、
// 既存の /item/[id] ルート (src/routes/item/[id]) も同じく story → comment の
// 順で検索しているため、それに揃える（story を優先）。
//
// レスポンス:
//   - story: { id, type, by, time, title, url, text, score, descendants, kids, dead, deleted }
//   - comment: { id, type='comment', by, time, text, parent, score, kids, dead, deleted }
//   - kids は immediate children のみ（HN と同じ）
//   - 見つからなければ 404 + { error: 'not found' }
import type { RequestHandler } from './$types';
import { getDB, getStoryById, getCommentById } from '$lib/server/db';
import {
	jsonResponse,
	notFound,
	internalError,
	corsPreflight,
	serializeStory,
	serializeComment,
	CACHE_ITEM
} from '$lib/server/api';

// story の immediate children (parent_id IS NULL) を取得する。
async function getStoryKids(db: D1Database, storyId: number): Promise<number[]> {
	const r = await db
		.prepare(
			`SELECT id FROM comments
			WHERE story_id = ? AND parent_id IS NULL AND dead = 0
			ORDER BY created_at ASC`
		)
		.bind(storyId)
		.all<{ id: number }>();
	return r.results.map((row) => row.id);
}

// comment の immediate children (parent_id = ?) を取得する。
async function getCommentKids(db: D1Database, commentId: number): Promise<number[]> {
	const r = await db
		.prepare(
			`SELECT id FROM comments
			WHERE parent_id = ? AND dead = 0
			ORDER BY created_at ASC`
		)
		.bind(commentId)
		.all<{ id: number }>();
	return r.results.map((row) => row.id);
}

export const GET: RequestHandler = async ({ params, platform }) => {
	const idStr = params.id;
	if (!idStr || !/^\d+$/.test(idStr)) {
		return notFound();
	}
	const id = Number(idStr);
	if (!Number.isFinite(id) || id <= 0) {
		return notFound();
	}

	try {
		const db = getDB(platform);

		// まず story を引く（多くの問い合わせは story id 想定）
		const story = await getStoryById(db, id);
		if (story) {
			const kids = await getStoryKids(db, story.id);
			return jsonResponse(serializeStory(story, kids), CACHE_ITEM);
		}

		// story でなければ comment を引く
		const comment = await getCommentById(db, id);
		if (comment) {
			const kids = await getCommentKids(db, comment.id);
			return jsonResponse(serializeComment(comment, kids), CACHE_ITEM);
		}

		return notFound();
	} catch (err) {
		console.error('[api/v0/item]', err);
		return internalError();
	}
};

export const OPTIONS: RequestHandler = () => corsPreflight();
