<script lang="ts">
	import { timeAgo, extractDomain } from '$lib/ranking';

	let { data } = $props();
	let votedIds = $derived(new Set(data.votedIds));
	let localVotedIds = $state<Set<number> | null>(null);
	let localPoints = $state<Record<number, number>>({});

	function getVotedIds(): Set<number> {
		return localVotedIds ?? votedIds;
	}

	function getPoints(story: { id: number; points: number }): number {
		return localPoints[story.id] ?? story.points;
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
			const result: { voted: boolean; points: number } = await res.json();
			localPoints = { ...localPoints, [storyId]: result.points };
			const next = new Set(getVotedIds());
			if (result.voted) {
				next.add(storyId);
			} else {
				next.delete(storyId);
			}
			localVotedIds = next;
		}
	}
</script>

<div class="story-list">
	{#each data.stories as story, i}
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
			<div class="story-content">
				<div class="story-title-line">
					{#if story.url}
						<a href={story.url} class="story-title">{story.title}</a>
						<span class="story-domain">({extractDomain(story.url)})</span>
					{:else}
						<a href="/item/{story.id}" class="story-title">{story.title}</a>
					{/if}
				</div>
				<div class="story-meta">
					{getPoints(story)} point{getPoints(story) !== 1 ? 's' : ''} by
					<a href="/user/{story.username}">{story.username}</a>
					<a href="/item/{story.id}">{timeAgo(story.created_at)}</a> |
					<a href="/item/{story.id}"
						>{story.comment_count} comment{story.comment_count !== 1 ? 's' : ''}</a
					>
				</div>
			</div>
		</div>
	{/each}
</div>

{#if data.stories.length === 30}
	<div class="more-link">
		<a href="/show?p={data.page + 1}">More</a>
	</div>
{/if}
