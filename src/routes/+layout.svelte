<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { label, localeToggleHref, tooltip } from '$lib/i18n';
	import { assistHint, assistIntro, assistSwitchLabel, assistAboutLabel, assistAboutUrl } from '$lib/assist';

	let { data, children } = $props();

	// 画面の解説（.assist-intro）は現在の route だけで決まる純関数なので、各ページにベタ書きせず
	// ここで 1 箇所だけ描画する（doctrine #3 webbed UI 重複の解消・#143）。route id にキーが無ければ空。
	let assistIntroText = $derived(assistIntro(page.route.id, data.locale));
	// メタ解説（言語/アシスト本体）。カルマ文は実際に (123) が見えるログイン中だけ後段に足す（未ログインに
	// 存在しないコントロールを教えない・レビュー指摘）。解説対象の「教えるページ」= intro があるページにだけ出し、
	// faq/guidelines 等の純粋ページには出さない（サイト全体への過剰露出を避ける・レビュー指摘）。
	let metaHintText = $derived(
		assistIntroText
			? assistHint('meta.controls', data.locale) +
					(data.user ? ' ' + assistHint('meta.karma', data.locale) : '')
			: ''
	);

	// アシストモード（#140）。SSR 値（cookie 由来 data.assist）で初期化＝初期描画のフラッシュ無し。
	// クライアントではスイッチで即座にトグル（リロード無し・スクロール維持）し、cookie に焼いて次回 SSR と一致させる。
	let assistOn = $state(data.assist);
	function toggleAssist() {
		assistOn = !assistOn;
		document.cookie = `assist=${assistOn ? '1' : '0'}; path=/; max-age=${365 * 24 * 60 * 60}; samesite=lax`;
	}
	// ナビゲーションで cookie 由来の data.assist が変わったら追従する（別タブ等で cookie が変わった状態に
	// 遷移後も古い初期値が残るのを防ぐ・レビュー指摘）。手動トグルは data.assist 不変なので上書きされない。
	$effect(() => {
		assistOn = data.assist;
	});

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

<div class="hn-page" class:assist-on={assistOn}>
	<header class="hn-header">
		<div class="hn-header-left">
			<a href="/" class="hn-header-logo"><img src="/icon-header.webp" alt="ハッカーのろし" width="18" height="18" /></a>
			<div class="hn-header-titlenav">
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
				<!-- フル遷移でログアウトする（data-sveltekit-reload）。SPA だと /logout の load が session を消しても
				     layout の cookie 読みは依存追跡外で再実行されず、ヘッダが「ログイン中」のまま残る（リロードまで）。
				     さらに body の preload-data="hover" で hover すると /logout load が先読みされ session が消える事故も防ぐ。 -->
				<a href="/logout" title={tip('logout')} data-sveltekit-reload data-sveltekit-preload-data="off"
					>{l('logout')}</a
				>
			{:else}
				<a href="/login" title={tip('login')}>{l('login')}</a>
			{/if}
		</div>
	</header>

	{#if metaHintText}
		<div class="assist-hint">{metaHintText}</div>
	{/if}

	<main>
		{#if assistIntroText}
			<p class="assist-intro">{assistIntroText}</p>
		{/if}
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

	<!-- アシストモードのスイッチ（#140）。右下に固定・スクロール追従。青/ガラスで HN コアと分離。
	     押すと即トグル（リロード無し）。aria-pressed で状態を支援技術へ伝える。
	     左隣の ⓘ リンク（#160）は常設（assist ON/OFF どちらでも表示）で llll-ll の目的記事へ別タブで飛ぶ。 -->
	<div class="assist-dock">
		<a
			class="assist-about"
			href={assistAboutUrl(data.locale)}
			target="_blank"
			rel="noopener noreferrer"
			title={assistAboutLabel(data.locale)}
			aria-label={assistAboutLabel(data.locale)}
		>
			<!-- ⓘ インフォアイコン（円の中に i）。currentColor で白に追従。 -->
			<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
				<circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5" />
				<circle cx="8" cy="4.3" r="1" fill="currentColor" />
				<rect x="7.1" y="6.4" width="1.8" height="5.4" rx="0.9" fill="currentColor" />
			</svg>
		</a>
		<button
			type="button"
			class="assist-switch"
			role="switch"
			aria-checked={assistOn}
			aria-label={assistSwitchLabel(data.locale)}
			title={assistSwitchLabel(data.locale)}
			onclick={toggleAssist}
		>
			<span class="assist-switch-track"><span class="assist-switch-thumb"></span></span>
			<span class="assist-switch-text">{assistSwitchLabel(data.locale)}</span>
		</button>
	</div>
</div>
