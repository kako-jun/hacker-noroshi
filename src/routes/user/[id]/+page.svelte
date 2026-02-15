<script lang="ts">
	import { timeAgo, extractDomain } from '$lib/ranking';

	let { data } = $props();

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toISOString().split('T')[0];
	}
</script>

<svelte:head>
	<title>Profile: {data.profile.username} | ハッカーのろし</title>
</svelte:head>

<div class="user-profile" style="padding-left: 40px;">
	<table>
		<tbody>
			<tr>
				<td>user:</td>
				<td>{data.profile.username}</td>
			</tr>
			<tr>
				<td>created:</td>
				<td>{formatDate(data.profile.created_at)}</td>
			</tr>
			<tr>
				<td>karma:</td>
				<td>{data.profile.karma}</td>
			</tr>
			{#if data.profile.about}
				<tr>
					<td>about:</td>
					<td>{data.profile.about}</td>
				</tr>
			{/if}
		</tbody>
	</table>

	{#if data.submissions.length > 0}
		<h3 style="font-size: 10pt; margin-top: 20px; margin-bottom: 5px; color: #828282;">submissions</h3>
		<div class="story-list">
			{#each data.submissions as story, i}
				<div class="story-item">
					<span class="story-rank">{i + 1}.</span>
					<span class="story-vote">
						<span class="upvote">&#9650;</span>
					</span>
					<div class="story-content">
						<div class="story-title-line">
							{#if story.url}
								<a href={story.url} class="story-title">{story.title}</a>
								<span class="story-domain">({extractDomain(story.url)})</span>
							{:else}
								<a href="/item/{story.id}" class="story-title">{story.title}</a>
							{/if}
						</div>
						<div class="story-meta">
							{story.points} point{story.points !== 1 ? 's' : ''} by
							<a href="/user/{story.username}">{story.username}</a>
							<a href="/item/{story.id}">{timeAgo(story.created_at)}</a> |
							<a href="/item/{story.id}"
								>{story.comment_count} comment{story.comment_count !== 1 ? 's' : ''}</a
							>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
