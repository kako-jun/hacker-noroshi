<script lang="ts">
	import StoryList from '$lib/components/StoryList.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>New Ask HN | ハッカーのろし</title>
</svelte:head>

<StoryList
	stories={data.stories}
	user={data.user}
	votedIds={data.votedIds}
	flaggedIds={data.flaggedIds}
	rankStart={(data.page - 1) * 30}
	moreHref={data.hasMore ? `/asknew?p=${data.page + 1}` : null}
/>
