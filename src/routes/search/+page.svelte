<script lang="ts">
	import { timeAgo, extractDomain, isNewUser } from '$lib/ranking';
	import { formatText } from '$lib/format';

	let { data } = $props();
	let votedIds = $derived(new Set<number>(data.votedIds));
	let flaggedIds = $derived(new Set<number>(data.flaggedIds ?? []));
	let flaggedCommentIds = $derived(new Set<number>(data.flaggedCommentIds ?? []));
	let localVotedIds = $state<Set<number> | null>(null);
	let localPoints = $state<Record<number, number>>({});
	let localHiddenIds = $state<Set<number>>(new Set());
	let localVoteStates = $state<Record<number, 'up' | 'down' | null> | null>(null);
	let localCommentPoints = $state<Record<number, number>>({});
	let localFlaggedIds = $state<Set<number> | null>(null);
	let localFlaggedCommentIds = $state<Set<number> | null>(null);
	let localFlagCounts = $state<Record<number, number>>({});
	let localCommentFlagCounts = $state<Record<number, number>>({});

	function getFlaggedIds(): Set<number> {
		return localFlaggedIds ?? flaggedIds;
	}

	function getFlaggedCommentIds(): Set<number> {
		return localFlaggedCommentIds ?? flaggedCommentIds;
	}

	function getFlagCount(item: { id: number; flag_count?: number }, type: 'story' | 'comment'): number {
		const map = type === 'story' ? localFlagCounts : localCommentFlagCounts;
		return map[item.id] ?? item.flag_count ?? 0;
	}

	function canFlag(item: { user_id: number }): boolean {
		return !!data.user && data.user.karma >= 30 && item.user_id !== data.user.id;
	}

	async function flagItem(itemId: number, itemType: 'story' | 'comment') {
		if (!data.user) {
			window.location.href = '/login';
			return;
		}
		const res = await fetch('/api/flag', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ itemId, itemType })
		});
		if (res.ok) {
			const result: { flagged: boolean; flagCount: number } = await res.json();
			if (itemType === 'story') {
				const next = new Set(getFlaggedIds());
				if (result.flagged) next.add(itemId);
				else next.delete(itemId);
				localFlaggedIds = next;
				localFlagCounts = { ...localFlagCounts, [itemId]: result.flagCount };
			} else {
				const next = new Set(getFlaggedCommentIds());
				if (result.flagged) next.add(itemId);
				else next.delete(itemId);
				localFlaggedCommentIds = next;
				localCommentFlagCounts = { ...localCommentFlagCounts, [itemId]: result.flagCount };
			}
		} else if (res.status === 403) {
			const result = (await res.json()) as { error?: string };
			alert(result.error || 'Permission denied');
		}
	}

	function getVotedIds(): Set<number> {
		return localVotedIds ?? votedIds;
	}

	function getPoints(story: { id: number; points: number }): number {
		return localPoints[story.id] ?? story.points;
	}

	function isHidden(id: number): boolean {
		return localHiddenIds.has(id);
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

	async function vote(storyId: number) {
		if (!data.user) {
			window.location.href = '/login';
			return;
		}
		const res = await fetch('/api/vote', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ itemId: storyId, itemType: 'story' })
		});
		if (res.ok) {
			const result = (await res.json()) as { voteState: 'up' | 'down' | null; points: number };
			localPoints = { ...localPoints, [storyId]: result.points };
			const next = new Set(getVotedIds());
			if (result.voteState === 'up') {
				next.add(storyId);
			} else {
				next.delete(storyId);
			}
			localVotedIds = next;
		}
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

	async function hide(storyId: number) {
		const res = await fetch('/api/hide', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ storyId })
		});
		if (res.ok) {
			const result = (await res.json()) as { hidden: boolean };
			if (result.hidden) {
				const next = new Set(localHiddenIds);
				next.add(storyId);
				localHiddenIds = next;
			}
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
			{#each data.stories as story}
				{#if !isHidden(story.id)}
					<div class="story-item">
						<span class="story-vote">
							<button
								class="upvote"
								class:voted={getVotedIds().has(story.id)}
								onclick={() => vote(story.id)}
								aria-label="upvote"
							>
								&#9650;
							</button>
						</span>
						<div class="story-content" class:faded={story.dead === 1}>
							<div class="story-title-line">
								{#if story.url}
									<a href={story.url} class="story-title">{story.title}</a>
									<span class="story-domain">({extractDomain(story.url)})</span>
								{:else}
									<a href="/item/{story.id}" class="story-title">{story.title}</a>
								{/if}
								{#if getFlagCount(story, 'story') > 0} <span class="story-tag">[flagged]</span>{/if}
								{#if story.dead === 1} <span class="story-tag">[dead]</span>{/if}
							</div>
							<div class="story-meta">
								{getPoints(story)} point{getPoints(story) !== 1 ? 's' : ''} by
								<a href="/user/{story.username}" style={isNewUser(story.user_created_at) ? 'color: #3c963c;' : ''}>{story.username}</a>
								<a href="/item/{story.id}">{timeAgo(story.created_at)}</a> |
								<a href="/item/{story.id}"
									>{story.comment_count} comment{story.comment_count !== 1 ? 's' : ''}</a
								>
								{#if data.user}
									| <a href="#hide" onclick={(e) => { e.preventDefault(); hide(story.id); }}>hide</a>
								{/if}
								{#if canFlag(story)}
									| <a href="#flag" onclick={(e) => { e.preventDefault(); flagItem(story.id, 'story'); }}>{getFlaggedIds().has(story.id) ? 'un-flag' : 'flag'}</a>
								{/if}
							</div>
						</div>
					</div>
				{/if}
			{/each}
		</div>
	{/if}

	{#if (data.type === 'all' || data.type === 'comments') && data.comments.length > 0}
		<div style="padding-left: 40px;">
			{#each data.comments as comment}
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
						<a href="/user/{comment.username}" style={isNewUser(comment.user_created_at) ? 'color: #3c963c;' : ''}>{comment.username}</a>
						<a href="/item/{comment.id}">{timeAgo(comment.created_at)}</a>
						| <a href="/item/{comment.parent_id ?? comment.story_id}" style="color: #828282;">parent</a>
						| <a href="/item/{comment.id}" style="color: #828282;">context</a>
						| on: <a href="/item/{comment.story_id}">{comment.story_title}</a>
					</div>
					<div class="comment-text" class:faded={getCommentPoints(comment) < 1} style="padding-left: 14px;">
						{#each comment.text.split('\n') as paragraph}
							{#if paragraph.trim()}
								<p>{@html formatText(paragraph)}</p>
							{/if}
						{/each}
					</div>
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
			<a href="/search?q={encodeURIComponent(data.q)}&type={data.type}&p={data.page + 1}">More</a>
		</div>
	{/if}
{/if}
