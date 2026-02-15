<script lang="ts">
	import { enhance } from '$app/forms';
	import { timeAgo, extractDomain } from '$lib/ranking';
	import { invalidateAll } from '$app/navigation';

	let { data, form } = $props();
	let localStoryVoted = $state<boolean | null>(null);
	let localStoryPoints = $state<number | null>(null);
	let localVotedCommentIds = $state<Set<number> | null>(null);
	let localCommentPoints = $state<Record<number, number>>({});
	let replyTo = $state<number | null>(null);

	let storyVoted = $derived(localStoryVoted ?? data.storyVoted);
	let storyPoints = $derived(localStoryPoints ?? data.story.points);
	let votedCommentIdsFromServer = $derived(new Set(data.votedCommentIds));

	function getVotedCommentIds(): Set<number> {
		return localVotedCommentIds ?? votedCommentIdsFromServer;
	}

	function getCommentPoints(comment: { id: number; points: number }): number {
		return localCommentPoints[comment.id] ?? comment.points;
	}

	interface CommentNode {
		id: number;
		text: string;
		user_id: number;
		story_id: number;
		parent_id: number | null;
		points: number;
		created_at: string;
		username: string;
		children: CommentNode[];
		depth: number;
	}

	function buildCommentTree(
		comments: typeof data.comments
	): CommentNode[] {
		const map = new Map<number, CommentNode>();
		const roots: CommentNode[] = [];

		for (const c of comments) {
			map.set(c.id, { ...c, children: [], depth: 0 });
		}

		for (const c of comments) {
			const node = map.get(c.id)!;
			if (c.parent_id && map.has(c.parent_id)) {
				const parent = map.get(c.parent_id)!;
				node.depth = parent.depth + 1;
				parent.children.push(node);
			} else {
				roots.push(node);
			}
		}

		return roots;
	}

	function flattenTree(nodes: CommentNode[]): CommentNode[] {
		const result: CommentNode[] = [];
		function walk(list: CommentNode[]) {
			for (const node of list) {
				result.push(node);
				walk(node.children);
			}
		}
		walk(nodes);
		return result;
	}

	let commentTree = $derived(flattenTree(buildCommentTree(data.comments)));

	async function voteStory() {
		if (!data.user) {
			window.location.href = '/login';
			return;
		}
		const res = await fetch('/api/vote', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ itemId: data.story.id, itemType: 'story' })
		});
		if (res.ok) {
			const result: { voted: boolean; points: number } = await res.json();
			localStoryPoints = result.points;
			localStoryVoted = result.voted;
		}
	}

	async function voteComment(commentId: number) {
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
			localCommentPoints = { ...localCommentPoints, [commentId]: result.points };
			const next = new Set(getVotedCommentIds());
			if (result.voted) {
				next.add(commentId);
			} else {
				next.delete(commentId);
			}
			localVotedCommentIds = next;
		}
	}

	function toggleReply(commentId: number) {
		replyTo = replyTo === commentId ? null : commentId;
	}
</script>

<div class="item-detail" style="padding-left: 40px;">
	<div style="display: flex; align-items: baseline;">
		<span class="story-vote" style="margin-right: 4px;">
			<button
				class="upvote"
				class:voted={storyVoted}
				onclick={voteStory}
				aria-label="upvote"
			>
				&#9650;
			</button>
		</span>
		<span class="item-title">
			{#if data.story.url}
				<a href={data.story.url}>{data.story.title}</a>
				<span class="item-domain">({extractDomain(data.story.url)})</span>
			{:else}
				{data.story.title}
			{/if}
		</span>
	</div>

	<div class="item-meta" style="padding-left: 18px;">
		{storyPoints} point{storyPoints !== 1 ? 's' : ''} by
		<a href="/user/{data.story.username}">{data.story.username}</a>
		{timeAgo(data.story.created_at)}
	</div>

	{#if data.story.text}
		<div class="item-text" style="padding-left: 18px;">
			{#each data.story.text.split('\n') as paragraph}
				{#if paragraph.trim()}
					<p>{paragraph}</p>
				{/if}
			{/each}
		</div>
	{/if}

	{#if data.user}
		<div class="comment-form" style="padding-left: 18px;">
			<form method="POST" action="?/comment" use:enhance={() => {
				return async ({ update }) => {
					await update();
					await invalidateAll();
				};
			}}>
				<textarea name="text" rows="6" cols="60"></textarea>
				<br />
				<button type="submit">add comment</button>
			</form>
		</div>
	{/if}

	<div class="comments-section" style="padding-left: 0;">
		{#each commentTree as comment}
			<div class="comment-item" style="padding-left: {comment.depth * 40}px;">
				<div class="comment-head">
					<span class="comment-vote">
						<button
							class="upvote"
							class:voted={getVotedCommentIds().has(comment.id)}
							onclick={() => voteComment(comment.id)}
							aria-label="upvote comment"
						>
							&#9650;
						</button>
					</span>
					<a href="/user/{comment.username}">{comment.username}</a>
					{timeAgo(comment.created_at)}
				</div>
				<div class="comment-text" style="padding-left: 14px;">
					{#each comment.text.split('\n') as paragraph}
						{#if paragraph.trim()}
							<p>{paragraph}</p>
						{/if}
					{/each}
				</div>
				{#if data.user}
					<div class="comment-reply" style="padding-left: 14px;">
						<a
							href="#reply"
							onclick={(e) => {
								e.preventDefault();
								toggleReply(comment.id);
							}}>reply</a
						>
					</div>
					{#if replyTo === comment.id}
						<div class="comment-form" style="padding-left: 14px;">
							<form method="POST" action="?/comment" use:enhance={() => {
								return async ({ update }) => {
									replyTo = null;
									await update();
									await invalidateAll();
								};
							}}>
								<input type="hidden" name="parent_id" value={comment.id} />
								<textarea name="text" rows="4" cols="60"></textarea>
								<br />
								<button type="submit">reply</button>
							</form>
						</div>
					{/if}
				{/if}
			</div>
		{/each}
	</div>
</div>
