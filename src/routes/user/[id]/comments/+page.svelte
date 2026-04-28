<script lang="ts">
	import { timeAgo, isNewUser } from '$lib/ranking';
	import { formatText, displayUsername } from '$lib/format';

	let { data } = $props();
	let localVoteStates = $state<Record<number, 'up' | 'down' | null> | null>(null);
	let localPoints = $state<Record<number, number>>({});

	function getVoteState(commentId: number): 'up' | 'down' | null {
		if (localVoteStates && commentId in localVoteStates) {
			return localVoteStates[commentId];
		}
		return (data.commentVoteStates as Record<number, 'up' | 'down'>)[commentId] ?? null;
	}

	function getPoints(comment: { id: number; points: number }): number {
		return localPoints[comment.id] ?? comment.points;
	}

	async function vote(commentId: number, direction: 'up' | 'down' = 'up') {
		if (!data.user) {
			window.location.href = '/login';
			return;
		}
		const res = await fetch('/api/vote', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ itemId: commentId, itemType: 'comment', direction })
		});
		if (res.ok) {
			const result: { voteState: 'up' | 'down' | null; points: number } = await res.json();
			localPoints = { ...localPoints, [commentId]: result.points };
			localVoteStates = {
				...(localVoteStates ?? {}),
				[commentId]: result.voteState
			};
		} else if (res.status === 403) {
			const result = await res.json();
			alert(result.error || 'Permission denied');
		}
	}
</script>

<svelte:head>
	<title>{data.userDeleted ? "[deleted]" : data.username}'s comments | ハッカーのろし</title>
</svelte:head>

<div style="padding-left: 40px;">
	{#each data.comments as comment}
		<div style="padding: 10px 0;">
			<div class="comment-head">
				<span class="comment-vote">
					<button
						class="upvote"
						class:voted={getVoteState(comment.id) === 'up'}
						onclick={() => vote(comment.id, 'up')}
						aria-label="upvote comment"
					>
						&#9650;
					</button>
					{#if data.user && data.user.karma >= 500}
						<button
							class="downvote"
							class:voted={getVoteState(comment.id) === 'down'}
							onclick={() => vote(comment.id, 'down')}
							aria-label="downvote comment"
						>
							&#9660;
						</button>
					{/if}
				</span>
				<a href="/user/{comment.username}" style={isNewUser(comment.user_created_at) ? 'color: #3c963c;' : ''}>{displayUsername({ username: comment.username, deleted: comment.user_deleted })}</a>
				<a href="/item/{comment.id}">{timeAgo(comment.created_at)}</a>
				| <a href="/item/{comment.parent_id ?? comment.story_id}" style="color: #828282;">parent</a>
				| <a href="/item/{comment.id}" style="color: #828282;">context</a>
				| on: <a href="/item/{comment.story_id}">{comment.story_title}</a>
			</div>
			<div class="comment-text" class:faded={getPoints(comment) < 1} style="padding-left: 14px;">
				{#each comment.text.split('\n') as paragraph}
					{#if paragraph.trim()}
						<p>{@html formatText(paragraph)}</p>
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
