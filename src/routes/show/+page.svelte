<script lang="ts">
	import StoryList from '$lib/components/StoryList.svelte';

	let { data } = $props();
</script>

<div class="show-intro" style="padding: 10px 0 0 40px; font-size: 9pt; color: #828282;">
	投稿前に <a href="/showhn">Show HN ルール</a> をお読みください。<a href="/shownew">最新の Show HN</a> も眺めてみるとよいでしょう。
</div>

<StoryList
	stories={data.stories}
	user={data.user}
	votedIds={data.votedIds}
	flaggedIds={data.flaggedIds}
	rankStart={(data.page - 1) * 30}
	moreHref={data.stories.length === 30 ? `/show?p=${data.page + 1}` : null}
/>
