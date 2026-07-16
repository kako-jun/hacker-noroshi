<script lang="ts">
	import { page } from '$app/state';
	import { displayUsername } from '$lib/format';
	import { timeAgo, extractDomain, isNewUser } from '$lib/ranking';
	import { canFlagStory, shouldShowPollTag, postHideToggle, type UserLike } from '$lib/storyActions';
	import { assistHint } from '$lib/assist';
	import {
		hasLegacyStoryTypePrefix,
		label,
		normalizeLocale,
		storyTypeLabel,
		tooltip
	} from '$lib/i18n';

	interface StoryLike {
		id: number;
		title: string;
		url?: string | null;
		type?: string;
		dead?: number;
		points: number;
		flag_count?: number;
		comment_count: number;
		created_at: string;
		username: string;
		user_id: number;
		user_created_at: string;
		user_deleted?: number | null;
	}

	type Props = {
		story: StoryLike;
		rank?: number | null;
		user: UserLike | null | undefined;
		initialVoted: boolean;
		initialFlagged: boolean;
		/** /polls 用: url 無しでも常に [poll] タグを付ける */
		forcePollTag?: boolean;
		/** hide 成功時に親へ通知（親側で localHiddenIds を更新するため） */
		onhide?: (storyId: number) => void;
		/** これが渡されると meta 行は hide でなく un-hide を出す（/hidden 用・#153）。
		 *  クリックで POST /api/hide（toggle で hidden を解除）→ 成功で親へ通知し、その行を /hidden 一覧から消す。 */
		onunhide?: (storyId: number) => void;
		/** 一覧の「描画上の先頭行」だけ true。行コントロール解説 hint をここに1回だけ出す（#143）。
		 *  絶対 rank ではなく描画 index で判定する＝2ページ目（rank=31〜）や rank 無しの /search でも先頭に出る。 */
		assistFirst?: boolean;
	};

	let {
		story,
		rank = null,
		user,
		initialVoted,
		initialFlagged,
		forcePollTag = false,
		onhide,
		onunhide,
		assistFirst = false
	}: Props = $props();

	// 楽観的更新は行ごとに独立した state で持つ。
	// 初期値は親から渡される server-side のスナップショットに合わせ、
	// ユーザーが操作するまでは props（story.points 等）の更新に追従する。
	let localVoted = $state<boolean | null>(null);
	let localFlagged = $state<boolean | null>(null);
	let localPoints = $state<number | null>(null);
	let localFlagCount = $state<number | null>(null);
	// flag API のレスポンスに含まれる dead（#180）。ItemPage の localStoryDead と同じ役割で、
	// 5件目の flag クリック直後にリロード無しで [dead] タグへ切り替えるための local state。
	let localDead = $state<number | null>(null);

	let voted = $derived(localVoted ?? initialVoted);
	let flagged = $derived(localFlagged ?? initialFlagged);
	let points = $derived(localPoints ?? story.points);
	let flagCount = $derived(localFlagCount ?? story.flag_count ?? 0);
	let dead = $derived(localDead ?? story.dead ?? 0);

	let canFlag = $derived(canFlagStory(user, story));
	let showPollTag = $derived(shouldShowPollTag(story, forcePollTag));
	let locale = $derived(normalizeLocale(page.data.locale as string | undefined));

	// 未ログインで vote/flag/hide を踏んだ際にログイン後に戻ってくる先（#116）。
	// /login の safeNext で相対パス検証されるので、そのまま encode して渡せばよい。
	let loginHref = $derived(
		`/login?next=${encodeURIComponent(page.url.pathname + page.url.search)}`
	);

	async function vote() {
		if (!user) {
			window.location.href = loginHref;
			return;
		}
		const res = await fetch('/api/vote', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ itemId: story.id, itemType: 'story' })
		});
		if (res.ok) {
			const result: { voteState: 'up' | 'down' | null; points: number } = await res.json();
			localPoints = result.points;
			localVoted = result.voteState === 'up';
		}
	}

	async function flag() {
		if (!user) {
			window.location.href = loginHref;
			return;
		}
		const res = await fetch('/api/flag', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ itemId: story.id, itemType: 'story' })
		});
		if (res.ok) {
			const result: { flagged: boolean; flagCount: number; dead: boolean } = await res.json();
			localFlagged = result.flagged;
			localFlagCount = result.flagCount;
			localDead = result.dead ? 1 : 0;
		} else if (res.status === 403) {
			const result = (await res.json()) as { error?: string };
			alert(result.error || 'Permission denied');
		}
	}

	// hide と un-hide は同じ /api/hide（toggle）を叩く。共有して二重実装を避け、in-flight ガードで
	// 連打による再 toggle（un-hide のつもりが再 hide される）を防ぐ（#154 レビュー）。
	let hideInFlight = false;
	async function toggleHide(): Promise<boolean | null> {
		if (hideInFlight) return null;
		hideInFlight = true;
		try {
			const result = await postHideToggle(story.id);
			return result === null ? null : result.hidden;
		} finally {
			hideInFlight = false;
		}
	}

	async function hide() {
		if ((await toggleHide()) === true) onhide?.(story.id);
	}

	// /hidden 用（#153）。toggle なので hidden な story に投げると un-hide される。解除（hidden=false）できたら
	// 親へ通知してその行を /hidden 一覧から消す。
	async function unhide() {
		if ((await toggleHide()) === false) onunhide?.(story.id);
	}

	function l(key: string): string {
		return label(key, locale);
	}

	function tip(key: string): string {
		return tooltip(key, locale);
	}

	function commentText(count: number): string {
		if (count === 0) return l('discuss');
		if (locale === 'ja') return `${count}${l('commentsLabel')}`;
		return `${count} comment${count !== 1 ? 's' : ''}`;
	}

	function assistedTypeLabel(): string {
		if (hasLegacyStoryTypePrefix(story.title, story.type)) return '';
		return storyTypeLabel(story.type, locale);
	}

	// #172 second pass: このコントロール群に該当するヒントキーを表示順にまとめ、行の直下に
	// assist-hint-list として1回だけ出す（絶対配置＋固定pxオフセットの旧設計を撤去）。
	let assistHintKeys = $derived([
		'story.upvote',
		onunhide ? 'story.un-hide' : 'story.hide',
		'story.comments',
		...(canFlag ? ['story.flag'] : [])
	]);
</script>

<div class="story-item">
	{#if rank !== null && rank !== undefined}
		<span class="story-rank">{rank}.</span>
	{/if}
	<span class="story-vote">
		<button class="upvote" class:voted onclick={vote} aria-label="upvote">
			&#9650;
		</button>
	</span>
	<div class="story-content" class:faded={dead === 1}>
		<div class="story-title-line">
			{#if story.url}
				<a href={story.url} class="story-title">{story.title}</a>
				<span class="story-domain">({extractDomain(story.url)})</span>
			{:else}
				<a href="/item/{story.id}" class="story-title">{story.title}</a>
			{/if}
			{#if assistedTypeLabel()} <span class="story-tag">[{assistedTypeLabel()}]</span>{/if}
			{#if showPollTag} <span class="story-tag">[poll]</span>{/if}
			{#if flagCount > 0} <span class="story-tag">[flagged]</span>{/if}
			{#if dead === 1} <span class="story-tag">[dead]</span>{/if}
		</div>
		<div class="story-meta">
			{points} {l(points === 1 ? 'point' : 'points')} {l('by')}
			<a
				href="/user/{story.username}"
				style={isNewUser(story.user_created_at) ? 'color: #3c963c;' : ''}
				>{displayUsername({
					username: story.username,
					deleted: story.user_deleted === 1 ? 1 : story.user_deleted === 0 ? 0 : null
				})}</a>
			<a href="/item/{story.id}">{timeAgo(story.created_at)}</a> |
			{#if onunhide}
				<a
					href="#unhide"
					title={tip('un-hide')}
					onclick={(e) => {
						e.preventDefault();
						unhide();
					}}>{l('un-hide')}</a
				>
			{:else if user}
				<a
					href="#hide"
					title={tip('hide')}
					onclick={(e) => {
						e.preventDefault();
						hide();
					}}>{l('hide')}</a
				>
			{:else}
				<a href={loginHref} title={tip('hide')}>{l('hide')}</a>
			{/if}
			{#if story.url}
				| <a href="/from?site={extractDomain(story.url)}" title={tip('past')}>{l('past')}</a>
			{/if}
			|
			<a href="/item/{story.id}">{commentText(story.comment_count)}</a>
			{#if canFlag}
				| <a
					href="#flag"
					title={tip(flagged ? 'un-flag' : 'flag')}
					onclick={(e) => {
						e.preventDefault();
						flag();
					}}>{l(flagged ? 'un-flag' : 'flag')}</a
				>
			{/if}
		</div>
	</div>
</div>
{#if assistFirst}
	<div class="assist-hint-list">
		{#each assistHintKeys as key (key)}
			<div class="assist-hint">{assistHint(key, locale)}</div>
		{/each}
	</div>
{/if}
