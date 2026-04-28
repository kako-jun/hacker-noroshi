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
| deleted | INTEGER | アカウント削除フラグ（0=有効、1=削除済み）。表示は `[deleted]` に置換 |
| deleted_at | TEXT | 削除時刻（ISO8601）。未削除なら NULL |
| is_admin | INTEGER | 管理者フラグ（0=一般、1=管理者）。/admin/* と ban 操作の認可に使う |

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

### username_history

| カラム | 型 | 備考 |
|---|---|---|
| id | INTEGER PK | autoincrement |
| user_id | INTEGER FK | users.id |
| old_username | TEXT | 変更前の名前（重複チェック対象、永久ロック） |
| new_username | TEXT | 変更後の名前 |
| changed_at | TEXT | ISO8601。アプリ層で「直近の変更」を取るため DESC ソートする。挿入順は時刻順なので実質単調増加だが、CHECK 制約は付けていない（運用上の前提） |
| INDEX | idx_username_history_old ON (old_username) | リダイレクト解決と重複判定 |
| INDEX | idx_username_history_user ON (user_id) | 90日制限判定用 |

### flags

| カラム | 型 | 備考 |
|---|---|---|
| user_id | INTEGER FK | PK (複合) |
| item_id | INTEGER | story or comment の id（PK 複合） |
| item_type | TEXT | 'story' or 'comment'（PK 複合） |
| created_at | TEXT | ISO8601 |
| PRIMARY KEY | (user_id, item_id, item_type) | 重複フラグ防止 |
| INDEX | idx_flags_item ON (item_id, item_type) | flag 数集計用 |

### ip_bans

IP 単位の ban を保持する（#77）。`hooks.server.ts` が全リクエストの先頭で
`getActiveBan()` を呼んで判定する。

| カラム | 型 | 備考 |
|---|---|---|
| id | INTEGER PK | autoincrement |
| ip | TEXT | ban 対象の IP アドレス |
| reason | TEXT | ban 理由（任意、デフォルト空文字） |
| banned_at | TEXT | ban 時刻（ISO8601、デフォルト now） |
| expires_at | TEXT | 失効時刻（ISO8601、NULL のときは無期限） |
| banned_by | INTEGER FK | 操作した管理者 user_id（任意） |
| INDEX | idx_ip_bans_ip ON (ip) | ban チェック用 |
| INDEX | idx_ip_bans_expires ON (expires_at) | 失効スイープ用 |

active 判定: `expires_at IS NULL OR expires_at > now`。unban は物理削除（DELETE）。

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
| `/shownew` | 新着順 Show HN（時系列） |
| `/asknew` | 新着順 Ask HN（時系列） |
| `/bestcomments` | 直近30日の高得点コメント上位30件 |
| `/highlights` | 全期間の高得点コメント上位30件 |
| `/noobstories` | 新規ユーザー（過去14日以内）の投稿 |
| `/noobcomments` | 新規ユーザー（過去14日以内）のコメント |
| `/leaders` | karma 上位30ユーザーのリーダーボード |
| `/lists` | ブラウズリンク集（本家HN順、実装済み13項目を掲載） |
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
| `/from` | ドメイン別投稿一覧（?site=example.com、/item の past リンクから遷移） |
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
| `getTopUsersByKarma()` | karma 順ユーザー一覧（/leaders 用） |
| `getBestComments()` | 高得点コメント一覧（sinceMs で期間制限可、/bestcomments と /highlights 用） |
| `getStoriesByNewUsers()` | 新規ユーザーの投稿一覧（/noobstories 用） |
| `getCommentsByNewUsers()` | 新規ユーザーのコメント一覧（/noobcomments 用） |
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
| `validateUsernameFormat()` | ユーザー名フォーマット検証（signup と共有、3-15文字・英数字+`_-`） |
| `isUsernameTaken()` | users + username_history の両方で重複チェック（履歴も永久ロック） |
| `getOldUsernameRedirect()` | 旧 username から最新 new_username を解決（連鎖変更対応） |
| `getLastUsernameChange()` | 直近のユーザー名変更日時（90日制限判定用） |
| `updateUsername()` | users.username 更新と username_history への履歴 insert を batch で実行 |
| `deleteAccount()` | users 行を `deleted=1` にし個人情報・設定をクリア + sessions 削除を batch で実行 |
| `displayUsername()` | 削除済みユーザーの username を `[deleted]` に置換するクライアント表示ヘルパ（`src/lib/format.ts`） |
| `getActiveBan()` | 該当 IP の active な ban を取得（無期限 or expires_at 未来）。なければ null（#77） |
| `listActiveBans()` | active な ban の一覧を新しい順で返す（admin 用、#77） |
| `createIpBan()` | IP ban を新規作成（ip / reason / expiresAt / bannedBy、#77） |
| `removeIpBan()` | IP ban を物理削除（unban、#77） |
| `expireIpBan()` | IP ban の expires_at を now にして論理失効（履歴保持用、#77） |

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
