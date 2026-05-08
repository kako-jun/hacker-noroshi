// 英語 UI ラベル → 日本語ツールチップ訳の辞書。`title` 属性で hover 表示する用途。
// テキスト本体は英語のまま、見た目は本家 HN を崩さない（DESIGN.md 方針）。
// 動的 label (time-ago / 数値混合 / plural ラベル) は本辞書の対象外。
// Issue: kako-jun/hacker-noroshi#133
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
	// prev は本家 HN レイアウトでは現状描画されないが、将来コメント間移動を
	// 追加した際に流用できるよう辞書だけ先取りで持つ。tooltipJa('prev') が
	// 呼ばれていない状態が正常。
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
