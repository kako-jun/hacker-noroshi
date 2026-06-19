<script lang="ts">
	import StoryListItem from '$lib/components/StoryListItem.svelte';
	import { tooltipJa } from '$lib/i18n';

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


<div class="story-list">
	{#each data.stories as story, i (story.id)}
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

{#if data.stories.length === 30}
	<div class="more-link">
		<a href="/?p={data.page + 1}" title={tooltipJa('More')}>More</a>
	</div>
{/if}
