<script lang="ts">
	import StoryList from '$lib/components/StoryList.svelte';

	let { data } = $props();

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

<StoryList
	stories={data.stories}
	user={data.user}
	votedIds={data.votedIds}
	flaggedIds={data.flaggedIds}
	rankStart={(data.page - 1) * 30}
	moreHref={data.stories.length === 30 ? `/front?day=${data.day}&p=${data.page + 1}` : null}
/>

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
