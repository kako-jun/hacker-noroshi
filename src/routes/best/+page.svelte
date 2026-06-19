<script lang="ts">
	import StoryList from '$lib/components/StoryList.svelte';

	let { data } = $props();
</script>

<div class="best-intro">
	過去48時間で得点の高い投稿。<code>?h=24</code> のように時間数を変えられます。
</div>

<StoryList
	stories={data.stories}
	user={data.user}
	votedIds={data.votedIds}
	flaggedIds={data.flaggedIds}
	rankStart={(data.page - 1) * 30}
	moreHref={data.stories.length === 30 ? `/best?p=${data.page + 1}` : null}
/>

<style>
	.best-intro {
		padding: 10px 0 0 40px;
		font-size: 9pt;
		color: #828282;
	}
	.best-intro code {
		font-family: monospace;
	}
</style>
