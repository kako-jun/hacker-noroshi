<script lang="ts">
	import { timeAgo } from '$lib/ranking';

	let { data } = $props();
	let localVotedIds = $state<Set<number> | null>(null);
	let localPoints = $state<Record<number, number>>({});

	function getVotedIds(): Set<number> {
		return localVotedIds ?? new Set(data.votedIds);
	}

	function getPoints(comment: { id: number; points: number }): number {
		return localPoints[comment.id] ?? comment.points;
	}

	async function vote(commentId: number) {
		if (!data.user) {
			window.location.href = '/login';
			return;
		}
		const res = await fetch('/api/vote', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ itemId: commentId, itemType: 'comment' })
		});
		if (res.ok) {
			const result: { voted: boolean; points: number } = await res.json();
			localPoints = { ...localPoints, [commentId]: result.points };
			const next = new Set(getVotedIds());
			if (result.voted) {
				next.add(commentId);
			} else {
				next.delete(commentId);
			}
			localVotedIds = next;
		}
	}
</script>

<svelte:head>
	<title>{data.username}'s comments | ハッカーのろし</title>
</svelte:head>

<div style="padding-left: 40px;">
	{#each data.comments as comment}
		<div style="padding: 10px 0;">
			<div class="comment-head">
				<span class="comment-vote">
					<button
						class="upvote"
						class:voted={getVotedIds().has(comment.id)}
						onclick={() => vote(comment.id)}
						aria-label="upvote comment"
					>
						&#9650;
					</button>
				</span>
				<a href="/user/{comment.username}">{comment.username}</a>
				<a href="/item/{comment.id}">{timeAgo(comment.created_at)}</a>
				| <a href="/item/{comment.parent_id ?? comment.story_id}" style="color: #828282;">parent</a>
				| <a href="/item/{comment.id}" style="color: #828282;">context</a>
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
