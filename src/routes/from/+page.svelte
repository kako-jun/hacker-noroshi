<script lang="ts">
	import { FLAG_KARMA_THRESHOLD } from '$lib/constants';
	import { displayUsername } from '$lib/format';
	import { timeAgo, extractDomain, isNewUser } from '$lib/ranking';

	let { data } = $props();
	let votedIds = $derived(new Set(data.votedIds));
	let flaggedIds = $derived(new Set(data.flaggedIds ?? []));
	let localVotedIds = $state<Set<number> | null>(null);
	let localPoints = $state<Record<number, number>>({});
	let localHiddenIds = $state<Set<number>>(new Set());
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

	function isHidden(id: number): boolean {
		return localHiddenIds.has(id);
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

	async function hide(storyId: number) {
		const res = await fetch('/api/hide', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ storyId })
		});
		if (res.ok) {
			const result: { hidden: boolean } = await res.json();
			if (result.hidden) {
				const next = new Set(localHiddenIds);
				next.add(storyId);
				localHiddenIds = next;
			}
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

<div class="from-header">Submissions from {data.site}:</div>

{#if data.stories.length === 0}
	<div class="from-empty">No submissions from {data.site}</div>
{/if}

<div class="story-list">
	{#each data.stories as story, i}
		{#if !isHidden(story.id)}
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
					{#if story.type === 'poll'} <span class="story-tag">[poll]</span>{/if}
					{#if getFlagCount(story) > 0} <span class="story-tag">[flagged]</span>{/if}
					{#if story.dead === 1} <span class="story-tag">[dead]</span>{/if}
				</div>
				<div class="story-meta">
					{getPoints(story)} point{getPoints(story) !== 1 ? 's' : ''} by
					<a href="/user/{story.username}" style={isNewUser(story.user_created_at) ? 'color: #3c963c;' : ''}>{displayUsername({ username: story.username, deleted: story.user_deleted })}</a>
					<a href="/item/{story.id}">{timeAgo(story.created_at)}</a> |
					<a href="/item/{story.id}"
						>{story.comment_count} comment{story.comment_count !== 1 ? 's' : ''}</a
					>
					{#if data.user}
						| <a href="#hide" onclick={(e) => { e.preventDefault(); hide(story.id); }}>hide</a>
					{/if}
					{#if canFlag(story)}
						| <a href="#flag" onclick={(e) => { e.preventDefault(); flag(story.id); }}>{getFlaggedIds().has(story.id) ? 'un-flag' : 'flag'}</a>
					{/if}
				</div>
			</div>
		</div>
		{/if}
	{/each}
</div>

{#if data.hasMore}
	<div class="more-link">
		<a href="/from?site={data.site}&p={data.page + 1}">More</a>
	</div>
{/if}

<style>
	.from-header {
		padding: 6pt 0 6pt 6pt;
		font-size: 10pt;
		color: #000000;
	}

	.from-empty {
		padding: 10pt 0 10pt 6pt;
		font-size: 10pt;
		color: #828282;
	}
</style>
