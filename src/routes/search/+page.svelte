<script lang="ts">
	import { timeAgo, isNewUser } from '$lib/ranking';
	import { tooltipJa } from '$lib/i18n';
	import { formatText, displayUsername } from '$lib/format';
	import StoryListItem from '$lib/components/StoryListItem.svelte';

	let { data } = $props();
	let votedIds = $derived(new Set<number>(data.votedIds));
	let flaggedIds = $derived(new Set<number>(data.flaggedIds ?? []));
	let localHiddenIds = $state<Set<number>>(new Set());
	let localVoteStates = $state<Record<number, 'up' | 'down' | null> | null>(null);
	let localCommentPoints = $state<Record<number, number>>({});
	let collapsed = $state<Record<number, boolean>>({});

	function isHidden(id: number): boolean {
		return localHiddenIds.has(id);
	}

	function onhide(id: number) {
		const next = new Set(localHiddenIds);
		next.add(id);
		localHiddenIds = next;
	}

	function getCommentVoteState(commentId: number): 'up' | 'down' | null {
		if (localVoteStates && commentId in localVoteStates) {
			return localVoteStates[commentId];
		}
		return (data.commentVoteStates as Record<number, 'up' | 'down'>)[commentId] ?? null;
	}

	function getCommentPoints(comment: { id: number; points: number }): number {
		return localCommentPoints[comment.id] ?? comment.points;
	}

	async function voteComment(commentId: number, direction: 'up' | 'down' = 'up') {
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
			const result = (await res.json()) as { voteState: 'up' | 'down' | null; points: number };
			localCommentPoints = { ...localCommentPoints, [commentId]: result.points };
			localVoteStates = {
				...(localVoteStates ?? {}),
				[commentId]: result.voteState
			};
		} else if (res.status === 403) {
			const result = (await res.json()) as { error?: string };
			alert(result.error || 'Permission denied');
		}
	}
</script>

<svelte:head>
	<title>{data.q ? `${data.q} - Search` : 'Search'} | ハッカーのろし</title>
</svelte:head>

<div class="hn-form">
	<form action="/search" method="get">
		<table>
			<tbody>
				<tr>
					<td>Search:</td>
					<td><input type="text" name="q" value={data.q} /></td>
				</tr>
				<tr>
					<td></td>
					<td>
						<select name="type" style="font-family: Verdana, Geneva, sans-serif; font-size: 9pt;">
							<option value="all" selected={data.type === 'all'}>All</option>
							<option value="stories" selected={data.type === 'stories'}>Stories</option>
							<option value="comments" selected={data.type === 'comments'}>Comments</option>
						</select>
						<button type="submit">Search</button>
					</td>
				</tr>
			</tbody>
		</table>
	</form>
</div>

{#if data.q}
	{#if (data.type === 'all' || data.type === 'stories') && data.stories.length > 0}
		<div class="story-list">
			{#each data.stories as story (story.id)}
				{#if !isHidden(story.id)}
					<StoryListItem
						{story}
						user={data.user}
						initialVoted={votedIds.has(story.id)}
						initialFlagged={flaggedIds.has(story.id)}
						{onhide}
					/>
				{/if}
			{/each}
		</div>
	{/if}

	{#if (data.type === 'all' || data.type === 'comments') && data.comments.length > 0}
		<div style="padding-left: 40px;">
			{#each data.comments as comment (comment.id)}
				<div style="padding: 10px 0;">
					<div class="comment-head">
						<span class="comment-vote">
							<button
								class="upvote"
								class:voted={getCommentVoteState(comment.id) === 'up'}
								onclick={() => voteComment(comment.id, 'up')}
								aria-label="upvote comment"
							>
								&#9650;
							</button>
							{#if data.user && data.user.karma >= 500}
								<button
									class="downvote"
									class:voted={getCommentVoteState(comment.id) === 'down'}
									onclick={() => voteComment(comment.id, 'down')}
									aria-label="downvote comment"
								>
									&#9660;
								</button>
							{/if}
						</span>
						<a href="/user/{comment.username}" style={isNewUser(comment.user_created_at) ? 'color: #3c963c;' : ''}>{displayUsername({ username: comment.username, deleted: comment.user_deleted })}</a>
						<a href="/item/{comment.id}">{timeAgo(comment.created_at)}</a>
						| <a href="/item/{comment.parent_id ?? comment.story_id}" title={tooltipJa('parent')} style="color: #828282;">parent</a>
						| <a href="/item/{comment.id}" title={tooltipJa('context')} style="color: #828282;">context</a>
						| on: <a href="/item/{comment.story_id}">{comment.story_title}</a>
						{' '}<a
							href="#toggle"
							onclick={(e) => { e.preventDefault(); collapsed[comment.id] = !collapsed[comment.id]; }}
							style="color: #828282;"
						>{#if collapsed[comment.id]}[+]{:else}[&ndash;]{/if}</a>
					</div>
					{#if !collapsed[comment.id]}
					<div class="comment-text" class:faded={getCommentPoints(comment) < 1}>
						{#each comment.text.split('\n') as paragraph}
							{#if paragraph.trim()}
								<p>{@html formatText(paragraph)}</p>
							{/if}
						{/each}
					</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	{#if data.q && data.stories.length === 0 && data.comments.length === 0}
		<div style="padding: 10px 0 10px 40px; font-size: 10pt;">
			No results found.
		</div>
	{/if}

	{#if data.stories.length === 30 || data.comments.length === 30}
		<div class="more-link">
			<a href="/search?q={encodeURIComponent(data.q)}&type={data.type}&p={data.page + 1}" title={tooltipJa('More')}>More</a>
		</div>
	{/if}
{/if}
