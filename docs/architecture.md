# ハッカーのろし — アーキテクチャ

## 技術スタック

| 層 | 技術 |
|---|---|
| フレームワーク | SvelteKit (Svelte 5) |
| デプロイ | Cloudflare Pages + Workers |
| DB | Cloudflare D1 (SQLite) |
| 認証 | 自前（bcrypt + セッション Cookie） |
| スタイル | 素の CSS（フレームワーク不使用） |

## ディレクトリ構成

```
hacker-noroshi/
├── src/
│   ├── routes/           # SvelteKit ルート
│   │   ├── +layout.svelte    # 共通レイアウト（ヘッダー・フッター）
│   │   ├── +page.svelte      # トップページ（ランキング）
│   │   ├── newest/           # 新着順
│   │   ├── front/            # 日付別フロントページ
│   │   ├── ask/              # Ask HN
│   │   ├── show/             # Show HN
│   │   ├── newcomments/      # 全ストーリーの最新コメント一覧
│   │   ├── best/             # 高スコアのストーリー一覧
│   │   ├── active/           # アクティブな議論一覧
│   │   ├── lists/            # ブラウズリンク集
│   │   ├── api-docs/         # APIドキュメント
│   │   ├── rss/              # RSS 2.0 フィード
│   │   ├── item/[id]/        # 投稿詳細 or コメントパーマリンク + コメント + 編集
│   │   ├── user/[id]/        # プロフィール + 編集
│   │   │   ├── submissions/  # ユーザーの投稿一覧
│   │   │   ├── comments/     # ユーザーのコメント一覧
│   │   │   ├── favorites/    # ユーザーのお気に入り一覧
│   │   │   └── hidden/       # 非表示ストーリー一覧（本人のみ）
│   │   ├── submit/           # 投稿フォーム
│   │   ├── login/            # ログイン + サインアップ（1ページ統合）
│   │   ├── signup/           # /login へリダイレクト
│   │   ├── logout/           # ログアウト
│   │   ├── guidelines/       # ガイドライン
│   │   ├── faq/              # FAQ
│   │   ├── showhn/           # Show HN ルール
│   │   └── api/
│   │       ├── vote/         # 投票 API
│   │       ├── favorite/     # お気に入り API
│   │       └── hide/         # 非表示 API
│   ├── lib/
│   │   ├── server/
│   │   │   ├── db.ts         # D1 データアクセス関数
│   │   │   └── auth.ts       # パスワードハッシュ・セッション管理
│   │   ├── format.ts         # テキストフォーマット（URL自動リンク、*イタリック*）
│   │   └── ranking.ts        # timeAgo, extractDomain 等のユーティリティ
│   ├── app.css               # グローバル CSS
│   └── app.html              # HTML テンプレート
├── db/
│   ├── schema.sql            # テーブル定義
│   └── seed.sql              # テストデータ
├── docs/
│   ├── spec.md               # 仕様書
│   ├── design.md             # デザインシステム
│   ├── architecture.md       # 本ファイル
│   └── operations.md         # デプロイ・運用手順
├── CLAUDE.md                 # AI 向け指示
└── README.md                 # プロジェクト説明
```

## データモデル

### users

| カラム | 型 | 備考 |
|---|---|---|
| id | INTEGER PK | autoincrement |
| username | TEXT UNIQUE | 3-15文字、英数字+アンダースコア+ハイフン |
| password_hash | TEXT | bcrypt |
| karma | INTEGER | デフォルト 0 |
| about | TEXT | 自己紹介（任意） |
| created_at | TEXT | ISO8601 |

### stories

| カラム | 型 | 備考 |
|---|---|---|
| id | INTEGER PK | autoincrement |
| title | TEXT | 最大80文字 |
| url | TEXT | 外部リンク（任意） |
| text | TEXT | テキスト投稿の場合（url と排他） |
| user_id | INTEGER FK | 投稿者 |
| points | INTEGER | デフォルト 1 |
| comment_count | INTEGER | デフォルト 0 |
| type | TEXT | 'story', 'ask', 'show' |
| created_at | TEXT | ISO8601 |

### comments

| カラム | 型 | 備考 |
|---|---|---|
| id | INTEGER PK | autoincrement |
| text | TEXT | プレーンテキスト |
| user_id | INTEGER FK | 投稿者 |
| story_id | INTEGER FK | 所属する投稿 |
| parent_id | INTEGER FK | 親コメント（NULL ならトップレベル） |
| points | INTEGER | デフォルト 1 |
| created_at | TEXT | ISO8601 |

### votes

| カラム | 型 | 備考 |
|---|---|---|
| user_id | INTEGER FK | |
| item_id | INTEGER | story or comment の id |
| item_type | TEXT | 'story' or 'comment' |
| created_at | TEXT | ISO8601 |
| PRIMARY KEY | (user_id, item_id, item_type) | 重複投票防止 |

### sessions

| カラム | 型 | 備考 |
|---|---|---|
| id | TEXT PK | ランダムトークン |
| user_id | INTEGER FK | |
| expires_at | TEXT | ISO8601 |

### favorites

| カラム | 型 | 備考 |
|---|---|---|
| user_id | INTEGER FK | PK (複合) |
| story_id | INTEGER FK | PK (複合) |
| created_at | TEXT | ISO8601 |

### hidden

| カラム | 型 | 備考 |
|---|---|---|
| user_id | INTEGER FK | PK (複合) |
| story_id | INTEGER FK | PK (複合) |
| created_at | TEXT | ISO8601 |

## ルート一覧

| パス | 説明 |
|---|---|
| `/` | トップページ（ランキング順、30件/ページ） |
| `/newest` | 新着順 |
| `/front` | 日付別フロントページ（?day=YYYY-MM-DD、デフォルト昨日） |
| `/ask` | Ask HN（type='ask' のみ） |
| `/show` | Show HN（type='show' のみ） |
| `/newcomments` | 全ストーリーの最新コメント一覧 |
| `/best` | 高スコアのストーリー一覧 |
| `/active` | アクティブな議論一覧（最新コメント時刻順） |
| `/lists` | ブラウズリンク集（front, newcomments, best, active, show, ask） |
| `/item/[id]` | 投稿詳細 or コメントパーマリンク + コメントスレッド + 編集 |
| `/user/[id]` | ユーザープロフィール + 編集 |
| `/user/[id]/submissions` | ユーザーの投稿一覧 |
| `/user/[id]/comments` | ユーザーのコメント一覧 |
| `/user/[id]/favorites` | ユーザーのお気に入り一覧 |
| `/user/[id]/hidden` | 非表示ストーリー一覧（本人のみ） |
| `/submit` | 投稿フォーム（要ログイン） |
| `/login` | ログイン + サインアップ（本家HN準拠で1ページ統合） |
| `/signup` | /login へリダイレクト（既存リンク互換） |
| `/logout` | ログアウト（リダイレクト） |
| `/guidelines` | ガイドライン |
| `/faq` | FAQ |
| `/showhn` | Show HN ルール |
| `/api-docs` | APIドキュメント（準備中） |
| `/rss` | RSS 2.0 フィード（トップページのストーリー30件） |
| `/api/vote` | 投票 API エンドポイント |
| `/api/favorite` | お気に入り API エンドポイント |
| `/api/hide` | 非表示 API エンドポイント |

## DB アクセス関数 (src/lib/server/db.ts)

| 関数 | 用途 |
|---|---|
| `getDB()` | D1 バインディング取得 |
| `getStories()` | ストーリー一覧（ランキング or 新着、type フィルタ、ページネーション） |
| `getFrontPageStories()` | 日付別フロントページ（日付範囲でフィルタ、HNランクスコアでソート） |
| `getStoryById()` | ストーリー1件取得 |
| `getCommentsByStoryId()` | コメント一覧（ストーリーID指定） |
| `getCommentById()` | コメント1件取得（編集時の権限チェック・パーマリンク用） |
| `getChildComments()` | 特定コメントの子孫コメントを取得（パーマリンク用） |
| `getUserByUsername()` | ユーザー取得（ユーザー名） |
| `getUserById()` | ユーザー取得（ID） |
| `getStoriesByUserId()` | ユーザーの投稿一覧 |
| `getCommentsByUserId()` | ユーザーのコメント一覧（story_title 付き） |
| `getActiveStories()` | アクティブな議論（最新コメント時刻順にストーリーをソート） |
| `getRecentComments()` | 全ストーリーの最新コメント一覧（/newcomments 用） |
| `hasVoted()` | 投票済みチェック |
| `getVotedStoryIds()` | 投票済みストーリーID一括取得 |
| `getVotedCommentIds()` | 投票済みコメントID一括取得 |
| `hasFavorited()` | お気に入り済みチェック |
| `getFavoriteStoryIds()` | お気に入り済みストーリーID一括取得 |
| `getFavoriteStoriesByUserId()` | ユーザーのお気に入りストーリー一覧 |
| `hasHidden()` | 非表示済みチェック |
| `getHiddenStoryIds()` | ユーザーの全非表示ストーリーID取得 |
| `getHiddenStoriesByUserId()` | ユーザーの非表示ストーリー一覧 |
