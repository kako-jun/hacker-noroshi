<script lang="ts">
	import StoryListItem from '$lib/components/StoryListItem.svelte';

	let { data } = $props();
	let votedIds = $derived(new Set<number>(data.votedIds));
	let flaggedIds = $derived(new Set<number>(data.flaggedIds ?? []));
	let localHiddenIds = $state<Set<number>>(new Set());

	function onhide(id: number) {
		const next = new Set(localHiddenIds);
		next.add(id);
		localHiddenIds = next;
	}
</script>

<div class="from-header">Submissions from {data.site}:</div>

{#if data.stories.length === 0}
	<div class="from-empty">No submissions from {data.site}</div>
{/if}

<div class="story-list">
	{#each data.stories as story, i}
		{#if !localHiddenIds.has(story.id)}
			<StoryListItem
				{story}
				rank={(data.page - 1) * 30 + i + 1}
				user={data.user}
				initialVoted={votedIds.has(story.id)}
				initialFlagged={flaggedIds.has(story.id)}
				{onhide}
			/>
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
