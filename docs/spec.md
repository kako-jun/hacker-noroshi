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
- レート制限: 同一ユーザーの連続投稿は10分間隔が必要。違反時は "You're submitting too fast. Please slow down." を表示

### コメント

- ネストスレッド（40px/段のインデント）
- トップレベルコメントまたは既存コメントへの返信
- テキストフォーマット: URL自動リンク（`rel="nofollow noreferrer"`）、`*text*` でイタリック
- パーマリンク: `/item/{comment_id}` でコメント単体 + 子スレッドを表示
- parent リンク（親コメント or 親ストーリーへ）、on: リンク（親ストーリーへ）
- タイムスタンプがパーマリンクリンクを兼ねる
- スレッドクローズ: 投稿から14日経過したストーリーは新規コメント不可。フォームとreplyリンクを非表示（メッセージなし）。サーバーサイドでもバリデーション
- レート制限: 同一ユーザーの連続コメントは2分間隔が必要。違反時は "You're posting too fast. Please slow down." を表示

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

#### パスワードリセット

- `/forgot` ページ: ユーザー名 + 登録メールアドレスで本人確認
- メール送信は行わない。username + email の照合が通れば即座に新パスワードを設定可能
- email 未登録のアカウントはリセット不可
- ユーザー名の存在有無は曖昧にする（「Bad login.」で統一）
- `/login` ページに "Forgot your password?" リンクあり

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

### 検索

- `/search` ページで検索フォーム + 結果表示
- 検索対象: ストーリー（タイトル・URL・テキスト）、コメント（テキスト）
- タイプフィルタ: all（両方）/ stories / comments
- LIKE 検索（`%` `_` `\` はエスケープ）、ページネーション
- フッターに Search リンク + テキスト入力欄

### 編集機能

- プロフィール: ログイン中の本人が about + 設定フィールドを編集可能
- 投稿: 投稿から2時間以内、本人のみ title と text を編集可能
- コメント: 投稿から2時間以内、本人のみ text を編集可能
- ストーリー編集時は type を再判定（Ask HN: / Show HN: プレフィックス）

### フラグ・モデレーション

- ログイン中、karma 30 以上のユーザーは他人の投稿/コメントに **flag** を付けられる
- フラグはトグル式（再度クリックで un-flag）
- 自分の投稿/コメントには flag 不可
- フラグ数が **5 件以上**（>4）になるとアイテムは `dead = 1` に自動マーク
- dead アイテムは通常の listing から除外される（`WHERE dead = 0`）
- `showdead = 1` のユーザーは dead アイテムも表示される（薄表示 / `[dead]` タグ付き）
- フラグ済みアイテム（flag_count > 0）には `[flagged]` タグが表示される
- コメントの flag リンクは **コメント単体ページ（/item/{comment_id}）の対象コメントのみ**で表示（本家 HN 準拠）

### Vouch（復活）

- karma 30 以上のユーザーは dead アイテムに対して **vouch** を付けられる
- vouch は dead=1 のアイテムにのみ可能
- vouch 成功時: `dead = 0` に戻し、関連する flags レコードを **全削除**（再炎上防止）
- 自分の投稿/コメントには vouch 不可
- vouch リンクは /item/{id} の単体ページでのみ表示

### ランキング降格（flag による score ペナルティ）

通常のランキングスコアにフラグ数のペナルティを掛ける:

```
score = ((points - 1) / (hours_since_post + 2)^1.8) / (flag_count + 1)^1.5
```

- フラグ 1 件で score は約 36% に、フラグ 4 件で約 9% に低下
- dead 化される前の段階でも、フラグが集まったストーリーは自然にランキングから降格していく

### 削除機能

- 投稿・コメントから 2 時間以内、本人のみ削除可能（編集ウィンドウと同条件）
- 物理削除ではなく **論理削除**: テキストを `[deleted]` に置換するのみ
  - 投稿: `title`、`url`、`text` を `[deleted]` に置換（url は NULL）
  - コメント: `text` を `[deleted]` に置換
- `[deleted]` は `dead`（モデレーション）とは別概念。`showdead` 設定の影響を受けず、常に `[deleted]` のまま表示される
- フロントエンドでは確認ダイアログ（`confirm()`）を挟む

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
- [x] 投稿・コメント削除（2時間以内、`[deleted]` 置換）
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
- [x] 検索機能（/search、ストーリー+コメントの LIKE 検索、フッター検索欄）
- [x] スレッドクローズ（投稿から14日経過でコメント不可）
- [x] レート制限（投稿10分間隔、コメント2分間隔）
- [x] パスワードリセット（username + email 照合で即時リセット、メール送信なし）
- [x] フラグ・モデレーション（karma>=30 でフラグ可能、5件で dead 自動化、vouch で復活）
- [x] ランキング降格（flag 数で score にペナルティ）

## v2 以降
- ~~フラグ / モデレーション~~ → v1 で実装済み（flag/vouch、dead カラム、ランキング降格）
- ~~パスワードリセット（email 利用）~~ → v1 で実装済み（メール送信なし方式）
- API 公開
- 招待制 / カルマ制限
- ダークモード
- ~~favorites 機能~~ → v1 で実装済み
