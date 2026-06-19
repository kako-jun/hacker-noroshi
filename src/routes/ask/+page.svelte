<script lang="ts">
	import StoryList from '$lib/components/StoryList.svelte';

	let { data } = $props();
</script>

<StoryList
	stories={data.stories}
	user={data.user}
	votedIds={data.votedIds}
	flaggedIds={data.flaggedIds}
	rankStart={(data.page - 1) * 30}
	moreHref={data.stories.length === 30 ? `/ask?p=${data.page + 1}` : null}
/>
