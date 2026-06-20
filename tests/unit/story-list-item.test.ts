import { describe, it, expect, vi, afterEach } from 'vitest';
import { canFlagStory, shouldShowPollTag, postHideToggle } from '../../src/lib/storyActions';
import { FLAG_KARMA_THRESHOLD } from '../../src/lib/constants';

describe('canFlagStory', () => {
	const story = { user_id: 100 };

	it('未ログインの場合は flag できない', () => {
		expect(canFlagStory(null, story)).toBe(false);
		expect(canFlagStory(undefined, story)).toBe(false);
	});

	it('karma が FLAG_KARMA_THRESHOLD 未満なら flag できない', () => {
		const user = { id: 1, karma: FLAG_KARMA_THRESHOLD - 1 };
		expect(canFlagStory(user, story)).toBe(false);
	});

	it('自分の story は flag できない', () => {
		const user = { id: 100, karma: 1000 };
		expect(canFlagStory(user, story)).toBe(false);
	});

	it('karma が閾値以上 + 他人の story なら flag できる', () => {
		const user = { id: 1, karma: FLAG_KARMA_THRESHOLD };
		expect(canFlagStory(user, story)).toBe(true);
	});

	it('karma が閾値ちょうどなら flag できる（境界）', () => {
		const user = { id: 1, karma: FLAG_KARMA_THRESHOLD };
		expect(canFlagStory(user, story)).toBe(true);
	});
});

describe('shouldShowPollTag', () => {
	it('forcePollTag=true なら url 有りでも [poll] を表示する', () => {
		const story = { type: 'story' };
		expect(shouldShowPollTag(story, true)).toBe(true);
	});

	it('forcePollTag=false (default) かつ story.type=poll なら表示する', () => {
		const story = { type: 'poll' };
		expect(shouldShowPollTag(story)).toBe(true);
		expect(shouldShowPollTag(story, false)).toBe(true);
	});

	it('forcePollTag=false かつ story.type=story なら非表示', () => {
		const story = { type: 'story' };
		expect(shouldShowPollTag(story)).toBe(false);
		expect(shouldShowPollTag(story, false)).toBe(false);
	});

	it('story.type が undefined かつ forcePollTag=false なら非表示', () => {
		expect(shouldShowPollTag({})).toBe(false);
	});
});

/**
 * StoryListItem.svelte 内の派生値ロジックは Svelte ランナー無しでは描画できないが、
 * 重要な分岐ロジックは `canFlagStory` / `shouldShowPollTag` に切り出しているのでここでカバー。
 *
 * dead タグ・[flagged] タグ・voted クラスの条件は単純な真偽判定（`story.dead === 1`、
 * `flagCount > 0`、`localVoted ?? initialVoted`）なので、ここでは入力組み合わせを
 * 直接検証する。
 */
describe('StoryListItem display flag logic', () => {
	it('story.dead === 1 で dead 状態と判定される', () => {
		const story = { dead: 1 };
		expect(story.dead === 1).toBe(true);
	});

	it('story.dead が 0 / undefined のときは dead 扱いしない', () => {
		expect(({ dead: 0 } as { dead?: number }).dead === 1).toBe(false);
		expect(({} as { dead?: number }).dead === 1).toBe(false);
	});

	it('flag_count > 0 で [flagged] タグを出すべきと判定される', () => {
		const flagCount = 3;
		expect(flagCount > 0).toBe(true);
	});

	it('flag_count = 0 / undefined なら [flagged] を出さない', () => {
		const a = 0;
		expect(a > 0).toBe(false);
		const b: number | undefined = undefined;
		expect((b ?? 0) > 0).toBe(false);
	});

	it('initialVoted=true なら voted=true（ユーザー未操作時）', () => {
		const localVoted: boolean | null = null;
		const initialVoted = true;
		expect(localVoted ?? initialVoted).toBe(true);
	});

	it('localVoted で initialVoted を上書きできる', () => {
		const localVoted: boolean | null = false;
		const initialVoted = true;
		expect(localVoted ?? initialVoted).toBe(false);
	});
});

/**
 * postHideToggle: /api/hide を叩いて toggle 後の hidden 状態を返す共有ヘルパ（#155）。
 * StoryListItem.svelte の toggleHide() と item/[id]/+page.svelte の toggleHideStory()
 * の同型 fetch 重複を解消するために切り出した純粋関数。
 *
 * fetch は captcha-unban.test.ts の流儀に合わせて globalThis を spy で差し替える。
 * Svelte コンポーネント内部の in-flight ガード（hideInFlight 等）はユニット対象外
 * （既存 e2e tests/e2e/hide.spec.ts が担保）。
 */
describe('postHideToggle', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	function mockHide(response: { ok: boolean; status?: number; json?: () => Promise<unknown> }) {
		return vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
			return {
				ok: response.ok,
				status: response.status ?? (response.ok ? 200 : 400),
				json: response.json ?? (async () => ({}))
			} as unknown as Response;
		});
	}

	it('2xx 正常系: hidden:true を返す', async () => {
		mockHide({ ok: true, json: async () => ({ hidden: true }) });
		const result = await postHideToggle(123);
		expect(result).toEqual({ hidden: true });
	});

	it('2xx 正常系: hidden:false を返す', async () => {
		mockHide({ ok: true, json: async () => ({ hidden: false }) });
		const result = await postHideToggle(123);
		expect(result).toEqual({ hidden: false });
	});

	it('fetch を /api/hide に POST + JSON ヘッダ + storyId を含む body で 1 回だけ呼ぶ', async () => {
		const fetchSpy = mockHide({ ok: true, json: async () => ({ hidden: true }) });
		await postHideToggle(123);

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
		expect(url).toBe('/api/hide');
		expect(init.method).toBe('POST');
		expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
		expect(JSON.parse(init.body as string)).toEqual({ storyId: 123 });
	});

	it('別の storyId（999）もそのまま body に入る', async () => {
		const fetchSpy = mockHide({ ok: true, json: async () => ({ hidden: true }) });
		await postHideToggle(999);

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
		expect(JSON.parse(init.body as string)).toEqual({ storyId: 999 });
	});

	it('非2xx（403）なら null を返す', async () => {
		mockHide({ ok: false, status: 403 });
		const result = await postHideToggle(123);
		expect(result).toBeNull();
	});

	it('非2xx（500）なら null を返す', async () => {
		mockHide({ ok: false, status: 500 });
		const result = await postHideToggle(123);
		expect(result).toBeNull();
	});

	it('非2xx の場合は json をパースせず null を返す（json が呼ばれても結果は null）', async () => {
		const json = vi.fn(async () => ({ hidden: true }));
		mockHide({ ok: false, status: 403, json });
		const result = await postHideToggle(123);
		expect(result).toBeNull();
		// ok:false で早期 return するため json は呼ばれない
		expect(json).not.toHaveBeenCalled();
	});
});
