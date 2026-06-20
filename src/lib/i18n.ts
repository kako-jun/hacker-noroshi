export const LOCALES = ['en', 'ja'] as const;
export type Locale = (typeof LOCALES)[number];
export type StoryType = 'story' | 'ask' | 'show';

export function normalizeLocale(raw: string | null | undefined): Locale {
	return raw === 'ja' ? 'ja' : 'en';
}

// Stable UI label keys. English and Japanese are display data for the same
// routes/actions; locale must not change behavior.
export const UI_LABELS = {
	en: {
		new: 'new',
		newest: 'newest',
		past: 'past',
		comments: 'comments',
		ask: 'ask',
		show: 'show',
		submit: 'submit',
		login: 'login',
		logout: 'logout',
		'create account': 'create account',
		Guidelines: 'Guidelines',
		FAQ: 'FAQ',
		Lists: 'Lists',
		API: 'API',
		GitHub: 'GitHub',
		Search: 'Search',
		asknew: 'asknew',
		shownew: 'shownew',
		showhn: 'showhn',
		noobstories: 'noobstories',
		noobcomments: 'noobcomments',
		bestcomments: 'bestcomments',
		best: 'best',
		active: 'active',
		highlights: 'highlights',
		newpoll: 'newpoll',
		polls: 'polls',
		leaders: 'leaders',
		lists: 'lists',
		from: 'from',
		search: 'search',
		faq: 'faq',
		guidelines: 'guidelines',
		api: 'api',
		admin: 'admin',
		ipban: 'ipban',
		title: 'title',
		url: 'url',
		text: 'text',
		'story-type': 'type',
		'story-type-story': 'Story',
		'story-type-ask': 'Ask HN',
		'story-type-show': 'Show HN',
		'story-type-assist':
			'Hacker Noroshi assistance: choose a type here, or keep using HN-style "Ask HN:" / "Show HN:" title prefixes.',
		choices: 'choices',
		or: 'or',
		'form-note-submit':
			'Leave url blank for a text post. The type selector is Hacker Noroshi assistance; HN-style "Ask HN:" / "Show HN:" title prefixes still work.',
		'form-note-poll-prefix': 'Or',
		'form-note-poll-link': 'submit a poll',
		'form-note-poll':
			'Choices: one per line, blank lines OK between. Minimum 2, maximum 10. Each choice up to 300 characters.',
		Login: 'Login',
		'Create Account': 'Create Account',
		username: 'username',
		password: 'password',
		'login-note':
			'Usernames can only contain letters, digits, underscores, and hyphens, and should be between 3 and 15 characters long. Passwords should be at least 8 characters.',
		lang: '日本語',
		hide: 'hide',
		'un-hide': 'un-hide',
		flag: 'flag',
		'un-flag': 'un-flag',
		discuss: 'discuss',
		comment: 'comment',
		commentsLabel: 'comments',
		point: 'point',
		points: 'points',
		by: 'by',
		edit: 'edit',
		delete: 'delete',
		vouch: 'vouch',
		favorite: 'favorite',
		'un-fav': 'un-fav',
		parent: 'parent',
		root: 'root',
		context: 'context',
		next: 'next',
		prev: 'prev',
		reply: 'reply',
		More: 'More',
		cancel: 'cancel',
		update: 'update',
		'add comment': 'add comment'
	},
	ja: {
		new: '新着',
		newest: '新着',
		past: '過去',
		comments: 'コメント',
		ask: '質問',
		show: '作ったもの',
		submit: '投稿',
		login: 'ログイン',
		logout: 'ログアウト',
		'create account': 'アカウント作成',
		Guidelines: 'ガイドライン',
		FAQ: 'FAQ',
		Lists: '一覧',
		API: 'API',
		GitHub: 'GitHub',
		Search: '検索',
		asknew: '新着の質問',
		shownew: '新着の作ったもの',
		showhn: '作ったもの',
		noobstories: '新規ユーザーの投稿',
		noobcomments: '新規ユーザーのコメント',
		bestcomments: 'ベストコメント',
		best: 'ベスト',
		active: 'アクティブ',
		highlights: 'ハイライト',
		newpoll: '新規投票',
		polls: '投票',
		leaders: 'ランキング',
		lists: '一覧',
		from: 'ドメイン',
		search: '検索',
		faq: 'FAQ',
		guidelines: 'ガイドライン',
		api: 'API',
		admin: '管理',
		ipban: 'IP BAN',
		title: 'タイトル',
		url: 'URL',
		text: '本文',
		'story-type': '種別',
		'story-type-story': '通常投稿',
		'story-type-ask': '質問',
		'story-type-show': '作ったもの',
		'story-type-assist':
			'操作補助: ここで種別を選べます。HN互換の "Ask HN:" / "Show HN:" タイトル指定も引き続き使えます。',
		choices: '選択肢',
		or: 'または',
		'form-note-submit':
			'URLを空にするとテキスト投稿になります。種別は操作補助です。HN互換の "Ask HN:" / "Show HN:" タイトル指定も引き続き使えます。',
		'form-note-poll-prefix': 'または',
		'form-note-poll-link': '投票を投稿',
		'form-note-poll':
			'選択肢は1行に1つずつ入力してください。空行は無視されます。2個以上10個以下、各選択肢は300文字までです。',
		Login: 'ログイン',
		'Create Account': 'アカウント作成',
		username: 'ユーザー名',
		password: 'パスワード',
		'login-note':
			'ユーザー名に使えるのは英数字、アンダースコア、ハイフンのみです。長さは3〜15文字、パスワードは8文字以上にしてください。',
		lang: 'English',
		hide: '非表示',
		'un-hide': '非表示解除',
		flag: '通報',
		'un-flag': '通報解除',
		discuss: '議論する',
		comment: 'コメント',
		commentsLabel: 'コメント',
		point: '点',
		points: '点',
		by: '投稿者',
		edit: '編集',
		delete: '削除',
		vouch: '復活',
		favorite: 'お気に入り',
		'un-fav': 'お気に入り解除',
		parent: '親',
		root: '先頭',
		context: '文脈',
		next: '次',
		prev: '前',
		reply: '返信',
		More: '次へ',
		cancel: 'キャンセル',
		update: '更新',
		'add comment': 'コメントを追加'
	}
} as const;

export const STORY_TYPE_OPTIONS = [
	{ id: 'story', labelKey: 'story-type-story' },
	{ id: 'ask', labelKey: 'story-type-ask' },
	{ id: 'show', labelKey: 'story-type-show' }
] as const satisfies readonly { id: StoryType; labelKey: string }[];

export function normalizeStoryType(raw: FormDataEntryValue | string | null | undefined): StoryType {
	return raw === 'ask' || raw === 'show' ? raw : 'story';
}

export function storyTypeFromTitle(title: string): StoryType | null {
	const normalized = title.trim().toLowerCase();
	if (normalized.startsWith('ask hn:')) return 'ask';
	if (normalized.startsWith('show hn:')) return 'show';
	return null;
}

export function storyTypeFromTitleOrInput(
	title: string,
	rawType: FormDataEntryValue | string | null | undefined
): StoryType {
	return storyTypeFromTitle(title) ?? normalizeStoryType(rawType);
}

export function storyTypeLabel(type: string | null | undefined, locale: Locale): string {
	if (type !== 'ask' && type !== 'show') return '';
	return label(`story-type-${type}`, locale);
}

export function hasLegacyStoryTypePrefix(title: string, type: string | null | undefined): boolean {
	const detected = storyTypeFromTitle(title);
	return detected !== null && detected === type;
}

export function label(key: string, locale: Locale): string {
	const labels = UI_LABELS[locale] as Record<string, string>;
	return labels[key] ?? key;
}

export function alternateLocale(locale: Locale): Locale {
	return locale === 'ja' ? 'en' : 'ja';
}

export function localeToggleHref(locale: Locale, pathname: string, search = ''): string {
	const next = `${pathname}${search}`;
	return `/locale?lang=${alternateLocale(locale)}&next=${encodeURIComponent(next)}`;
}

// English UI label -> Japanese tooltip. Kept for English mode and for places
// that still intentionally render HN-compatible English labels.
export const TOOLTIP_JA = {
	// ヘッダー nav
	new: '新着',
	newest: '新着',
	past: '過去',
	comments: 'コメント',
	ask: 'Ask HN（質問・相談）',
	show: 'Show HN（自作紹介）',
	submit: '投稿',

	// ヘッダー右 / 認証
	login: 'ログイン',
	logout: 'ログアウト',
	'create account': 'アカウント作成',

	// フッター
	Guidelines: 'ガイドライン',
	FAQ: 'よくある質問',
	Lists: '各種一覧',
	API: '公開 API のドキュメント',
	GitHub: 'GitHub リポジトリ',
	Search: '検索',

	// topright (ページ名)
	asknew: '新着の Ask HN',
	shownew: '新着の Show HN',
	showhn: 'Show HN',
	noobstories: '新規ユーザーの投稿',
	noobcomments: '新規ユーザーのコメント',
	bestcomments: 'ベストコメント',
	best: 'ベスト（高得点）',
	active: 'アクティブ（議論中）',
	highlights: 'ハイライト',
	newpoll: '新規投票（poll）作成',
	polls: '投票（poll）一覧',
	leaders: '高 karma ユーザー',
	lists: '各種一覧',
	from: 'ドメイン別投稿',
	search: '検索',
	faq: 'よくある質問',
	guidelines: 'ガイドライン',
	api: '公開 API のドキュメント',
	admin: '管理者画面',
	ipban: 'IP BAN 管理',

	// アクションリンク
	edit: '編集',
	delete: '削除',
	hide: '非表示にする',
	'un-hide': '非表示を解除',
	flag: '通報する',
	'un-flag': '通報を取り消す',
	vouch: '復活させる（dead 解除）',
	favorite: 'お気に入りに追加',
	'un-fav': 'お気に入り解除',
	parent: '親コメントへ',
	root: 'スレッドの先頭へ',
	context: '前後の文脈を見る',
	next: '次へ',
	// prev はコメントツリー行で next と対に描画する（#157）。本家 HN も
	// item ページのコメント行に prev | next を出す（DFS 順の前後コメントへ）。
	prev: '前へ',
	reply: '返信',
	More: '次のページ',
	cancel: 'キャンセル',
	update: '更新',
	'add comment': 'コメントを追加'
} as const;

export function tooltipJa(key: string): string {
	return (TOOLTIP_JA as Record<string, string>)[key] ?? '';
}

export function tooltip(key: string, locale: Locale): string {
	if (locale === 'en') return tooltipJa(key);
	return label(key, 'en');
}
