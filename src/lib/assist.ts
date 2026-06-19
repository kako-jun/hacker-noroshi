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
		'/ask': 'Ask＝コミュニティへの質問・相談が集まる場所です。',
		'/show': 'Show（作ったもの）＝自作のツールやサービスを見せる場所です。'
	},
	en: {
		'/': 'This is Hacker Noroshi — a place to practice the Hacker News style: show what you built, ask questions, discuss. The author kako-jun is a hacker and actually uses this place. Browse new / ask / show and try posting.',
		'/submit':
			'The submit page. Enter a title and either a URL or text. Choose the type (Story / Ask / Show) from the menu below — you do not need to know HN conventions like "Show HN:".',
		'/ask': 'Ask — questions and discussion for the community.',
		'/show': 'Show — a place to show tools and services you built.'
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
		'submit.submit': '押すと投稿され、その投稿ページへ移動します。'
	},
	en: {
		'submit.title': 'Title. One line describing what you made or ask. e.g. "I built a CLI called X".',
		'submit.storyType':
			'Type. "Show" = introduce what you built, "Ask" = ask the community, "Story" = share a link. Just pick one.',
		'submit.url': 'Add a URL if you are sharing a link. Leave it empty to post text instead.',
		'submit.text': 'Body. Put your question or explanation here. Empty URL means a text post.',
		'submit.submit': 'Posts your submission and takes you to its page.'
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
