<script lang="ts">
	import StoryList from '$lib/components/StoryList.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Polls | ハッカーのろし</title>
</svelte:head>

<StoryList
	stories={data.stories}
	user={data.user}
	votedIds={data.votedIds}
	flaggedIds={data.flaggedIds}
	serverHiddenIds={data.hiddenIds}
	rankStart={(data.page - 1) * 30}
	moreHref={data.stories.length === 30 ? `/polls?p=${data.page + 1}` : null}
	forcePollTag
/>
