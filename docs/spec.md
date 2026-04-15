# ハッカーのろし — 仕様書

## 概要

日本の技術者向けリンク共有・議論サイト。Hacker News クローン。
略称 **HN**（Hacker Newsと同じイニシャル、意図的）。

URL: https://hn.llll-ll.com

## 機能仕様

### 投稿

- URL リンク投稿またはテキスト投稿（排他）
- タイトル最大80文字
- タイトルが「Ask HN:」で始まる → type=ask
- タイトルが「Show HN:」で始まる → type=show
- それ以外 → type=story
- 投稿には要ログイン

### コメント

- ネストスレッド（40px/段のインデント）
- トップレベルコメントまたは既存コメントへの返信
- テキストフォーマット: URL自動リンク（`rel="nofollow noreferrer"`）、`*text*` でイタリック
- パーマリンク: `/item/{comment_id}` でコメント単体 + 子スレッドを表示
- parent リンク（親コメント or 親ストーリーへ）、on: リンク（親ストーリーへ）
- タイムスタンプがパーマリンクリンクを兼ねる

### 投票

- ストーリー: upvote のみ
- コメント: upvote + downvote
- トグル式（再クリックで取り消し、逆方向クリックで切替）
- 重複投票は PK 制約で防止

#### downvote（コメント専用）

- karma 500 以上のユーザーのみ downvote 可能
- ストーリーへの downvote は不可
- 自分のコメントへの直接返信には downvote 不可
- downvote されたコメント（points < 1）はテキストがフェード表示（薄い色）
- downvote 済みの ▼ はオレンジ色で表示

### ランキングアルゴリズム

HN 準拠:

```
score = (points - 1) / (hours_since_post + 2) ^ 1.8
```

- `points - 1`: 投稿者の自動 upvote を除外
- `hours_since_post`: 投稿からの経過時間
- `1.8`: gravity（減衰定数）

### 認証

1. サインアップ: username + password → bcrypt ハッシュ化して DB 保存
2. ログイン: username + password → 照合 → セッショントークン発行 → Cookie 設定
3. セッション: SvelteKit の hooks.server.ts で毎リクエスト検証
4. ログアウト: セッション削除 + Cookie 破棄

ログインとサインアップは同一ページ（/login）に統合（本家HN準拠）。/signup は /login にリダイレクト。

ユーザー名: 3-15文字、英数字+アンダースコア+ハイフン
新規ユーザー表示: アカウント作成から14日以内のユーザー名を緑色（#3c963c）で表示

### ユーザー設定

プロフィールページ（`/user/[id]`）で本人のみ編集可能。テーブルレイアウトのインラインフォーム（本家HN準拠）。

| 設定 | 型 | デフォルト | 説明 |
|---|---|---|---|
| about | TEXT | '' | 自己紹介 |
| email | TEXT | '' | パスワードリセット用（任意、本人のみ表示） |
| showdead | yes/no | no | dead 状態の投稿・コメントを表示（モデレーション実装後に有効） |
| noprocrast | yes/no | no | アクセス制限を有効にする |
| maxvisit | INTEGER | 20 | noprocrast: 連続アクセス可能時間（分） |
| minaway | INTEGER | 180 | noprocrast: 必要な離脱時間（分） |
| delay | INTEGER | 0 | 自分のコメントが他者に表示されるまでの遅延（0-10分） |

#### noprocrast

1. 有効時、最初のアクセスで `last_visit` を記録
2. `last_visit` から `maxvisit` 分以内 → 通常アクセス
3. `maxvisit` 分超過 → `/noprocrast` ページにリダイレクト
4. `maxvisit + minaway` 分経過 → `last_visit` リセット、通常アクセス再開

#### delay（コメント遅延）

- コメント投稿者の `delay` 設定に基づき、`created_at + delay分` が現在時刻より未来のコメントは投稿者本人以外に非表示
- サーバーサイドフィルタ（`getCommentsByStoryId`, `getRecentComments`, `getCommentsByUserId` で適用）

### 編集機能

- プロフィール: ログイン中の本人が about + 設定フィールドを編集可能
- 投稿: 投稿から2時間以内、本人のみ title と text を編集可能
- コメント: 投稿から2時間以内、本人のみ text を編集可能
- ストーリー編集時は type を再判定（Ask HN: / Show HN: プレフィックス）

### 静的ページ

- `/guidelines` — 投稿・コメントのガイドライン
- `/faq` — よくある質問
- `/showhn` — Show HN 専用ルール

## v1 スコープ

- [x] 投稿の作成・表示・一覧
- [x] コメント（ネスト）
- [x] 投票（upvote のみ）
- [x] ユーザー登録・ログイン
- [x] ランキング + 新着
- [x] Ask / Show カテゴリ
- [x] ページネーション
- [x] プロフィール編集
- [x] 投稿・コメント編集（2時間以内）
- [x] ガイドライン・FAQ・Show HN ルールページ
- [x] ユーザーの submissions / comments 一覧ページ
- [x] コメントパーマリンク（/item/{comment_id}）
- [x] テキストフォーマット（URL自動リンク、*イタリック*）
- [x] 新規アカウントの緑色ユーザー名（作成14日以内）
- [x] 追加ブラウズページ（/newcomments, /best）
- [x] ログイン+サインアップ1ページ統合（本家HN準拠）
- [x] ヘッダーナビに comments リンク追加
- [x] /front ページ（日付別フロントページ）+ ヘッダーナビに past リンク追加
- [x] フッター構成を本家HNに合わせる + /lists ページ追加
- [x] RSS フィード（/rss）追加
- [x] /active ページ追加（アクティブな議論一覧）
- [x] APIドキュメントページ追加（/api-docs、フッターからリンク）
- [x] favorites 機能（favorite/un-fav トグル + /user/[id]/favorites 一覧）
- [x] hide 機能（ストーリー非表示 + /user/[id]/hidden 一覧 + 一覧からの除外）
- [x] downvote 機能（コメント専用、karma 500 閾値、フェード表示）
- [x] ユーザー設定（email, showdead, noprocrast, delay）
- [x] noprocrast アクセス制限（/noprocrast ブロックページ）
- [x] コメント delay フィルタ（サーバーサイド）

## v2 以降

- 検索
- フラグ / モデレーション
- パスワードリセット（email 利用）
- API 公開
- 招待制 / カルマ制限
- ダークモード
- ~~favorites 機能~~ → v1 で実装済み
