/**
 * src/routes/item/[id]/+page.server.ts の form action のユニットテスト。
 *
 * #95: PR #94 (#74 poll 投稿) のレビューで「editStory が type='poll' を保護する
 * ロジックを足したのに、対応する action テストが無い」と指摘された。
 * editStory / deleteStory は今後も触りやすい場所なので、型・認可・編集ウィンドウ・
 * 冪等性・poll 保護まで包括的にロックしておく。
 *
 * 設計:
 *   - 実 action（actions.editStory 等）を直接 import して呼ぶ。
 *   - SvelteKit の error/redirect/fail は callAction が吸収して { status, body, ... } に統一。
 *   - production コードはいじらない。テストのみ追加。
 */
import { describe, it, expect } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { actions } from '../../src/routes/item/[id]/+page.server';
import { callAction } from './helpers/action-helpers';
import { makeMockDB } from './helpers/mock-db';

// SvelteKit が生成する Action 型は RouteParams（id: string 必須）を要求するが、
// callAction はテスト用の汎用 RequestEvent を受け取るので、ここで一段ゆるめる。
// production の +page.server.ts 側は何もいじらない。
type AnyAction = (event: RequestEvent) => Promise<unknown> | unknown;
const editStory = actions.editStory as unknown as AnyAction;
const deleteStory = actions.deleteStory as unknown as AnyAction;

const ALICE = { id: 1, username: 'alice' };
const BOB = { id: 2, username: 'bob' };

const NOW = new Date().toISOString();
const THREE_HOURS_AGO = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

function platformOf(db: D1Database): { env: { DB: D1Database } } {
	return { env: { DB: db } };
}

describe('editStory action', () => {
	it('未ログインなら /login に 302', async () => {
		const { db } = makeMockDB({
			users: [ALICE],
			stories: [{ id: 10, user_id: 1, title: 'hello', created_at: NOW }]
		});
		const r = await callAction(editStory, {
			user: null,
			params: { id: '10' },
			platform: platformOf(db),
			formData: { title: 'new', text: '' }
		});
		expect(r.status).toBe(302);
		expect(r.redirect).toBe('/login');
	});

	it('存在しない story なら 404', async () => {
		const { db } = makeMockDB({ users: [ALICE] });
		const r = await callAction(editStory, {
			user: ALICE,
			params: { id: '999' },
			platform: platformOf(db),
			formData: { title: 'new', text: '' }
		});
		expect(r.status).toBe(404);
	});

	it('他人の story なら 403', async () => {
		const { db } = makeMockDB({
			users: [ALICE, BOB],
			stories: [{ id: 10, user_id: 2, title: 'bob owned', created_at: NOW }]
		});
		const r = await callAction(editStory, {
			user: ALICE,
			params: { id: '10' },
			platform: platformOf(db),
			formData: { title: 'new', text: '' }
		});
		expect(r.status).toBe(403);
	});

	it('編集ウィンドウ超過（2 時間以上経過）なら fail(400)', async () => {
		const { db } = makeMockDB({
			users: [ALICE],
			stories: [{ id: 10, user_id: 1, title: 'old', created_at: THREE_HOURS_AGO }]
		});
		const r = await callAction(editStory, {
			user: ALICE,
			params: { id: '10' },
			platform: platformOf(db),
			formData: { title: 'new', text: '' }
		});
		expect(r.status).toBe(400);
		expect((r.body as { error: string }).error).toMatch(/window/i);
	});

	it('title 空なら fail(400)', async () => {
		const { db } = makeMockDB({
			users: [ALICE],
			stories: [{ id: 10, user_id: 1, title: 'old', created_at: NOW }]
		});
		const r = await callAction(editStory, {
			user: ALICE,
			params: { id: '10' },
			platform: platformOf(db),
			formData: { title: '   ', text: '' }
		});
		expect(r.status).toBe(400);
		expect((r.body as { error: string }).error).toMatch(/Title/i);
	});

	it('通常 story を "Ask HN:" 始まりに編集すると type=ask になる', async () => {
		const { db, state } = makeMockDB({
			users: [ALICE],
			stories: [{ id: 10, user_id: 1, title: 'old', type: 'story', created_at: NOW }]
		});
		const r = await callAction(editStory, {
			user: ALICE,
			params: { id: '10' },
			platform: platformOf(db),
			formData: { title: 'Ask HN: how to focus?', text: '' }
		});
		expect(r.status).toBe(200);
		expect(state.stories[0].type).toBe('ask');
		expect(state.stories[0].title).toBe('Ask HN: how to focus?');
	});

	it('通常 story を "Show HN:" 始まりに編集すると type=show になる', async () => {
		const { db, state } = makeMockDB({
			users: [ALICE],
			stories: [{ id: 10, user_id: 1, title: 'old', type: 'story', created_at: NOW }]
		});
		const r = await callAction(editStory, {
			user: ALICE,
			params: { id: '10' },
			platform: platformOf(db),
			formData: { title: 'Show HN: my new app', text: '' }
		});
		expect(r.status).toBe(200);
		expect(state.stories[0].type).toBe('show');
	});

	it('通常 story を普通の title に編集すると type=story', async () => {
		const { db, state } = makeMockDB({
			users: [ALICE],
			stories: [{ id: 10, user_id: 1, title: 'old', type: 'ask', created_at: NOW }]
		});
		const r = await callAction(editStory, {
			user: ALICE,
			params: { id: '10' },
			platform: platformOf(db),
			formData: { title: 'A regular title', text: '' }
		});
		expect(r.status).toBe(200);
		expect(state.stories[0].type).toBe('story');
	});

	// poll 保護: PR #94 の回帰防止。title 先頭が変わっても type='poll' を維持する。
	it('poll を "Ask HN:" 始まりで編集しても type=poll のまま', async () => {
		const { db, state } = makeMockDB({
			users: [ALICE],
			stories: [{ id: 10, user_id: 1, title: 'best lang?', type: 'poll', created_at: NOW }]
		});
		const r = await callAction(editStory, {
			user: ALICE,
			params: { id: '10' },
			platform: platformOf(db),
			formData: { title: 'Ask HN: best lang?', text: '' }
		});
		expect(r.status).toBe(200);
		expect(state.stories[0].type).toBe('poll');
		expect(state.stories[0].title).toBe('Ask HN: best lang?');
	});

	it('poll を "Show HN:" 始まりで編集しても type=poll のまま', async () => {
		const { db, state } = makeMockDB({
			users: [ALICE],
			stories: [{ id: 10, user_id: 1, title: 'old', type: 'poll', created_at: NOW }]
		});
		const r = await callAction(editStory, {
			user: ALICE,
			params: { id: '10' },
			platform: platformOf(db),
			formData: { title: 'Show HN: poll widget', text: '' }
		});
		expect(r.status).toBe(200);
		expect(state.stories[0].type).toBe('poll');
	});

	it('poll を普通の title に編集しても type=poll のまま', async () => {
		const { db, state } = makeMockDB({
			users: [ALICE],
			stories: [{ id: 10, user_id: 1, title: 'old', type: 'poll', created_at: NOW }]
		});
		const r = await callAction(editStory, {
			user: ALICE,
			params: { id: '10' },
			platform: platformOf(db),
			formData: { title: 'Just a poll', text: '' }
		});
		expect(r.status).toBe(200);
		expect(state.stories[0].type).toBe('poll');
	});
});

describe('deleteStory action', () => {
	it('未ログインなら /login に 302', async () => {
		const { db } = makeMockDB({
			users: [ALICE],
			stories: [{ id: 10, user_id: 1, created_at: NOW }]
		});
		const r = await callAction(deleteStory, {
			user: null,
			params: { id: '10' },
			platform: platformOf(db)
		});
		expect(r.status).toBe(302);
		expect(r.redirect).toBe('/login');
	});

	it('存在しない story なら 404', async () => {
		const { db } = makeMockDB({ users: [ALICE] });
		const r = await callAction(deleteStory, {
			user: ALICE,
			params: { id: '999' },
			platform: platformOf(db)
		});
		expect(r.status).toBe(404);
	});

	it('他人の story なら 403', async () => {
		const { db } = makeMockDB({
			users: [ALICE, BOB],
			stories: [{ id: 10, user_id: 2, created_at: NOW }]
		});
		const r = await callAction(deleteStory, {
			user: ALICE,
			params: { id: '10' },
			platform: platformOf(db)
		});
		expect(r.status).toBe(403);
	});

	it('編集ウィンドウ超過（2 時間以上経過）なら fail(400)', async () => {
		const { db, state } = makeMockDB({
			users: [ALICE],
			stories: [{ id: 10, user_id: 1, title: 'old', created_at: THREE_HOURS_AGO }]
		});
		const r = await callAction(deleteStory, {
			user: ALICE,
			params: { id: '10' },
			platform: platformOf(db)
		});
		expect(r.status).toBe(400);
		// DB は変更されていない
		expect(state.stories[0].title).toBe('old');
	});

	it('既に [deleted] 済みなら no-op で success（DB 書き込み無し）', async () => {
		const { db, state } = makeMockDB({
			users: [ALICE],
			stories: [
				{
					id: 10,
					user_id: 1,
					title: '[deleted]',
					url: null,
					text: '[deleted]',
					created_at: NOW
				}
			]
		});
		const r = await callAction(deleteStory, {
			user: ALICE,
			params: { id: '10' },
			platform: platformOf(db)
		});
		expect(r.status).toBe(200);
		expect((r.body as { success: boolean }).success).toBe(true);
		expect(state.stories[0].title).toBe('[deleted]');
	});

	it('通常 case: title=[deleted] / url=null / text=[deleted] に UPDATE', async () => {
		const { db, state } = makeMockDB({
			users: [ALICE],
			stories: [
				{
					id: 10,
					user_id: 1,
					title: 'My story',
					url: 'https://example.com',
					text: 'body',
					type: 'story',
					created_at: NOW
				}
			]
		});
		const r = await callAction(deleteStory, {
			user: ALICE,
			params: { id: '10' },
			platform: platformOf(db)
		});
		expect(r.status).toBe(200);
		expect(state.stories[0].title).toBe('[deleted]');
		expect(state.stories[0].url).toBeNull();
		expect(state.stories[0].text).toBe('[deleted]');
		// type は変更しない
		expect(state.stories[0].type).toBe('story');
	});

	it('poll 削除でも type=poll のまま（deleteStory は type に触らない）', async () => {
		const { db, state } = makeMockDB({
			users: [ALICE],
			stories: [
				{
					id: 10,
					user_id: 1,
					title: 'best lang?',
					url: null,
					text: 'pick one',
					type: 'poll',
					created_at: NOW
				}
			]
		});
		const r = await callAction(deleteStory, {
			user: ALICE,
			params: { id: '10' },
			platform: platformOf(db)
		});
		expect(r.status).toBe(200);
		expect(state.stories[0].title).toBe('[deleted]');
		expect(state.stories[0].text).toBe('[deleted]');
		expect(state.stories[0].type).toBe('poll');
	});
});
