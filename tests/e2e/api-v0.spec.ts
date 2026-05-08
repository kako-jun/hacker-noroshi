// Issue #131 — 公開 API v0 の E2E。
//
// signup → submit → /newest で id 取得 → /item/[id] で comment を投下、
// その後 /api/v0/* を叩いて
//   - listing が JSON 配列
//   - item (story) が type='story' で必須フィールド存在
//   - item (comment) が type='comment' で parent あり
//   - user が id=username, karma=number
//   - 不存在は 404
//   - CORS / Cache-Control / Content-Type が想定通り
// を確認する。
//
// すべて未認証（page.request 直叩き）で動くこと。

import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { signupNewUser, submitStory, findStoryIdByTitle, postComment } from './helpers';

// stories.id と comments.id は別 AUTOINCREMENT のため衝突しうる。
// /item/[id] と /api/v0/item/[id] は story を優先する仕様 (#131 実装と既存 /item ルートで一致)。
// E2E では確実に story と衝突しない comment id を使うため、必要なら id を直接読み出す。
function fetchD1Scalar(sql: string): string {
	const out = execFileSync(
		'npx',
		['wrangler', 'd1', 'execute', 'hacker-noroshi-db', '--local', '--json', '--command', sql],
		{ cwd: process.cwd(), stdio: 'pipe', timeout: 30_000 }
	).toString();
	// 企業プロキシ下では "Proxy environment variables detected." 等の前置きが混じるため、
	// `[` から末尾までの JSON 部分だけ切り出す。
	const start = out.indexOf('[');
	if (start < 0) throw new Error(`No JSON in wrangler output: ${out}`);
	const parsed = JSON.parse(out.slice(start));
	const rows = parsed[0]?.results ?? [];
	return rows.length === 0 ? '' : String(Object.values(rows[0])[0]);
}

test.describe('public API v0 (#131)', () => {
	test('listings return id arrays with proper headers and CORS, no auth required', async ({
		page,
		request
	}) => {
		// 何かしら data が入っている状態にしておく
		const username = await signupNewUser(page);
		const title = `api-v0 listing ${Date.now()}`;
		await submitStory(page, { title, text: 'listing fixture' });
		await page.goto('/newest');
		await findStoryIdByTitle(page, title);

		// 未認証クライアント (request) で叩く（page と context の cookie 共有を切るため
		// 別の APIRequestContext を使うのがより厳密だが、Playwright の `request` fixture は
		// browser context と cookie を共有しない別物なので OK）
		const endpoints = [
			'/api/v0/topstories.json',
			'/api/v0/newstories.json',
			'/api/v0/beststories.json',
			'/api/v0/askstories.json',
			'/api/v0/showstories.json',
			'/api/v0/activestories.json'
		];
		for (const path of endpoints) {
			const res = await request.get(path);
			expect(res.status(), `${path} status`).toBe(200);

			const ct = res.headers()['content-type'] ?? '';
			expect(ct, `${path} content-type`).toContain('application/json');

			const cors = res.headers()['access-control-allow-origin'];
			expect(cors, `${path} CORS`).toBe('*');

			const cache = res.headers()['cache-control'] ?? '';
			expect(cache, `${path} cache`).toContain('max-age=10');
			expect(cache, `${path} s-maxage`).toContain('s-maxage=60');

			const body = await res.json();
			expect(Array.isArray(body), `${path} array`).toBe(true);
			for (const v of body) {
				expect(typeof v, `${path} element type`).toBe('number');
			}
		}

		// at least newstories should contain our just-submitted id
		const newest = await request.get('/api/v0/newstories.json').then((r) => r.json());
		await page.goto('/newest');
		const id = await findStoryIdByTitle(page, title);
		expect(newest, 'newstories contains submitted id').toContain(id);

		// signup の戻り値も明示参照（unused 警告回避）
		expect(username).toBeTruthy();
	});

	test('item endpoint returns story / comment shapes; missing id is 404', async ({
		page,
		request
	}) => {
		const username = await signupNewUser(page);
		const title = `api-v0 item ${Date.now()}`;
		await submitStory(page, { title, text: 'story body for api test' });
		await page.goto('/newest');
		const storyId = await findStoryIdByTitle(page, title);

		// stories.id / comments.id は同じ id 空間で衝突しうる。/api/v0/item は story 優先のため、
		// テスト用 comment は story 最大 id を超えるよう sqlite_sequence を直接調整する。
		// （D1 は AUTOINCREMENT を sqlite_sequence で管理）
		const maxStoryIdBefore = Number(fetchD1Scalar('SELECT MAX(id) AS v FROM stories'));
		const targetSeq = Math.max(maxStoryIdBefore + 100, 100);
		execFileSync(
			'npx',
			[
				'wrangler',
				'd1',
				'execute',
				'hacker-noroshi-db',
				'--local',
				'--command',
				`UPDATE sqlite_sequence SET seq = ${targetSeq} WHERE name = 'comments'`
			],
			{ cwd: process.cwd(), stdio: 'pipe', timeout: 30_000 }
		);

		await page.goto(`/item/${storyId}`);
		await page.waitForLoadState('networkidle');
		await postComment(page, 'api v0 comment body');
		// postComment は enhance form を submit するだけ。invalidateAll → server load
		// → re-render を待ってからAPI を叩かないと kids が空のままになる。
		await page.waitForSelector('.comment-text', { state: 'visible', timeout: 15_000 });

		// --- story item ---
		const storyRes = await request.get(`/api/v0/item/${storyId}.json`);
		expect(storyRes.status()).toBe(200);
		expect(storyRes.headers()['content-type'] ?? '').toContain('application/json');
		expect(storyRes.headers()['access-control-allow-origin']).toBe('*');
		expect(storyRes.headers()['cache-control'] ?? '').toContain('max-age=30');
		const storyJson = (await storyRes.json()) as Record<string, unknown>;
		expect(storyJson.id).toBe(storyId);
		expect(storyJson.type).toBe('story');
		expect(storyJson.by).toBe(username);
		expect(typeof storyJson.time).toBe('number');
		expect(storyJson.title).toBe(title);
		expect(typeof storyJson.score).toBe('number');
		expect(typeof storyJson.descendants).toBe('number');
		expect(Array.isArray(storyJson.kids)).toBe(true);
		expect(storyJson.dead).toBe(false);
		expect(storyJson.deleted).toBe(false);

		// kids には先ほど投下した comment id が含まれるはず（sqlite_sequence を調整したので
		// 必ず stories の最大 id を超える）
		const kids = storyJson.kids as number[];
		expect(kids.length).toBeGreaterThanOrEqual(1);
		const commentId = kids[0];
		expect(commentId, 'comment id does not collide with any story id').toBeGreaterThan(
			maxStoryIdBefore
		);

		// --- comment item ---
		const commentRes = await request.get(`/api/v0/item/${commentId}.json`);
		expect(commentRes.status()).toBe(200);
		const commentJson = (await commentRes.json()) as Record<string, unknown>;
		expect(commentJson.id).toBe(commentId);
		expect(commentJson.type).toBe('comment');
		expect(commentJson.by).toBe(username);
		expect(commentJson.parent).toBe(storyId);
		expect(typeof commentJson.text).toBe('string');
		expect(Array.isArray(commentJson.kids)).toBe(true);
		expect(commentJson.dead).toBe(false);
		expect(commentJson.deleted).toBe(false);

		// --- not found ---
		const missing = await request.get('/api/v0/item/99999999.json');
		expect(missing.status()).toBe(404);
		const missingJson = (await missing.json()) as Record<string, unknown>;
		expect(missingJson.error).toBe('not found');
	});

	test('user endpoint returns lightweight profile; unknown user is 404', async ({
		page,
		request
	}) => {
		const username = await signupNewUser(page);

		const ok = await request.get(`/api/v0/user/${username}.json`);
		expect(ok.status()).toBe(200);
		expect(ok.headers()['content-type'] ?? '').toContain('application/json');
		expect(ok.headers()['access-control-allow-origin']).toBe('*');
		expect(ok.headers()['cache-control'] ?? '').toContain('max-age=60');
		const body = (await ok.json()) as Record<string, unknown>;
		expect(body.id).toBe(username);
		expect(typeof body.created).toBe('number');
		expect(typeof body.karma).toBe('number');
		expect(typeof body.about).toBe('string');
		// submitted は意図的に未実装
		expect('submitted' in body).toBe(false);

		// 不存在ユーザー
		const missing = await request.get('/api/v0/user/no_such_user_xyz.json');
		expect(missing.status()).toBe(404);
		const missingJson = (await missing.json()) as Record<string, unknown>;
		expect(missingJson.error).toBe('not found');
	});
});
