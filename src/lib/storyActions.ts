/**
 * StoryListItem 等の表示ロジックを純粋関数として切り出した helper。
 * 単体テストしやすくするのと、複数コンポーネントから再利用できるようにするのが目的。
 */

import { FLAG_KARMA_THRESHOLD } from './constants';

export interface StoryLike {
	id: number;
	type?: string;
	user_id: number;
	url?: string | null;
	dead?: number;
}

export interface UserLike {
	id: number;
	karma: number;
}

/**
 * flag リンクを表示してよいか判定する。
 *
 * - 未ログイン → 不可
 * - karma が FLAG_KARMA_THRESHOLD 未満 → 不可
 * - 自分の story → 不可（自分自身を flag できない）
 */
export function canFlagStory(
	user: UserLike | null | undefined,
	story: Pick<StoryLike, 'user_id'>
): boolean {
	if (!user) return false;
	if (user.karma < FLAG_KARMA_THRESHOLD) return false;
	if (story.user_id === user.id) return false;
	return true;
}

/**
 * `[poll]` タグを表示するかどうか。
 *
 * - forcePollTag が真なら無条件で表示（/polls 用、url が付いていても poll とわかるように）
 * - story.type が 'poll' なら表示
 */
export function shouldShowPollTag(
	story: Pick<StoryLike, 'type'>,
	forcePollTag: boolean = false
): boolean {
	return forcePollTag || story.type === 'poll';
}

/** /api/hide を叩いて toggle 後の hidden 状態を返す。非2xx は null（呼び出し側で握り）。 */
export async function postHideToggle(storyId: number): Promise<{ hidden: boolean } | null> {
	const res = await fetch('/api/hide', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ storyId })
	});
	if (!res.ok) return null;
	return (await res.json()) as { hidden: boolean };
}
