// アシストモード（#140）の「定義データ」。
//
// アシストは Hacker Noroshi 独自の操作補助層。オンの間だけ、各画面の上部にその画面が何かの解説を出し、
// 主要コントロールの近くに「押すとどうなるか」「何を書くのが定番か」を出す。オフなら HN 忠実な素の画面に戻る。
// 表示は CSS（`.assist-on` 配下でだけ可視）で切り替え、内容はここに ja/en で集約する（i18n.ts と同じ流儀）。
//
// HN 橙は使わず青系のアシスト色で、HN コア UI と視覚的に分離する（描画は app.css の .assist-* ）。

import type { Locale } from './i18n';

/** assist cookie（'1' でオン）を真偽に正規化する。既定はオフ。 */
export function normalizeAssist(raw: string | null | undefined): boolean {
	return raw === '1';
}

/** 画面ごとの「この画面は何か」解説。キーは SvelteKit の route id（`page.route.id`）。
 *  描画は +layout.svelte が現在の route id でここを 1 箇所だけ引く（個別ページにベタ書きしない）。 */
const ASSIST_INTRO: Record<Locale, Record<string, string>> = {
	ja: {
		// 日本語ラベルを先に出し、本家 Hacker News（英語）の用語を括弧で教える＝見ている語と一致しつつ、
		// いずれ英語の本家でデビューするための練習になる（#140）。
		// 頭の intro は「この画面は◯◯（HN語）」程度の短い1〜2文に留め、詳細は対象 UI 脇のヒントに任せる（#170）。
		'/': 'ここは「ハッカーのろし」。本家 Hacker News（英語）でデビューするための練習場です。新着（new）・質問（Ask）・作ったもの（Show）を眺めて、気軽に投稿してみましょう。',
		'/submit': '投稿ページです。タイトルと、リンク（URL）か本文（text）のどちらかを入れて送信します。',
		'/ask': '質問（本家 Hacker News では「Ask」）＝コミュニティへの質問・相談が集まる場所です。',
		'/show': '作ったもの（本家 Hacker News では「Show」）＝自作のツールやサービスを見せる場所です。',
		'/showhn': '作ったもの（本家 Hacker News では「Show HN」）＝自作物の投稿だけを集めた一覧です。',
		'/newest': '新着（本家 Hacker News では「new」）＝投稿されたばかりのストーリーが新しい順に並びます。',
		'/asknew': '新着の質問（本家 Hacker News では「Ask」の新着）＝質問のうち、投稿されたばかりのものが並びます。',
		'/shownew': '新着の作ったもの（本家 Hacker News では「Show」の新着）＝自作物のうち、投稿されたばかりのものが並びます。',
		'/front': '過去（本家 Hacker News では「past」）＝指定した日付に上位だったストーリーを振り返れます。日付は上のリンクで前後に動かせます。',
		'/best': 'ベスト（本家 Hacker News では「best」）＝直近で特に高得点だったストーリーが並びます。',
		'/active': 'アクティブ（本家 Hacker News では「active」）＝いま議論が活発な（コメントの多い）ストーリーが並びます。',
		'/newcomments': '新着コメント（本家 Hacker News では「comments」）＝サイト全体の最新コメントが新しい順に流れます。',
		'/bestcomments': 'ベストコメント（本家 Hacker News では「bestcomments」）＝高く評価されたコメントが並びます。',
		'/noobstories': '新規ユーザーの投稿（本家 Hacker News では「noobstories」）＝登録まもないユーザーのストーリーが並びます。',
		'/noobcomments': '新規ユーザーのコメント（本家 Hacker News では「noobcomments」）＝登録まもないユーザーのコメントが並びます。',
		'/highlights': 'ハイライト（本家 Hacker News では「highlights」）＝特に注目されたコメントを集めたページです。',
		'/polls': '投票（本家 Hacker News では「polls」）＝アンケート（poll）の一覧です。',
		'/newpoll': 'アンケート（本家 Hacker News では「poll」）を作るページです。質問のタイトルと選択肢を入力して送信します。',
		'/leaders': 'ランキング（本家 Hacker News では「leaders」）＝カルマ（karma）の高いユーザーが並びます。',
		'/lists': '一覧（本家 Hacker News では「lists」）＝さまざまな切り口の一覧ページへのリンク集です。',
		'/from': 'ドメイン別（本家 Hacker News では「from」）＝特定のドメインからの投稿だけを集めたページです。',
		'/item/[id]': 'ストーリー（投稿）の詳細ページです。本文・投票・コメント（comments）がここに集まります。',
		'/comment/[id]': 'コメントの個別ページです。このコメント1件を単独で表示しています。文脈（context）や親（parent）から前後をたどれます。',
		'/login': 'ログインと新規登録のページです。投稿・投票・コメントにはアカウントが必要です。',
		'/signup': '新規登録のページです。ユーザー名（username）とパスワード（password）を決めてアカウントを作成します。',
		'/user/[id]': 'ユーザーのプロフィールページです。カルマ（karma）や自己紹介、その人の活動をたどれます。',
		'/user/[id]/submissions': 'このユーザーの投稿（submissions）一覧です。',
		'/user/[id]/comments': 'このユーザーのコメント（comments）一覧です。',
		'/user/[id]/favorites': 'このユーザーのお気に入り（favorites）一覧です。',
		'/user/[id]/hidden': 'あなたが非表示（hidden）にしたストーリーの一覧です。自分だけが見られます。',
		'/search': '検索ページです。ストーリー（投稿）とコメントをキーワードで横断して探せます。種別メニューで All／Stories／Comments に絞り込めます。',
		'/faq': 'FAQ（よくある質問）＝ハッカーのろしと本家 Hacker News の使い方をまとめたページです。',
		'/guidelines': 'ガイドライン（本家 Hacker News では「guidelines」）＝投稿・コメントの心得をまとめたページです。',
		'/api-docs': 'API＝外部のプログラムから投稿やコメントを取得するための、公開 API の解説ページです。',
		'/noprocrast': 'noprocrast（やりすぎ防止）＝一定時間で利用を区切る、本家 Hacker News 由来の設定の説明ページです。',
		'/admin/ipban': '管理者用：IP BAN（アクセス禁止）を管理するページです。',
		'/ipban': '管理者用：IP BAN（アクセス禁止）を管理するページです。'
	},
	en: {
		'/': 'This is Hacker Noroshi — a practice ground for debuting on the real (English) Hacker News. Browse new / ask / show and try posting.',
		'/submit': 'The submit page. Enter a title and either a URL or text, then submit.',
		'/ask': 'Ask — questions and discussion for the community.',
		'/show': 'Show — a place to show tools and services you built.',
		'/showhn': 'Show HN — the list of things people built.',
		'/newest': 'New — stories listed newest first.',
		'/asknew': 'Ask (new) — the newest Ask posts, latest first.',
		'/shownew': 'Show (new) — the newest Show posts, latest first.',
		'/front': 'Front page archive — which stories were on top for a given date. Step the date with the links above.',
		'/best': 'Best — the highest-scoring stories from recently.',
		'/active': 'Active — stories with the most active discussion right now.',
		'/newcomments': 'New Comments — the latest comments across the whole site.',
		'/bestcomments': 'Best Comments — the most highly-rated comments.',
		'/noobstories': 'Noob Stories — stories from newly-registered users.',
		'/noobcomments': 'Noob Comments — comments from newly-registered users.',
		'/highlights': 'Highlights — a collection of notable comments.',
		'/polls': 'Polls — the list of polls.',
		'/newpoll': 'Create a poll. Enter a title for the question and the choices, then submit.',
		'/leaders': 'Leaders — users with the highest karma.',
		'/lists': 'Lists — links to various listing pages.',
		'/from': 'From — posts from a specific domain only.',
		'/item/[id]': 'A story (post) detail page. The body, votes, and comments all live here.',
		'/comment/[id]': "A single comment's page. Showing this one comment on its own; use context / parent to move around it.",
		'/login': 'Log in or sign up. Posting, voting, and commenting need an account.',
		'/signup': 'Sign up. Pick a username and password to create your account.',
		'/user/[id]': "A user's profile. See their karma, about, and activity.",
		'/user/[id]/submissions': "This user's submissions.",
		'/user/[id]/comments': "This user's comments.",
		'/user/[id]/favorites': "This user's favorites.",
		'/user/[id]/hidden': 'Stories you have hidden. Only you can see this.',
		'/search': 'Search page. Find stories and comments by keyword; narrow with All / Stories / Comments.',
		'/faq': 'FAQ — how to use Hacker Noroshi and the real Hacker News.',
		'/guidelines': 'Guidelines — etiquette for posts and comments.',
		'/api-docs': 'API — docs for the public API to fetch posts and comments programmatically.',
		'/noprocrast': 'noprocrast — about the HN setting that breaks up your usage after a while.',
		'/admin/ipban': 'Admin: manage IP bans (blocked addresses).',
		'/ipban': 'Admin: manage IP bans (blocked addresses).'
	}
};

/** コントロール近傍のヒント。キーは `画面.要素`。 */
const ASSIST_HINT: Record<Locale, Record<string, string>> = {
	ja: {
		'submit.title': 'タイトル。何を見せる／聞くのかを一行で。例：「◯◯という CLI を作った」。',
		'submit.url': 'リンクを共有する場合は URL を。本文で語るなら空のままで構いません。',
		'submit.text': '本文。質問や説明はこちらに。URL を空にすると本文での投稿になります。',
		'submit.submit': '押すと投稿され、その投稿ページへ移動します。',
		'newpoll.title': 'アンケートのタイトル。何を聞きたいかを一行で。例：「好きなエディタは？」。',
		'newpoll.text': '補足の本文（任意）。質問の背景や前提があれば書いておきましょう。',
		'newpoll.options': '選択肢。1行に1つずつ書きます。空行は無視されます。例：Vim / Emacs / VS Code。',
		'newpoll.submit': '押すとアンケートが投稿され、その投稿ページへ移動します。',
		'login.username': 'ユーザー名。既にアカウントがある人はここに入力します。',
		'login.password': 'パスワード。登録時に決めたものを入力します。',
		'login.submit': '押すとログインします。',
		'signup.username': '新しいユーザー名。これから登録する人はここで好きな名前を決めます。',
		'signup.password': '新しいパスワード。忘れないものを設定しましょう。',
		'signup.submit': '押すとアカウントが作られ、ログインした状態になります。',
		// 一覧の描画先頭可視行に1回だけ出す行コントロールの解説（StoryList が firstVisibleId の行に assistFirst を渡す）。
		// 画面の和名ラベル（非表示/通報）に「和名（英語）」で併記し、UI の語とアシストの語を一致させる（#170）。
		'story.controls':
			'各行の左の ▲ は upvote（投票）。良いと思った投稿を押し上げます。本家 Hacker News と同じく、ストーリーに downvote（反対票）はありません（コメントの downvote はカルマ 500 以上で解禁）。点数の下にある 非表示（hide）＝自分の一覧から消す、通報（flag）＝規約違反を運営に知らせる、コメント数のリンクで議論に入れます。',
		// /item のストーリー操作行の直下に1回。
		'item.controls':
			'この投稿への操作です。お気に入り（favorite）＝お気に入り登録（自分のページの favorites に並びます）、非表示（hide）＝一覧から隠す、通報（flag）＝規約違反を運営に知らせる。自分の投稿なら 編集（edit）／削除（delete）も出ますが、編集できるのは投稿から2時間だけ（本家 HN の編集窓と同じ作法）。下のコメントは [–] で畳め、返信（reply）で返信できます。',
		// 右下ドック（ⓘ＋アシストスイッチ）の真上に右寄せで1回（#170 で最上部から移設）。メタ操作（言語・
		// アシスト本体）への気づき。カルマは meta.karma に分離し、ログイン中（= 実際に (123) が見える）ときだけ
		// layout が後段に足す。
		'meta.controls':
			'下に並ぶ ⓘ ボタンと「アシスト」スイッチの説明です。「アシスト」スイッチがこの操作補助の本体で、オフにすると解説が消え、本家 Hacker News と同じ素の画面に戻ります。慣れたらオフにして、本家へデビューしましょう。ⓘ はこのサイトの目的（HN の練習場）の説明へ飛びます。表示言語は右上の言語リンク（English／日本語）で切り替えられます。',
		'meta.karma': 'また、ログイン中はヘッダのあなたの名前の右の数字 (123) がカルマ（karma＝評価点）です。'
	},
	en: {
		'submit.title': 'Title. One line describing what you made or ask. e.g. "I built a CLI called X".',
		'submit.url': 'Add a URL if you are sharing a link. Leave it empty to post text instead.',
		'submit.text': 'Body. Put your question or explanation here. Empty URL means a text post.',
		'submit.submit': 'Posts your submission and takes you to its page.',
		'newpoll.title': 'Poll title. One line for what you want to ask. e.g. "What is your favorite editor?".',
		'newpoll.text': 'Optional body. Add any context or background for the question.',
		'newpoll.options': 'Choices. One per line; empty lines are ignored. e.g. Vim / Emacs / VS Code.',
		'newpoll.submit': 'Posts the poll and takes you to its page.',
		'login.username': 'Username. If you already have an account, enter it here.',
		'login.password': 'Password. Enter the one you set when you registered.',
		'login.submit': 'Logs you in.',
		'signup.username': 'New username. If you are registering, pick any name you like here.',
		'signup.password': 'New password. Choose one you will not forget.',
		'signup.submit': 'Creates your account and logs you in.',
		'story.controls':
			'The ▲ on the left of each row is upvote — push up posts you like. As on the real Hacker News, there is no downvote on stories (downvoting comments unlocks at 500 karma). Below the score, hide removes it from your list, flag reports rule-breaking, and the comments link opens the discussion.',
		'item.controls':
			'Actions for this post. favorite bookmarks it (it appears under favorites on your profile), hide removes it from your list, flag reports it. If it is your own post, edit / delete also appear — but you can only edit within 2 hours of posting (the same edit-window convention as the real HN). Below, collapse comments with [–] and reply to join in.',
		'meta.controls':
			'Just below sit a round ⓘ button and a switch labeled "Assist". The "Assist" switch is this assist itself — turn it off and the guides disappear, leaving the plain screen identical to the real Hacker News. Once you are comfortable, switch it off and graduate to the real thing. The ⓘ opens an explanation of what this site is for. Use the language link at the top-right (English / 日本語) to switch the display language.',
		'meta.karma': 'Also, when you are logged in, the number (123) next to your name in the header is your karma (reputation).'
	}
};

/** 画面の解説（無ければ空文字）。引数は `page.route.id`（例: `/`, `/item/[id]`, `/user/[id]`）。 */
export function assistIntro(routeId: string | null | undefined, locale: Locale): string {
	if (!routeId) return '';
	return ASSIST_INTRO[locale][routeId] ?? '';
}

/** コントロールのヒント（無ければ空文字）。 */
export function assistHint(key: string, locale: Locale): string {
	return ASSIST_HINT[locale][key] ?? '';
}

/** 右下スイッチのラベル。 */
export function assistSwitchLabel(locale: Locale): string {
	return locale === 'ja' ? 'アシスト' : 'Assist';
}

/** 右下「このサイトの目的」リンクのラベル（ツールチップ/aria）。 */
export function assistAboutLabel(locale: Locale): string {
	return locale === 'ja'
		? 'このサイトはなに？ — ハッカーのろしの目的'
		: 'What is Hacker Noroshi? — why it exists';
}

/** 「このサイトの目的」記事（llll-ll）の URL。ロケール別。 */
export function assistAboutUrl(locale: Locale): string {
	return locale === 'ja'
		? 'https://llll-ll.com/ja/posts/hacker-noroshi/'
		: 'https://llll-ll.com/posts/hacker-noroshi/';
}
