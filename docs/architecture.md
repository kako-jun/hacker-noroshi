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
│   │   ├── ask/              # Ask HN
│   │   ├── show/             # Show HN
│   │   ├── item/[id]/        # 投稿詳細 + コメント + 編集
│   │   ├── user/[id]/        # プロフィール + 編集
│   │   ├── submit/           # 投稿フォーム
│   │   ├── login/            # ログイン
│   │   ├── signup/           # サインアップ
│   │   ├── logout/           # ログアウト
│   │   ├── guidelines/       # ガイドライン
│   │   ├── faq/              # FAQ
│   │   ├── showhn/           # Show HN ルール
│   │   └── api/vote/         # 投票 API
│   ├── lib/
│   │   ├── server/
│   │   │   ├── db.ts         # D1 データアクセス関数
│   │   │   └── auth.ts       # パスワードハッシュ・セッション管理
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

## ルート一覧

| パス | 説明 |
|---|---|
| `/` | トップページ（ランキング順、30件/ページ） |
| `/newest` | 新着順 |
| `/ask` | Ask HN（type='ask' のみ） |
| `/show` | Show HN（type='show' のみ） |
| `/item/[id]` | 投稿詳細 + コメントスレッド + 編集 |
| `/user/[id]` | ユーザープロフィール + 投稿履歴 + 編集 |
| `/submit` | 投稿フォーム（要ログイン） |
| `/login` | ログイン |
| `/signup` | サインアップ |
| `/logout` | ログアウト（リダイレクト） |
| `/guidelines` | ガイドライン |
| `/faq` | FAQ |
| `/showhn` | Show HN ルール |
| `/api/vote` | 投票 API エンドポイント |

## DB アクセス関数 (src/lib/server/db.ts)

| 関数 | 用途 |
|---|---|
| `getDB()` | D1 バインディング取得 |
| `getStories()` | ストーリー一覧（ランキング or 新着、type フィルタ、ページネーション） |
| `getStoryById()` | ストーリー1件取得 |
| `getCommentsByStoryId()` | コメント一覧（ストーリーID指定） |
| `getCommentById()` | コメント1件取得（編集時の権限チェック用） |
| `getUserByUsername()` | ユーザー取得（ユーザー名） |
| `getUserById()` | ユーザー取得（ID） |
| `getStoriesByUserId()` | ユーザーの投稿一覧 |
| `hasVoted()` | 投票済みチェック |
| `getVotedStoryIds()` | 投票済みストーリーID一括取得 |
| `getVotedCommentIds()` | 投票済みコメントID一括取得 |
