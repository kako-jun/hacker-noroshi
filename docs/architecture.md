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
│   │   ├── noprocrast/       # noprocrast ブロックページ
│   │   ├── search/           # 検索（ストーリー+コメント）
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
│   │       ├── hide/         # 非表示 API
│   │       ├── flag/         # フラグ API（karma>=30、5件で dead）
│   │       └── vouch/        # Vouch API（dead 復活、flags 削除）
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
│   ├── architecture.md       # 本ファイル
│   └── operations.md         # デプロイ・運用手順
├── CLAUDE.md                 # AI 向け指示
├── DESIGN.md                 # デザインシステム（色・フォント・レイアウト規則）
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
| email | TEXT | パスワードリセット用（任意） |
| delay | INTEGER | コメント遅延（0-10分、デフォルト 0） |
| noprocrast | INTEGER | アクセス制限（0=OFF, 1=ON） |
| maxvisit | INTEGER | 連続アクセス可能時間（分、デフォルト 20） |
| minaway | INTEGER | 必要な離脱時間（分、デフォルト 180） |
| showdead | INTEGER | dead表示（0=非表示, 1=表示） |
| last_visit | TEXT | noprocrast 用の最終アクセス時刻 |
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
| dead | INTEGER | モデレーションフラグ（0=通常, 1=dead） |
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
| dead | INTEGER | モデレーションフラグ（0=通常, 1=dead） |
| created_at | TEXT | ISO8601 |

### votes

| カラム | 型 | 備考 |
|---|---|---|
| user_id | INTEGER FK | |
| item_id | INTEGER | story or comment の id |
| item_type | TEXT | 'story' or 'comment' |
| vote_type | TEXT | 'up' or 'down'（デフォルト 'up'） |
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

### flags

| カラム | 型 | 備考 |
|---|---|---|
| user_id | INTEGER FK | PK (複合) |
| item_id | INTEGER | story or comment の id（PK 複合） |
| item_type | TEXT | 'story' or 'comment'（PK 複合） |
| created_at | TEXT | ISO8601 |
| PRIMARY KEY | (user_id, item_id, item_type) | 重複フラグ防止 |
| INDEX | idx_flags_item ON (item_id, item_type) | flag 数集計用 |

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
| `/lists` | ブラウズリンク集（本家HN順: front, show, ask, best, active, newcomments） |
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
| `/noprocrast` | noprocrast ブロックページ（残り時間表示） |
| `/search` | 検索（?q=キーワード&type=all\|stories\|comments&p=ページ） |
| `/api-docs` | APIドキュメント（準備中） |
| `/rss` | RSS 2.0 フィード（トップページのストーリー30件） |
| `/api/vote` | 投票 API エンドポイント |
| `/api/favorite` | お気に入り API エンドポイント |
| `/api/hide` | 非表示 API エンドポイント |
| `/api/flag` | フラグ API エンドポイント（karma>=30、トグル、5件で dead 自動化） |
| `/api/vouch` | Vouch API エンドポイント（dead アイテムを復活、関連 flags を全削除） |

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
| `getVoteState()` | 投票状態取得（'up' / 'down' / null） |
| `getVotedStoryIds()` | upvote済みストーリーID一括取得 |
| `getCommentVoteStates()` | コメント投票状態一括取得（Map<id, 'up'/'down'>） |
| `hasFavorited()` | お気に入り済みチェック |
| `getFavoriteStoryIds()` | お気に入り済みストーリーID一括取得 |
| `getFavoriteStoriesByUserId()` | ユーザーのお気に入りストーリー一覧 |
| `hasHidden()` | 非表示済みチェック |
| `getHiddenStoryIds()` | ユーザーの全非表示ストーリーID取得 |
| `getHiddenStoriesByUserId()` | ユーザーの非表示ストーリー一覧 |
| `searchStories()` | ストーリー検索（LIKE、タイトル・URL・テキスト対象） |
| `searchComments()` | コメント検索（LIKE、テキスト対象） |
| `hasFlagged()` | 自分が flag 済みか判定 |
| `getFlaggedItemIds()` | 自分が flag 済みのアイテムID一括取得（story/comment 別） |
| `getFlagCount()` | アイテムのフラグ数を取得 |

## ランキングスコア計算式

```
score = ((points - 1) / (hours_since_post + 2)^1.8) / (flag_count + 1)^1.5
```

- `points - 1`: 投稿者の自動 upvote を除外
- `(hours_since_post + 2)^1.8`: HN 標準の時間減衰
- `(flag_count + 1)^1.5`: フラグ数によるペナルティ（フラグ 1 件で約 36% に低下）

## listing 共通フィルタ

全 listing 関数は `showdead: boolean` 引数を受け取る:

- `showdead = false`（デフォルト）: `WHERE dead = 0` で dead アイテムを除外
- `showdead = true`: dead アイテムも返す。フロントエンドで `class:faded` により薄表示

各 +page.server.ts の load 関数で `locals.user?.showdead === 1` を渡す。
