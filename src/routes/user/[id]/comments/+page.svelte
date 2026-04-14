<script lang="ts">
	import { timeAgo } from '$lib/ranking';

	let { data } = $props();
</script>

<svelte:head>
	<title>{data.username}'s comments | ハッカーのろし</title>
</svelte:head>

<div style="padding-left: 40px;">
	{#each data.comments as comment}
		<div style="padding: 10px 0;">
			<div class="comment-head">
				<a href="/user/{comment.username}">{comment.username}</a>
				<a href="/item/{comment.story_id}">{timeAgo(comment.created_at)}</a>
				| on: <a href="/item/{comment.story_id}">{comment.story_title}</a>
			</div>
			<div class="comment-text" style="padding-left: 14px;">
				{#each comment.text.split('\n') as paragraph}
					{#if paragraph.trim()}
						<p>{paragraph}</p>
					{/if}
				{/each}
			</div>
		</div>
	{/each}
</div>

{#if data.comments.length === 30}
	<div class="more-link">
		<a href="/user/{data.username}/comments?p={data.page + 1}">More</a>
	</div>
{/if}
