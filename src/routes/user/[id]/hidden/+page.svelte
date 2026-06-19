<script lang="ts">
	import StoryList from '$lib/components/StoryList.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>{data.username}'s hidden | ハッカーのろし</title>
</svelte:head>

<!-- hidden を「表示」し各行に un-hide を出す。共通ラッパ StoryList の unhide モードで canonical row に集約（#153）。
     この一覧は hidden を除外しないので serverHiddenIds は渡さない。40px インデントは据え置き。 -->
<div style="padding-left: 40px;">
	<StoryList
		stories={data.hidden}
		user={data.user}
		votedIds={data.votedIds}
		flaggedIds={data.flaggedIds}
		rankStart={(data.page - 1) * 30}
		moreHref={data.hidden.length === 30 ? `/user/${data.username}/hidden?p=${data.page + 1}` : null}
		unhide
	/>
</div>
