<script lang="ts">
	import StoryListItem from '$lib/components/StoryListItem.svelte';

	let { data } = $props();
	let votedIds = $derived(new Set<number>(data.votedIds));
	let flaggedIds = $derived(new Set<number>(data.flaggedIds ?? []));
	let hiddenIdsServer = $derived(new Set<number>(data.hiddenIds ?? []));
	let localHiddenIds = $state<Set<number>>(new Set());

	function isHidden(id: number): boolean {
		return hiddenIdsServer.has(id) || localHiddenIds.has(id);
	}

	function onhide(id: number) {
		const next = new Set(localHiddenIds);
		next.add(id);
		localHiddenIds = next;
	}
</script>

<svelte:head>
	<title>Polls | ハッカーのろし</title>
</svelte:head>

<div class="story-list">
	{#each data.stories as story, i (story.id)}
		{#if !isHidden(story.id)}
			<StoryListItem
				{story}
				rank={(data.page - 1) * 30 + i + 1}
				user={data.user}
				initialVoted={votedIds.has(story.id)}
				initialFlagged={flaggedIds.has(story.id)}
				forcePollTag
				{onhide}
			/>
		{/if}
	{/each}
</div>

{#if data.stories.length === 30}
	<div class="more-link">
		<a href="/polls?p={data.page + 1}">More</a>
	</div>
{/if}
