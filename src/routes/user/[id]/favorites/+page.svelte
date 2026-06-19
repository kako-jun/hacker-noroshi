<script lang="ts">
	import StoryList from '$lib/components/StoryList.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>{data.userDeleted ? "[deleted]" : data.username}'s favorites | ハッカーのろし</title>
</svelte:head>

<!-- 行は共通ラッパ StoryList に集約（#151）。プロフィール下に揃える 40px インデントは据え置き。 -->
<div style="padding-left: 40px;">
	<StoryList
		stories={data.favorites}
		user={data.user}
		votedIds={data.votedIds}
		flaggedIds={data.flaggedIds}
		rankStart={(data.page - 1) * 30}
		moreHref={data.favorites.length === 30
			? `/user/${data.username}/favorites?p=${data.page + 1}`
			: null}
	/>
</div>
