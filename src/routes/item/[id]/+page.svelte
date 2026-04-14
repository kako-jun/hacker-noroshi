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
	let editingStory = $state(false);
	let editingCommentId = $state<number | null>(null);
	let localTargetCommentVoted = $state<boolean | null>(null);
	let localTargetCommentPoints = $state<number | null>(null);

	function canEdit(createdAt: string, userId: number): boolean {
		if (!data.user || data.user.id !== userId) return false;
		const elapsed = Date.now() - new Date(createdAt).getTime();
		return elapsed < 2 * 60 * 60 * 1000;
	}

	let storyVoted = $derived(localStoryVoted ?? (data.mode === 'story' ? data.storyVoted : false));
	let storyPoints = $derived(localStoryPoints ?? (data.mode === 'story' ? data.story.points : 0));
	let votedCommentIdsFromServer = $derived(new Set(data.votedCommentIds));

	function getVotedCommentIds(): Set<number> {
		return localVotedCommentIds ?? votedCommentIdsFromServer;
	}

	function getCommentPoints(comment: { id: number; points: number }): number {
		return localCommentPoints[comment.id] ?? comment.points;
	}

	let targetCommentVoted = $derived(
		localTargetCommentVoted ?? (data.mode === 'comment' ? getVotedCommentIds().has(data.targetComment.id) : false)
	);
	let targetCommentPoints = $derived(
		localTargetCommentPoints ?? (data.mode === 'comment' ? data.targetComment.points : 0)
	);

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
		if (data.mode !== 'story') return;
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

	async function voteTargetComment() {
		if (!data.user) {
			window.location.href = '/login';
			return;
		}
		if (data.mode !== 'comment') return;
		const res = await fetch('/api/vote', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ itemId: data.targetComment.id, itemType: 'comment' })
		});
		if (res.ok) {
			const result: { voted: boolean; points: number } = await res.json();
			localTargetCommentPoints = result.points;
			localTargetCommentVoted = result.voted;
			// Also update in the voted set
			const next = new Set(getVotedCommentIds());
			if (result.voted) {
				next.add(data.targetComment.id);
			} else {
				next.delete(data.targetComment.id);
			}
			localVotedCommentIds = next;
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

{#if data.mode === 'comment'}
	{@const comment = data.targetComment}
	{@const parentStory = data.parentStory}
	<div class="item-detail" style="padding-left: 40px;">
		<div class="comment-head">
			<span class="comment-vote">
				<button
					class="upvote"
					class:voted={targetCommentVoted}
					onclick={voteTargetComment}
					aria-label="upvote comment"
				>
					&#9650;
				</button>
			</span>
			<a href="/user/{comment.username}">{comment.username}</a>
			<a href="/item/{comment.id}">{timeAgo(comment.created_at)}</a>
			{#if comment.parent_id}
				| <a href="/item/{comment.parent_id}" style="color: #828282;">parent</a>
			{:else}
				| <a href="/item/{parentStory.id}" style="color: #828282;">parent</a>
			{/if}
			| on: <a href="/item/{parentStory.id}">{parentStory.title}</a>
			{#if canEdit(comment.created_at, comment.user_id)}
				| <a
					href="#edit"
					onclick={(e) => {
						e.preventDefault();
						editingCommentId = comment.id;
					}}>edit</a>
			{/if}
		</div>
		{#if editingCommentId === comment.id}
			<div class="comment-form" style="padding-left: 14px;">
				<form method="POST" action="?/editComment" use:enhance={() => {
					return async ({ update }) => {
						editingCommentId = null;
						await update();
						await invalidateAll();
					};
				}}>
					<input type="hidden" name="comment_id" value={comment.id} />
					<textarea name="text" rows="4" cols="60">{comment.text}</textarea>
					<br />
					<button type="submit">update</button>
					<a
						href="#cancel"
						onclick={(e) => {
							e.preventDefault();
							editingCommentId = null;
						}}
						style="margin-left: 8px; font-size: 7pt; color: #828282;">cancel</a>
				</form>
			</div>
		{:else}
			<div class="comment-text" style="padding-left: 14px;">
				{#each comment.text.split('\n') as paragraph}
					{#if paragraph.trim()}
						<p>{paragraph}</p>
					{/if}
				{/each}
			</div>
		{/if}

		{#if data.user}
			<div class="comment-form" style="padding-left: 14px;">
				<form method="POST" action="?/comment" use:enhance={() => {
					return async ({ update }) => {
						await update();
						await invalidateAll();
					};
				}}>
					<input type="hidden" name="parent_id" value={comment.id} />
					<textarea name="text" rows="6" cols="60"></textarea>
					<br />
					<button type="submit">reply</button>
				</form>
			</div>
		{/if}

		<div class="comments-section" style="padding-left: 0;">
			{#each commentTree as child}
				<div class="comment-item" style="padding-left: {child.depth * 40}px;">
					<div class="comment-head">
						<span class="comment-vote">
							<button
								class="upvote"
								class:voted={getVotedCommentIds().has(child.id)}
								onclick={() => voteComment(child.id)}
								aria-label="upvote comment"
							>
								&#9650;
							</button>
						</span>
						<a href="/user/{child.username}">{child.username}</a>
						<a href="/item/{child.id}">{timeAgo(child.created_at)}</a>
					</div>
					{#if editingCommentId === child.id}
						<div class="comment-form" style="padding-left: 14px;">
							<form method="POST" action="?/editComment" use:enhance={() => {
								return async ({ update }) => {
									editingCommentId = null;
									await update();
									await invalidateAll();
								};
							}}>
								<input type="hidden" name="comment_id" value={child.id} />
								<textarea name="text" rows="4" cols="60">{child.text}</textarea>
								<br />
								<button type="submit">update</button>
								<a
									href="#cancel"
									onclick={(e) => {
										e.preventDefault();
										editingCommentId = null;
									}}
									style="margin-left: 8px; font-size: 7pt; color: #828282;">cancel</a>
							</form>
						</div>
					{:else}
						<div class="comment-text" style="padding-left: 14px;">
							{#each child.text.split('\n') as paragraph}
								{#if paragraph.trim()}
									<p>{paragraph}</p>
								{/if}
							{/each}
						</div>
					{/if}
					{#if data.user}
						<div class="comment-reply" style="padding-left: 14px;">
							<a
								href="#reply"
								onclick={(e) => {
									e.preventDefault();
									toggleReply(child.id);
								}}>reply</a
							>
							{#if canEdit(child.created_at, child.user_id)}
								| <a
									href="#edit"
									onclick={(e) => {
										e.preventDefault();
										editingCommentId = child.id;
									}}>edit</a>
							{/if}
						</div>
						{#if replyTo === child.id}
							<div class="comment-form" style="padding-left: 14px;">
								<form method="POST" action="?/comment" use:enhance={() => {
									return async ({ update }) => {
										replyTo = null;
										await update();
										await invalidateAll();
									};
								}}>
									<input type="hidden" name="parent_id" value={child.id} />
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
{:else}
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
			{#if canEdit(data.story.created_at, data.story.user_id)}
				| <a
					href="#edit"
					onclick={(e) => {
						e.preventDefault();
						editingStory = true;
					}}>edit</a>
			{/if}
		</div>

		{#if editingStory}
			<div class="comment-form" style="padding-left: 18px;">
				<form method="POST" action="?/editStory" use:enhance={() => {
					return async ({ update }) => {
						editingStory = false;
						await update();
						await invalidateAll();
					};
				}}>
					<table style="border-spacing: 0;">
						<tbody>
							<tr>
								<td style="color: #828282; text-align: right; padding: 2px 5px; vertical-align: top;">title:</td>
								<td style="padding: 2px 5px;"><input type="text" name="title" value={data.story.title} style="font-family: monospace; font-size: 9pt; width: 300px;" /></td>
							</tr>
							<tr>
								<td style="color: #828282; text-align: right; padding: 2px 5px; vertical-align: top;">text:</td>
								<td style="padding: 2px 5px;"><textarea name="text" rows="6" cols="60">{data.story.text ?? ''}</textarea></td>
							</tr>
						</tbody>
					</table>
					<button type="submit">update</button>
					<a
						href="#cancel"
						onclick={(e) => {
							e.preventDefault();
							editingStory = false;
						}}
						style="margin-left: 8px; font-size: 7pt; color: #828282;">cancel</a>
				</form>
			</div>
		{:else if data.story.text}
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
						<a href="/item/{comment.id}">{timeAgo(comment.created_at)}</a>
					</div>
					{#if editingCommentId === comment.id}
						<div class="comment-form" style="padding-left: 14px;">
							<form method="POST" action="?/editComment" use:enhance={() => {
								return async ({ update }) => {
									editingCommentId = null;
									await update();
									await invalidateAll();
								};
							}}>
								<input type="hidden" name="comment_id" value={comment.id} />
								<textarea name="text" rows="4" cols="60">{comment.text}</textarea>
								<br />
								<button type="submit">update</button>
								<a
									href="#cancel"
									onclick={(e) => {
										e.preventDefault();
										editingCommentId = null;
									}}
									style="margin-left: 8px; font-size: 7pt; color: #828282;">cancel</a>
							</form>
						</div>
					{:else}
						<div class="comment-text" style="padding-left: 14px;">
							{#each comment.text.split('\n') as paragraph}
								{#if paragraph.trim()}
									<p>{paragraph}</p>
								{/if}
							{/each}
						</div>
					{/if}
					{#if data.user}
						<div class="comment-reply" style="padding-left: 14px;">
							<a
								href="#reply"
								onclick={(e) => {
									e.preventDefault();
									toggleReply(comment.id);
								}}>reply</a
							>
							{#if canEdit(comment.created_at, comment.user_id)}
								| <a
									href="#edit"
									onclick={(e) => {
										e.preventDefault();
										editingCommentId = comment.id;
									}}>edit</a>
							{/if}
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
{/if}
