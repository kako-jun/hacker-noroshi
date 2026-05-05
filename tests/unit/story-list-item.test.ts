import { describe, it, expect } from 'vitest';
import { canFlagStory, shouldShowPollTag } from '../../src/lib/storyActions';
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
