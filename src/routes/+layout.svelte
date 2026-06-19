<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { label, localeToggleHref, tooltip } from '$lib/i18n';

	let { data, children } = $props();

	type NavItem = { href: string; label: string; topright: string };
	const navItems: NavItem[] = [
		{ href: '/newest', label: 'new', topright: 'new' },
		{ href: '/front', label: 'past', topright: 'past' },
		{ href: '/newcomments', label: 'comments', topright: 'comments' },
		{ href: '/ask', label: 'ask', topright: 'ask' },
		{ href: '/show', label: 'show', topright: 'show' },
		{ href: '/submit', label: 'submit', topright: 'submit' }
	];

	// /asknew, /noobstories, /shownew, /noobcomments, /bestcomments, /best, /active,
	// /highlights, /newpoll, /polls など nav に出ていないがページ名表示は出すパス
	const extraToprightMap: Record<string, string> = {
		'/asknew': 'asknew',
		'/noobstories': 'noobstories',
		'/noobcomments': 'noobcomments',
		'/shownew': 'shownew',
		'/showhn': 'showhn',
		'/bestcomments': 'bestcomments',
		'/best': 'best',
		'/active': 'active',
		'/highlights': 'highlights',
		'/newpoll': 'newpoll',
		'/polls': 'polls',
		'/leaders': 'leaders',
		'/lists': 'lists',
		'/from': 'from',
		'/search': 'search',
		// /login /signup /logout は header-right の認証リンクとテキストが重複するので topright を出さない
		'/faq': 'faq',
		'/guidelines': 'guidelines',
		'/api-docs': 'api',
		'/admin': 'admin',
		'/ipban': 'ipban'
	};

	function isActive(href: string, pathname: string): boolean {
		// 完全一致のみアクティブ扱い（/ask が /asknew でアクティブにならないように）
		return pathname === href;
	}

	function currentTopright(pathname: string): string {
		const match = navItems.find((n) => n.href === pathname);
		if (match) return match.topright;
		if (extraToprightMap[pathname]) return extraToprightMap[pathname];
		return '';
	}

	function l(key: string): string {
		return label(key, data.locale);
	}

	function tip(key: string): string {
		return tooltip(key, data.locale);
	}
</script>

<svelte:head>
	<title>ハッカーのろし</title>
	<link rel="alternate" type="application/rss+xml" title="ハッカーのろし" href="/rss" />
</svelte:head>

<div class="hn-page">
	<header class="hn-header">
		<div class="hn-header-left">
			<a href="/" class="hn-header-logo"><img src="/icon-header.webp" alt="ハッカーのろし" width="18" height="18" /></a>
			<a href="/" class="hn-header-site-name">ハッカーのろし</a>
			<nav class="hn-header-nav">
				{#each navItems as item, i (item.href)}
					{#if i > 0}
						<span class="nav-separator">|</span>
					{/if}
					<a
						href={item.href}
						title={tip(item.label)}
						class:active={isActive(item.href, page.url.pathname)}
						aria-current={isActive(item.href, page.url.pathname) ? 'page' : undefined}>{l(item.label)}</a
					>
				{/each}
			</nav>
		</div>
		<div class="hn-header-pagename">
			{#if currentTopright(page.url.pathname)}
				<span class="topright" title={tip(currentTopright(page.url.pathname))}>{l(currentTopright(page.url.pathname))}</span>
			{/if}
		</div>
		<div class="hn-header-right">
			<a href={localeToggleHref(data.locale, page.url.pathname, page.url.search)}>{l('lang')}</a> |
			{#if data.user}
				<a href="/user/{data.user.username}">{data.user.username}</a> ({data.user.karma}) |
				<a href="/logout" title={tip('logout')}>{l('logout')}</a>
			{:else}
				<a href="/login" title={tip('login')}>{l('login')}</a>
			{/if}
		</div>
	</header>

	<main>
		{@render children()}
	</main>

	<footer class="hn-footer">
		<a href="/guidelines" title={tip('Guidelines')}>{l('Guidelines')}</a> | <a href="/faq" title={tip('FAQ')}>{l('FAQ')}</a> | <a href="/lists" title={tip('Lists')}>{l('Lists')}</a> |
		<a href="/api-docs" title={tip('API')}>{l('API')}</a> | <a href="https://github.com/kako-jun/hacker-noroshi" title={tip('GitHub')}>{l('GitHub')}</a> |
		<a href="/search" title={tip('Search')}>{l('Search')}</a>
		<form action="/search" method="get" class="hn-footer-search">
			{l('Search')}: <input type="text" name="q" />
		</form>
	</footer>
</div>
