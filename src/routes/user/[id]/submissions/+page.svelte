<script lang="ts">
	import { FLAG_KARMA_THRESHOLD } from '$lib/constants';
	import { timeAgo, extractDomain, isNewUser } from '$lib/ranking';

	let { data } = $props();
	let votedIds = $derived(new Set(data.votedIds));
	let flaggedIds = $derived(new Set(data.flaggedIds ?? []));
	let localVotedIds = $state<Set<number> | null>(null);
	let localPoints = $state<Record<number, number>>({});
	let localFlaggedIds = $state<Set<number> | null>(null);
	let localFlagCounts = $state<Record<number, number>>({});

	function getVotedIds(): Set<number> {
		return localVotedIds ?? votedIds;
	}

	function getFlaggedIds(): Set<number> {
		return localFlaggedIds ?? flaggedIds;
	}

	function getFlagCount(story: { id: number; flag_count?: number }): number {
		return localFlagCounts[story.id] ?? story.flag_count ?? 0;
	}

	function getPoints(story: { id: number; points: number }): number {
		return localPoints[story.id] ?? story.points;
	}

	function canFlag(story: { user_id: number }): boolean {
		return !!data.user && data.user.karma >= FLAG_KARMA_THRESHOLD && story.user_id !== data.user.id;
	}

	async function flag(storyId: number) {
		if (!data.user) {
			window.location.href = '/login';
			return;
		}
		const res = await fetch('/api/flag', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ itemId: storyId, itemType: 'story' })
		});
		if (res.ok) {
			const result: { flagged: boolean; flagCount: number } = await res.json();
			const next = new Set(getFlaggedIds());
			if (result.flagged) next.add(storyId);
			else next.delete(storyId);
			localFlaggedIds = next;
			localFlagCounts = { ...localFlagCounts, [storyId]: result.flagCount };
		} else if (res.status === 403) {
			const result = (await res.json()) as { error?: string };
			alert(result.error || 'Permission denied');
		}
	}

	async function vote(storyId: number) {
		if (!data.user) {
			window.location.href = '/login';
			return;
		}
		const res = await fetch('/api/vote', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ itemId: storyId, itemType: 'story' })
		});
		if (res.ok) {
			const result: { voteState: 'up' | 'down' | null; points: number } = await res.json();
			localPoints = { ...localPoints, [storyId]: result.points };
			const next = new Set(getVotedIds());
			if (result.voteState === 'up') {
				next.add(storyId);
			} else {
				next.delete(storyId);
			}
			localVotedIds = next;
		}
	}
</script>

<svelte:head>
	<title>{data.username}'s submissions | ハッカーのろし</title>
</svelte:head>

<div class="story-list" style="padding-left: 40px;">
	{#each data.submissions as story, i}
		<div class="story-item">
			<span class="story-rank">{(data.page - 1) * 30 + i + 1}.</span>
			<span class="story-vote">
				<button
					class="upvote"
					class:voted={getVotedIds().has(story.id)}
					onclick={() => vote(story.id)}
					aria-label="upvote"
				>
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
					{#if getFlagCount(story) > 0} <span class="story-tag">[flagged]</span>{/if}
					{#if story.dead === 1} <span class="story-tag">[dead]</span>{/if}
				</div>
				<div class="story-meta">
					{getPoints(story)} point{getPoints(story) !== 1 ? 's' : ''} by
					<a href="/user/{story.username}" style={isNewUser(story.user_created_at) ? 'color: #3c963c;' : ''}>{story.username}</a>
					<a href="/item/{story.id}">{timeAgo(story.created_at)}</a> |
					<a href="/item/{story.id}"
						>{story.comment_count} comment{story.comment_count !== 1 ? 's' : ''}</a
					>
					{#if canFlag(story)}
						| <a href="#flag" onclick={(e) => { e.preventDefault(); flag(story.id); }}>{getFlaggedIds().has(story.id) ? 'un-flag' : 'flag'}</a>
					{/if}
				</div>
			</div>
		</div>
	{/each}
</div>

{#if data.submissions.length === 30}
	<div class="more-link">
		<a href="/user/{data.username}/submissions?p={data.page + 1}">More</a>
	</div>
{/if}
