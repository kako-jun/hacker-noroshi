<script lang="ts">
	import '../app.css';

	let { data, children } = $props();
</script>

<svelte:head>
	<title>ハッカーのろし</title>
</svelte:head>

<div class="hn-page">
	<header class="hn-header">
		<div class="hn-header-left">
			<a href="/" class="hn-header-logo">H</a>
			<a href="/" class="hn-header-site-name">ハッカーのろし</a>
			<nav class="hn-header-nav">
				<a href="/newest">new</a>
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
		<a href="/newcomments">newcomments</a> | <a href="/best">best</a> |
		<a href="/guidelines">ガイドライン</a> | <a href="/faq">FAQ</a> | <span>API</span> |
		<a href="https://github.com/kako-jun/hacker-noroshi">GitHub</a>
	</footer>
</div>
