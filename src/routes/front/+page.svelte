<script lang="ts">
	import StoryListItem from '$lib/components/StoryListItem.svelte';
	import { tooltipJa } from '$lib/i18n';

	let { data } = $props();
	let votedIds = $derived(new Set<number>(data.votedIds));
	let flaggedIds = $derived(new Set<number>(data.flaggedIds ?? []));
	let localHiddenIds = $state<Set<number>>(new Set());

	function onhide(id: number) {
		const next = new Set(localHiddenIds);
		next.add(id);
		localHiddenIds = next;
	}

	function formatDay(day: string): string {
		const d = new Date(day + 'T00:00:00Z');
		return d.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			timeZone: 'UTC'
		});
	}

	function shiftDay(day: string, delta: number): string {
		const d = new Date(day + 'T00:00:00Z');
		d.setUTCDate(d.getUTCDate() + delta);
		return d.toISOString().slice(0, 10);
	}

	function shiftMonth(day: string, delta: number): string {
		const d = new Date(day + 'T00:00:00Z');
		d.setUTCMonth(d.getUTCMonth() + delta);
		return d.toISOString().slice(0, 10);
	}

	function shiftYear(day: string, delta: number): string {
		const d = new Date(day + 'T00:00:00Z');
		d.setUTCFullYear(d.getUTCFullYear() + delta);
		return d.toISOString().slice(0, 10);
	}
</script>

<div class="front-nav">
	<div class="front-nav-line">{formatDay(data.day)} (UTC) のストーリー。</div>
	<div class="front-nav-line">
		<a href="/front?day={shiftDay(data.day, -1)}">1日前</a> /
		<a href="/front?day={shiftMonth(data.day, -1)}">1ヶ月前</a> /
		<a href="/front?day={shiftYear(data.day, -1)}">1年前</a> へ。
		<a href="/front?day={shiftDay(data.day, 1)}">1日後</a> へ。
	</div>
</div>

{#if data.stories.length === 0}
	<div class="front-empty">No stories for this date.</div>
{/if}

<div class="story-list">
	{#each data.stories as story, i (story.id)}
		{#if !localHiddenIds.has(story.id)}
			<StoryListItem
				{story}
				rank={(data.page - 1) * 30 + i + 1}
				user={data.user}
				initialVoted={votedIds.has(story.id)}
				initialFlagged={flaggedIds.has(story.id)}
				{onhide}
			/>
		{/if}
	{/each}
</div>

{#if data.stories.length === 30}
	<div class="more-link">
		<a href="/front?day={data.day}&p={data.page + 1}" title={tooltipJa('More')}>More</a>
	</div>
{/if}

<style>
	.front-nav {
		padding: 6pt 0 6pt 6pt;
		font-size: 9pt;
		color: #000000;
	}

	.front-nav-line {
		padding: 1pt 0;
	}

	.front-nav a {
		color: #000000;
	}

	.front-empty {
		padding: 10pt 0;
		font-size: 10pt;
		color: #828282;
	}
</style>
