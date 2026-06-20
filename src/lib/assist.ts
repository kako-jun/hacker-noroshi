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
		'/': 'ここは「ハッカーのろし」。本家 Hacker News（英語）でデビューするための練習場です。作者の kako-jun もハッカーで、ここを実際に使っています。新着（new）・質問（Ask）・作ったもの（Show）を眺めて、気軽に投稿してみましょう。',
		'/submit':
			'投稿ページです。タイトルと、リンク（URL）か本文のどちらかを入れて送信します。種別＝通常投稿（story）／質問（Ask）／作ったもの（Show）を下のメニューで選べます——本家 HN の「Ask HN:」「Show HN:」という作法を知らなくても、ここで身につきます。',
		'/ask': '質問（本家 Hacker News では「Ask」）＝コミュニティへの質問・相談が集まる場所です。本家では投稿タイトルを「Ask HN:」で始めます。技術でも運営でも、気軽に聞いてみましょう。',
		'/show': '作ったもの（本家 Hacker News では「Show」「Show HN:」）＝自作のツールやサービスを見せる場所です。本家デビューの型なので、ここで披露して感想をもらいましょう。',
		'/newest': '新着（本家 Hacker News では「new」）＝投稿されたばかりのストーリーが新しい順に並びます。まだ票が少ないものを見つけて、面白ければ投票してあげましょう。',
		'/front': '過去（本家 Hacker News では「past」）＝指定した日付に上位だったストーリーを振り返れます。上のリンクで日付を前後に移動できます。',
		'/newcomments': '新着コメント（本家 Hacker News では「comments」）＝サイト全体の最新コメントが流れてきます。今どんな話題で盛り上がっているかを掴むのに便利です。',
		'/item/[id]': 'ストーリー（投稿）の詳細ページです。本文・投票・コメント（comments）がここに集まります。返信を書いたり、ツリーを `[–]` で畳んだりできます。',
		'/newpoll':
			'アンケート（本家 Hacker News では「poll」）を作るページです。質問のタイトルと、選択肢を1行に1つずつ書いて送信します。投稿後はみんなが選択肢に投票できます。',
		'/login':
			'ログインと新規登録のページです。投稿・投票・コメントにはアカウントが必要——上でログイン、まだの人は下からユーザー名とパスワードを決めて登録できます。',
		'/user/[id]':
			'ユーザーのプロフィールページです。カルマ（karma）＝自分の投稿やコメントが ▲ で投票されて貯まる評価点で、増えると downvote などの操作が解禁されます。created＝登録日、about＝自己紹介。下の submissions／comments／favorites からその人の活動をたどれます。本家 Hacker News でも見方は同じです。',
		'/search':
			'検索ページです。キーワードでストーリー（投稿）とコメントを横断して探せます。種別メニューで All／Stories（投稿だけ）／Comments（コメントだけ）に絞り込めます。下のフッタの検索ボックスからもいつでも来られます——本家 Hacker News も同じ場所に検索があります。'
	},
	en: {
		'/': 'This is Hacker Noroshi — a place to practice the Hacker News style: show what you built, ask questions, discuss. The author kako-jun is a hacker and actually uses this place. Browse new / ask / show and try posting.',
		'/submit':
			'The submit page. Enter a title and either a URL or text. Choose the type (Story / Ask / Show) from the menu below — you do not need to know HN conventions like "Show HN:".',
		'/ask': 'Ask — questions and discussion for the community. Tech, running things, anything: feel free to ask.',
		'/show': 'Show — a place to show tools and services you built. Share what you made and get feedback.',
		'/newest': 'New — stories listed newest first. Find ones with few votes yet and upvote what you like.',
		'/front': "Front page archive — see which stories were on top for a given date. Use the links above to step the date back and forth.",
		'/newcomments': 'New Comments — the latest comments across the whole site. A quick way to see what people are talking about now.',
		'/item/[id]': 'A story (post) detail page. The body, votes, and comments all live here. You can reply, and collapse threads with `[–]`.',
		'/newpoll':
			'Create a poll. Enter a title for the question and put one choice per line, then submit. After posting, anyone can vote on the choices.',
		'/login':
			'Log in or sign up. Posting, voting, and commenting need an account — log in above, or if you are new, pick a username and password below to register.',
		'/user/[id]':
			"A user's profile. karma is the score you earn when your posts and comments get upvoted (▲); as it grows, abilities like downvoting unlock. created is the join date, about is a self-introduction. The submissions / comments / favorites links below browse that person's activity — it works the same on the real Hacker News.",
		'/search':
			'Search page. Find stories (posts) and comments by keyword. Use the type menu to narrow to All / Stories / Comments. You can also reach it anytime from the search box in the footer — the real Hacker News has search in the same place.'
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
		'story.controls':
			'各行の左の ▲ は upvote（投票）。良いと思った投稿を押し上げます。本家 Hacker News と同じく、ストーリーに downvote はありません（コメントの downvote はカルマ 500 以上で解禁）。点数の下にある hide＝自分の一覧から消す、flag＝規約違反の通報、コメント数のリンクで議論に入れます。',
		// /item のストーリー操作行の直下に1回。
		'item.controls':
			'この投稿への操作です。favorite＝お気に入り登録（自分のページの favorites に並びます）、hide＝一覧から隠す、flag＝通報。自分の投稿なら edit／delete も出ますが、編集できるのは投稿から2時間だけ（本家 HN の編集窓と同じ作法）。下のコメントは [–] で畳め、reply で返信できます。',
		// ヘッダ直下に1回。メタ操作（言語・アシスト本体）への気づき。カルマは meta.karma に分離し、
		// ログイン中（= 実際に (123) が見える）ときだけ layout が後段に足す。
		'meta.controls':
			'右上の lang で日本語／英語を切り替えられます。右下には丸い ⓘ ボタンと「アシスト」と書かれたスイッチが並んでいます——ⓘ はこのサイトの目的（HN の練習場）の説明へ、「アシスト」スイッチがこのアシスト本体です。スイッチをオフにすると解説が消え、本家 Hacker News と同じ素の画面になります。慣れたらオフにして、本家へデビューしましょう。',
		'meta.karma': 'また、ログイン中はヘッダの自分の名前の右の数字 (123) がカルマ（karma＝評価点）です。'
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
			'Use lang at the top-right to switch Japanese / English. At the bottom-right sit a round ⓘ button and a switch labeled "Assist": the ⓘ opens an explanation of what this site is for (a practice ground for HN), and the "Assist" switch is this assist itself — turn it off and the guides disappear, leaving the plain screen identical to the real Hacker News. Once you are comfortable, switch it off and graduate to the real thing.',
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
