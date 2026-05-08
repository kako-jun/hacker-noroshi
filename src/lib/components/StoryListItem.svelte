<script lang="ts">
	import { page } from '$app/state';
	import { displayUsername } from '$lib/format';
	import { timeAgo, extractDomain, isNewUser } from '$lib/ranking';
	import { canFlagStory, shouldShowPollTag, type UserLike } from '$lib/storyActions';
	import { tooltipJa } from '$lib/i18n';

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
	};

	let {
		story,
		rank = null,
		user,
		initialVoted,
		initialFlagged,
		forcePollTag = false,
		onhide
	}: Props = $props();

	// 楽観的更新は行ごとに独立した state で持つ。
	// 初期値は親から渡される server-side のスナップショットに合わせ、
	// ユーザーが操作するまでは props（story.points 等）の更新に追従する。
	let localVoted = $state<boolean | null>(null);
	let localFlagged = $state<boolean | null>(null);
	let localPoints = $state<number | null>(null);
	let localFlagCount = $state<number | null>(null);

	let voted = $derived(localVoted ?? initialVoted);
	let flagged = $derived(localFlagged ?? initialFlagged);
	let points = $derived(localPoints ?? story.points);
	let flagCount = $derived(localFlagCount ?? story.flag_count ?? 0);

	let canFlag = $derived(canFlagStory(user, story));
	let showPollTag = $derived(shouldShowPollTag(story, forcePollTag));

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
			const result: { flagged: boolean; flagCount: number } = await res.json();
			localFlagged = result.flagged;
			localFlagCount = result.flagCount;
		} else if (res.status === 403) {
			const result = (await res.json()) as { error?: string };
			alert(result.error || 'Permission denied');
		}
	}

	async function hide() {
		const res = await fetch('/api/hide', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ storyId: story.id })
		});
		if (res.ok) {
			const result: { hidden: boolean } = await res.json();
			if (result.hidden) {
				onhide?.(story.id);
			}
		}
	}
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
	<div class="story-content" class:faded={story.dead === 1}>
		<div class="story-title-line">
			{#if story.url}
				<a href={story.url} class="story-title">{story.title}</a>
				<span class="story-domain">({extractDomain(story.url)})</span>
			{:else}
				<a href="/item/{story.id}" class="story-title">{story.title}</a>
			{/if}
			{#if showPollTag} <span class="story-tag">[poll]</span>{/if}
			{#if flagCount > 0} <span class="story-tag">[flagged]</span>{/if}
			{#if story.dead === 1} <span class="story-tag">[dead]</span>{/if}
		</div>
		<div class="story-meta">
			{points} point{points !== 1 ? 's' : ''} by
			<a
				href="/user/{story.username}"
				style={isNewUser(story.user_created_at) ? 'color: #3c963c;' : ''}
				>{displayUsername({
					username: story.username,
					deleted: story.user_deleted === 1 ? 1 : story.user_deleted === 0 ? 0 : null
				})}</a>
			<a href="/item/{story.id}">{timeAgo(story.created_at)}</a> |
			{#if user}
				<a
					href="#hide"
					title={tooltipJa('hide')}
					onclick={(e) => {
						e.preventDefault();
						hide();
					}}>hide</a
				>
			{:else}
				<a href={loginHref} title={tooltipJa('hide')}>hide</a>
			{/if}
			{#if story.url}
				| <a href="/from?site={extractDomain(story.url)}" title={tooltipJa('past')}>past</a>
			{/if}
			|
			<a href="/item/{story.id}"
				>{story.comment_count === 0
					? 'discuss'
					: `${story.comment_count} comment${story.comment_count !== 1 ? 's' : ''}`}</a
			>
			{#if canFlag}
				| <a
					href="#flag"
					title={tooltipJa(flagged ? 'un-flag' : 'flag')}
					onclick={(e) => {
						e.preventDefault();
						flag();
					}}>{flagged ? 'un-flag' : 'flag'}</a
				>
			{/if}
		</div>
	</div>
</div>
