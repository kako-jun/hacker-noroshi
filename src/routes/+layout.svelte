<script lang="ts">
	import '../app.css';

	let { data, children } = $props();
</script>

<svelte:head>
	<title>ハッカーのろし</title>
	<link rel="alternate" type="application/rss+xml" title="ハッカーのろし" href="/rss" />
</svelte:head>

<div class="hn-page">
	<header class="hn-header">
		<div class="hn-header-left">
			<a href="/" class="hn-header-logo"><img src="/icon-16.webp" alt="ハッカーのろし" width="18" height="18" /></a>
			<a href="/" class="hn-header-site-name">ハッカーのろし</a>
			<nav class="hn-header-nav">
				<a href="/newest">new</a>
				<span class="nav-separator">|</span>
				<a href="/front">past</a>
				<span class="nav-separator">|</span>
				<a href="/newcomments">comments</a>
				<span class="nav-separator">|</span>
				<a href="/ask">ask</a>
				<span class="nav-separator">|</span>
				<a href="/show">show</a>
				<span class="nav-separator">|</span>
				<a href="/submit">submit</a>
			</nav>
		</div>
		<div class="hn-header-right">
			{#if data.user}
				<a href="/user/{data.user.username}">{data.user.username}</a> ({data.user.karma}) |
				<a href="/logout">logout</a>
			{:else}
				<a href="/login">login</a>
			{/if}
		</div>
	</header>

	<main>
		{@render children()}
	</main>

	<footer class="hn-footer">
		<a href="/guidelines">Guidelines</a> | <a href="/faq">FAQ</a> | <a href="/lists">Lists</a> |
		<a href="/api-docs">API</a> | <a href="https://github.com/kako-jun/hacker-noroshi">GitHub</a>
	</footer>
</div>
