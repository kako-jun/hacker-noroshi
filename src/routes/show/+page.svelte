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

<div class="show-intro" style="padding: 10px 0 0 40px; font-size: 9pt; color: #828282;">
	投稿前に <a href="/showhn">Show HN ルール</a> をお読みください。<a href="/show?p=newest">最新の Show HN</a> も眺めてみるとよいでしょう。
</div>

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
		<a href="/show?p={data.page + 1}">More</a>
	</div>
{/if}
