<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import StoryListItem from '$lib/components/StoryListItem.svelte';
	import { tooltipJa } from '$lib/i18n';

	// StoryListItem の story / user 型をそのまま再利用する（型の二重定義を避ける）。
	type ItemProps = ComponentProps<typeof StoryListItem>;
	type Story = ItemProps['story'];

	type Props = {
		stories: Story[];
		user: ItemProps['user'];
		votedIds: number[];
		flaggedIds?: number[];
		/** サーバー側で既に hidden 判定された ID（polls の data.hiddenIds 等）。 */
		serverHiddenIds?: number[];
		/** 先頭行の rank（= (page-1)*30）。null なら順位を出さない（search）。 */
		rankStart?: number | null;
		/** 次ページの href。null なら More を出さない。条件はページ側が計算して渡す。 */
		moreHref?: string | null;
		/** url 無しでも常に [poll] タグを付ける（polls）。 */
		forcePollTag?: boolean;
		/** /hidden 用（#153）。各行を hide でなく un-hide で出し、un-hide で行を一覧から消す。
		 *  この一覧は hidden を「表示」するので serverHiddenIds 等での除外はしない。 */
		unhide?: boolean;
	};

	let {
		stories,
		user,
		votedIds,
		flaggedIds = [],
		serverHiddenIds = [],
		rankStart = 0,
		moreHref = null,
		forcePollTag = false,
		unhide = false
	}: Props = $props();

	let votedSet = $derived(new Set<number>(votedIds));
	let flaggedSet = $derived(new Set<number>(flaggedIds));
	let serverHiddenSet = $derived(new Set<number>(serverHiddenIds));

	// hide はクライアントで楽観的に行う。サーバー由来の hidden と合算して判定する。
	let localHiddenIds = $state<Set<number>>(new Set());
	function isHidden(id: number): boolean {
		return serverHiddenSet.has(id) || localHiddenIds.has(id);
	}
	// hide でも un-hide でも、成功した行はこの一覧から即座に消す（楽観更新）。
	function removeFromView(id: number) {
		const next = new Set(localHiddenIds);
		next.add(id);
		localHiddenIds = next;
	}

	// 行コントロール解説（#143）は「描画上の先頭可視行」に1回だけ。絶対 rank ではなく可視先頭で判定するので、
	// 2ページ目（rank=31〜）・rank 無しの search・先頭を hide した直後でも、ちゃんと次の先頭行に出る。
	let firstVisibleId = $derived(stories.find((s) => !isHidden(s.id))?.id);
</script>

<div class="story-list">
	{#each stories as story, i (story.id)}
		{#if !isHidden(story.id)}
			<StoryListItem
				{story}
				rank={rankStart === null ? null : rankStart + i + 1}
				assistFirst={story.id === firstVisibleId}
				{user}
				initialVoted={votedSet.has(story.id)}
				initialFlagged={flaggedSet.has(story.id)}
				{forcePollTag}
				onhide={unhide ? undefined : removeFromView}
				onunhide={unhide ? removeFromView : undefined}
			/>
		{/if}
	{/each}
</div>

{#if moreHref}
	<div class="more-link">
		<a href={moreHref} title={tooltipJa('More')}>More</a>
	</div>
{/if}
