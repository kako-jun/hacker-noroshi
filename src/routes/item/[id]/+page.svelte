<script lang="ts">
	import { enhance } from '$app/forms';
	import { FLAG_KARMA_THRESHOLD } from '$lib/constants';
	import { timeAgo, extractDomain, isNewUser, isThreadOpen } from '$lib/ranking';
	import { formatText } from '$lib/format';
	import { invalidateAll } from '$app/navigation';

	let { data, form } = $props();
	let localStoryVoted = $state<boolean | null>(null);
	let localStoryPoints = $state<number | null>(null);
	let localCommentVoteStates = $state<Record<number, 'up' | 'down' | null> | null>(null);
	let localCommentPoints = $state<Record<number, number>>({});
	let replyTo = $state<number | null>(null);
	let editingStory = $state(false);
	let editingCommentId = $state<number | null>(null);
	let localTargetCommentVoteState = $state<'up' | 'down' | null | undefined>(undefined);
	let localTargetCommentPoints = $state<number | null>(null);
	let localStoryFavorited = $state<boolean | null>(null);
	let localStoryFlagged = $state<boolean | null>(null);
	let localTargetCommentFlagged = $state<boolean | null>(null);
	let localStoryDead = $state<number | null>(null);
	let localTargetCommentDead = $state<number | null>(null);

	function canFlagItem(authorId: number): boolean {
		return !!data.user && data.user.karma >= FLAG_KARMA_THRESHOLD && authorId !== data.user.id;
	}

	async function flagStory() {
		if (!data.user) {
			window.location.href = '/login';
			return;
		}
		if (data.mode !== 'story') return;
		const res = await fetch('/api/flag', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ itemId: data.story.id, itemType: 'story' })
		});
		if (res.ok) {
			const result: { flagged: boolean; flagCount: number } = await res.json();
			localStoryFlagged = result.flagged;
			if (result.flagCount > 4) localStoryDead = 1;
		} else if (res.status === 403) {
			const result = (await res.json()) as { error?: string };
			alert(result.error || 'Permission denied');
		}
	}

	async function flagTargetComment() {
		if (!data.user) {
			window.location.href = '/login';
			return;
		}
		if (data.mode !== 'comment') return;
		const res = await fetch('/api/flag', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ itemId: data.targetComment.id, itemType: 'comment' })
		});
		if (res.ok) {
			const result: { flagged: boolean; flagCount: number } = await res.json();
			localTargetCommentFlagged = result.flagged;
			if (result.flagCount > 4) localTargetCommentDead = 1;
		} else if (res.status === 403) {
			const result = (await res.json()) as { error?: string };
			alert(result.error || 'Permission denied');
		}
	}

	async function vouchStory() {
		if (!data.user) {
			window.location.href = '/login';
			return;
		}
		if (data.mode !== 'story') return;
		const res = await fetch('/api/vouch', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ itemId: data.story.id, itemType: 'story' })
		});
		if (res.ok) {
			localStoryDead = 0;
			localStoryFlagged = false;
			await invalidateAll();
		} else {
			const result = (await res.json()) as { error?: string };
			alert(result.error || 'Vouch failed');
		}
	}

	async function vouchTargetComment() {
		if (!data.user) {
			window.location.href = '/login';
			return;
		}
		if (data.mode !== 'comment') return;
		const res = await fetch('/api/vouch', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ itemId: data.targetComment.id, itemType: 'comment' })
		});
		if (res.ok) {
			localTargetCommentDead = 0;
			localTargetCommentFlagged = false;
			await invalidateAll();
		} else {
			const result = (await res.json()) as { error?: string };
			alert(result.error || 'Vouch failed');
		}
	}

	function canEdit(createdAt: string, userId: number): boolean {
		if (!data.user || data.user.id !== userId) return false;
		const elapsed = Date.now() - new Date(createdAt).getTime();
		return elapsed < 2 * 60 * 60 * 1000;
	}

	const confirmDelete = (message: string) => ({ cancel }: { cancel: () => void }) => {
		if (!confirm(message)) {
			cancel();
			return;
		}
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			await invalidateAll();
		};
	};

	let storyVoted = $derived(localStoryVoted ?? (data.mode === 'story' ? data.storyVoted : false));
	let storyPoints = $derived(localStoryPoints ?? (data.mode === 'story' ? data.story.points : 0));
	let storyFavorited = $derived(localStoryFavorited ?? (data.mode === 'story' ? data.storyFavorited : false));
	let storyFlagged = $derived(localStoryFlagged ?? (data.mode === 'story' ? data.storyFlagged : false));
	let storyDead = $derived(localStoryDead ?? (data.mode === 'story' ? data.story.dead : 0));
	let targetCommentFlagged = $derived(localTargetCommentFlagged ?? (data.mode === 'comment' ? data.commentFlagged : false));
	let targetCommentDead = $derived(localTargetCommentDead ?? (data.mode === 'comment' ? data.targetComment.dead : 0));
	let commentVoteStatesFromServer = $derived(data.commentVoteStates as Record<number, 'up' | 'down'>);

	function getCommentVoteState(commentId: number): 'up' | 'down' | null {
		if (localCommentVoteStates && commentId in localCommentVoteStates) {
			return localCommentVoteStates[commentId];
		}
		return commentVoteStatesFromServer[commentId] ?? null;
	}

	function getCommentPoints(comment: { id: number; points: number }): number {
		return localCommentPoints[comment.id] ?? comment.points;
	}

	let targetCommentVoteState = $derived(
		localTargetCommentVoteState !== undefined
			? localTargetCommentVoteState
			: (data.mode === 'comment' ? (commentVoteStatesFromServer[data.targetComment.id] ?? null) : null)
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
		user_created_at: string;
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
			const result: { voteState: 'up' | 'down' | null; points: number } = await res.json();
			localStoryPoints = result.points;
			localStoryVoted = result.voteState === 'up';
		}
	}

	async function voteTargetComment(direction: 'up' | 'down' = 'up') {
		if (!data.user) {
			window.location.href = '/login';
			return;
		}
		if (data.mode !== 'comment') return;
		const res = await fetch('/api/vote', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ itemId: data.targetComment.id, itemType: 'comment', direction })
		});
		if (res.ok) {
			const result: { voteState: 'up' | 'down' | null; points: number } = await res.json();
			localTargetCommentPoints = result.points;
			localTargetCommentVoteState = result.voteState;
			localCommentVoteStates = {
				...(localCommentVoteStates ?? {}),
				[data.targetComment.id]: result.voteState
			};
		} else if (res.status === 403) {
			const result = (await res.json()) as { error?: string };
			alert(result.error || 'Permission denied');
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
			const result: { voteState: 'up' | 'down' | null; points: number } = await res.json();
			localCommentPoints = { ...localCommentPoints, [commentId]: result.points };
			localCommentVoteStates = {
				...(localCommentVoteStates ?? {}),
				[commentId]: result.voteState
			};
		} else if (res.status === 403) {
			const result = (await res.json()) as { error?: string };
			alert(result.error || 'Permission denied');
		}
	}

	async function toggleFavorite() {
		if (!data.user) {
			window.location.href = '/login';
			return;
		}
		if (data.mode !== 'story') return;
		const res = await fetch('/api/favorite', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ storyId: data.story.id })
		});
		if (res.ok) {
			const result: { favorited: boolean } = await res.json();
			localStoryFavorited = result.favorited;
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
					class:voted={targetCommentVoteState === 'up'}
					onclick={() => voteTargetComment('up')}
					aria-label="upvote comment"
				>
					&#9650;
				</button>
				{#if data.user && data.user.karma >= 500}
					<button
						class="downvote"
						class:voted={targetCommentVoteState === 'down'}
						onclick={() => voteTargetComment('down')}
						aria-label="downvote comment"
					>
						&#9660;
					</button>
				{/if}
			</span>
			<a href="/user/{comment.username}" style={isNewUser(comment.user_created_at) ? 'color: #3c963c;' : ''}>{comment.username}</a>
			<a href="/item/{comment.id}">{timeAgo(comment.created_at)}</a>
			{#if comment.parent_id}
				| <a href="/item/{comment.parent_id}" style="color: #828282;">parent</a>
			{:else}
				| <a href="/item/{parentStory.id}" style="color: #828282;">parent</a>
			{/if}
			| on: <a href="/item/{parentStory.id}">{parentStory.title}</a>
			{#if (comment.flag_count ?? 0) > 0} <span class="story-tag">[flagged]</span>{/if}
			{#if targetCommentDead === 1} <span class="story-tag">[dead]</span>{/if}
			{#if canEdit(comment.created_at, comment.user_id)}
				| <a
					href="#edit"
					onclick={(e) => {
						e.preventDefault();
						editingCommentId = comment.id;
					}}>edit</a>
			{/if}
			{#if canFlagItem(comment.user_id)}
				| <a href="#flag" onclick={(e) => { e.preventDefault(); flagTargetComment(); }}>{targetCommentFlagged ? 'un-flag' : 'flag'}</a>
			{/if}
			{#if canFlagItem(comment.user_id) && targetCommentDead === 1}
				| <a href="#vouch" onclick={(e) => { e.preventDefault(); vouchTargetComment(); }}>vouch</a>
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
			<div class="comment-text" class:faded={targetCommentPoints < 1} style="padding-left: 14px;">
				{#each comment.text.split('\n') as paragraph}
					{#if paragraph.trim()}
						<p>{@html formatText(paragraph)}</p>
					{/if}
				{/each}
			</div>
		{/if}

		{#if form?.error && form?.errorFor === 'comment'}
			<div style="padding-left: 14px; color: #ff0000; font-size: 9pt; margin-bottom: 4px;">{form.error}</div>
		{/if}
		{#if data.user && isThreadOpen(data.parentStory.created_at)}
			<div class="comment-form" style="padding-left: 14px;">
				<form method="POST" action="?/comment" use:enhance={() => {
					return async ({ update }) => {
						await update();
						await invalidateAll();
					};
				}}>
					<input type="hidden" name="parent_id" value={comment.id} />
					<textarea name="text" rows="6" cols="60">{form?.errorFor === 'comment' ? form?.text ?? '' : ''}</textarea>
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
								class:voted={getCommentVoteState(child.id) === 'up'}
								onclick={() => voteComment(child.id, 'up')}
								aria-label="upvote comment"
							>
								&#9650;
							</button>
							{#if data.user && data.user.karma >= 500}
								<button
									class="downvote"
									class:voted={getCommentVoteState(child.id) === 'down'}
									onclick={() => voteComment(child.id, 'down')}
									aria-label="downvote comment"
								>
									&#9660;
								</button>
							{/if}
						</span>
						<a href="/user/{child.username}" style={isNewUser(child.user_created_at) ? 'color: #3c963c;' : ''}>{child.username}</a>
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
						<div class="comment-text" class:faded={getCommentPoints(child) < 1} style="padding-left: 14px;">
							{#each child.text.split('\n') as paragraph}
								{#if paragraph.trim()}
									<p>{@html formatText(paragraph)}</p>
								{/if}
							{/each}
						</div>
					{/if}
					{#if data.user}
						<div class="comment-reply" style="padding-left: 14px;">
							{#if isThreadOpen(data.parentStory.created_at)}
								<a
									href="#reply"
									onclick={(e) => {
										e.preventDefault();
										toggleReply(child.id);
									}}>reply</a
								>
							{/if}
							{#if canEdit(child.created_at, child.user_id)}
								{#if isThreadOpen(data.parentStory.created_at)}|{/if} <a
									href="#edit"
									onclick={(e) => {
										e.preventDefault();
										editingCommentId = child.id;
									}}>edit</a>
								| <form method="POST" action="?/deleteComment" class="inline-form" use:enhance={confirmDelete('Delete this comment? Text will be replaced with [deleted].')}>
									<input type="hidden" name="comment_id" value={child.id} />
									<button type="submit" class="link-button">delete</button>
								</form>
							{/if}
						</div>
						{#if isThreadOpen(data.parentStory.created_at) && replyTo === child.id}
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
				{#if (data.story.flag_count ?? 0) > 0} <span class="story-tag">[flagged]</span>{/if}
				{#if storyDead === 1} <span class="story-tag">[dead]</span>{/if}
			</span>
		</div>

		<div class="item-meta" style="padding-left: 18px;">
			{storyPoints} point{storyPoints !== 1 ? 's' : ''} by
			<a href="/user/{data.story.username}" style={isNewUser(data.story.user_created_at) ? 'color: #3c963c;' : ''}>{data.story.username}</a>
			{timeAgo(data.story.created_at)}
			{#if canEdit(data.story.created_at, data.story.user_id)}
				| <a
					href="#edit"
					onclick={(e) => {
						e.preventDefault();
						editingStory = true;
					}}>edit</a>
				| <form method="POST" action="?/deleteStory" class="inline-form" use:enhance={confirmDelete('Delete this story? Text will be replaced with [deleted].')}>
					<button type="submit" class="link-button">delete</button>
				</form>
			{/if}
			{#if data.user}
				| <a
					href="#favorite"
					onclick={(e) => {
						e.preventDefault();
						toggleFavorite();
					}}>{storyFavorited ? 'un-fav' : 'favorite'}</a>
			{/if}
			{#if canFlagItem(data.story.user_id)}
				| <a href="#flag" onclick={(e) => { e.preventDefault(); flagStory(); }}>{storyFlagged ? 'un-flag' : 'flag'}</a>
			{/if}
			{#if canFlagItem(data.story.user_id) && storyDead === 1}
				| <a href="#vouch" onclick={(e) => { e.preventDefault(); vouchStory(); }}>vouch</a>
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
						<p>{@html formatText(paragraph)}</p>
					{/if}
				{/each}
			</div>
		{/if}

		{#if form?.error && form?.errorFor === 'comment'}
			<div style="padding-left: 18px; color: #ff0000; font-size: 9pt; margin-bottom: 4px;">{form.error}</div>
		{/if}
		{#if data.user && isThreadOpen(data.story.created_at)}
			<div class="comment-form" style="padding-left: 18px;">
				<form method="POST" action="?/comment" use:enhance={() => {
					return async ({ update }) => {
						await update();
						await invalidateAll();
					};
				}}>
					<textarea name="text" rows="6" cols="60">{form?.errorFor === 'comment' ? form?.text ?? '' : ''}</textarea>
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
						<div class="comment-text" class:faded={getCommentPoints(comment) < 1} style="padding-left: 14px;">
							{#each comment.text.split('\n') as paragraph}
								{#if paragraph.trim()}
									<p>{@html formatText(paragraph)}</p>
								{/if}
							{/each}
						</div>
					{/if}
					{#if data.user}
						<div class="comment-reply" style="padding-left: 14px;">
							{#if isThreadOpen(data.story.created_at)}
								<a
									href="#reply"
									onclick={(e) => {
										e.preventDefault();
										toggleReply(comment.id);
									}}>reply</a
								>
							{/if}
							{#if canEdit(comment.created_at, comment.user_id)}
								{#if isThreadOpen(data.story.created_at)}|{/if} <a
									href="#edit"
									onclick={(e) => {
										e.preventDefault();
										editingCommentId = comment.id;
									}}>edit</a>
								| <form method="POST" action="?/deleteComment" class="inline-form" use:enhance={confirmDelete('Delete this comment? Text will be replaced with [deleted].')}>
									<input type="hidden" name="comment_id" value={comment.id} />
									<button type="submit" class="link-button">delete</button>
								</form>
							{/if}
						</div>
						{#if isThreadOpen(data.story.created_at) && replyTo === comment.id}
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
