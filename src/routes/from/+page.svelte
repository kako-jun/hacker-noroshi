<script lang="ts">
	import StoryList from '$lib/components/StoryList.svelte';

	let { data } = $props();
</script>

{#if data.site === null}
	<div class="from-empty">ドメインを指定してください: <code>?site=example.com</code></div>
{:else}
	<div class="from-header">Submissions from {data.site}:</div>

	{#if data.stories.length === 0}
		<div class="from-empty">No submissions from {data.site}</div>
	{/if}

	<StoryList
		stories={data.stories}
		user={data.user}
		votedIds={data.votedIds}
		flaggedIds={data.flaggedIds}
		rankStart={(data.page - 1) * 30}
		moreHref={data.hasMore ? `/from?site=${data.site}&p=${data.page + 1}` : null}
	/>
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

	.from-empty code {
		font-family: monospace;
	}
</style>
