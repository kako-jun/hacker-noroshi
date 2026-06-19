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

/** 画面ごとの「この画面は何か」解説。キーは route の pathname。 */
const ASSIST_INTRO: Record<Locale, Record<string, string>> = {
	ja: {
		'/': 'ここは「ハッカーのろし」。Hacker News の雰囲気で、作ったものを見せたり質問したりする練習の場です。作者の kako-jun もハッカーで、ここを実際に使っています。新着・Ask・作ったもの を眺めて、気軽に投稿してみましょう。',
		'/submit':
			'投稿ページです。タイトルと、リンク（URL）か本文のどちらかを入れて送信します。種別（通常投稿 / 質問 / 作ったもの）は下のメニューで選べます——HN の「Show HN:」などの作法を知らなくても大丈夫。',
		'/ask': 'Ask＝コミュニティへの質問・相談が集まる場所です。技術や運営、何でも気軽に聞いてみましょう。',
		'/show': 'Show（作ったもの）＝自作のツールやサービスを見せる場所です。作ったものを披露して、感想や意見をもらいましょう。',
		'/newest': '新着＝投稿されたばかりのストーリーが新しい順に並びます。まだ票が少ないものを見つけて、面白ければ投票してあげましょう。',
		'/front': '過去のトップページ＝指定した日付に上位だったストーリーを振り返れます。上のリンクで日付を前後に移動できます。',
		'/newcomments': '新着コメント＝サイト全体の最新コメントが流れてきます。今どんな話題で盛り上がっているかを掴むのに便利です。',
		'/item': 'ストーリー（投稿）の詳細ページです。本文・投票・コメントがここに集まります。返信を書いたり、ツリーを `[–]` で畳んだりできます。',
		'/newpoll':
			'アンケート（poll）を作るページです。質問のタイトルと、選択肢を1行に1つずつ書いて送信します。投稿後はみんなが選択肢に投票できます。',
		'/login':
			'ログインと新規登録のページです。投稿・投票・コメントにはアカウントが必要——上でログイン、まだの人は下からユーザー名とパスワードを決めて登録できます。'
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
		'/item': 'A story (post) detail page. The body, votes, and comments all live here. You can reply, and collapse threads with `[–]`.',
		'/newpoll':
			'Create a poll. Enter a title for the question and put one choice per line, then submit. After posting, anyone can vote on the choices.',
		'/login':
			'Log in or sign up. Posting, voting, and commenting need an account — log in above, or if you are new, pick a username and password below to register.'
	}
};

/** コントロール近傍のヒント。キーは `画面.要素`。 */
const ASSIST_HINT: Record<Locale, Record<string, string>> = {
	ja: {
		'submit.title': 'タイトル。何を見せる／聞くのかを一行で。例：「◯◯という CLI を作った」。',
		'submit.storyType':
			'種別。「作ったもの」＝自作の紹介（Show）、「質問」＝相談（Ask）、「通常投稿」＝リンク共有。選ぶだけで OK。',
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
		'signup.submit': '押すとアカウントが作られ、ログインした状態になります。'
	},
	en: {
		'submit.title': 'Title. One line describing what you made or ask. e.g. "I built a CLI called X".',
		'submit.storyType':
			'Type. "Show" = introduce what you built, "Ask" = ask the community, "Story" = share a link. Just pick one.',
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
		'signup.submit': 'Creates your account and logs you in.'
	}
};

/** 画面の解説（無ければ空文字）。 */
export function assistIntro(pathname: string, locale: Locale): string {
	return ASSIST_INTRO[locale][pathname] ?? '';
}

/** コントロールのヒント（無ければ空文字）。 */
export function assistHint(key: string, locale: Locale): string {
	return ASSIST_HINT[locale][key] ?? '';
}

/** 右下スイッチのラベル。 */
export function assistSwitchLabel(locale: Locale): string {
	return locale === 'ja' ? 'アシスト' : 'Assist';
}
