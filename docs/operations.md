# ハッカーのろし — デプロイ・運用

## ローカル開発

```bash
npm install
npm run db:init    # D1 ローカル DB にスキーマ作成
npm run db:seed    # テストデータ投入
npm run dev        # 開発サーバー起動
```

wrangler 経由で D1 バインディングが必要な場合:

```bash
npx wrangler pages dev -- npm run dev
```

## デプロイ

```bash
npm run build
wrangler pages deploy
```

URL: https://hn.llll-ll.com

## DB 操作（リモート）

```bash
# スキーマ適用
wrangler d1 execute hacker-noroshi-db --remote --file=db/schema.sql

# テストデータ投入
wrangler d1 execute hacker-noroshi-db --remote --file=db/seed.sql

# 任意の SQL 実行
wrangler d1 execute hacker-noroshi-db --remote --command="SELECT COUNT(*) FROM stories"
```

D1 データベース ID: `185871af-76c3-403c-81c8-aede8f8cd100`

## Cloudflare 設定

- **Pages プロジェクト**: hacker-noroshi
- **D1 バインディング名**: `DB`
- **カスタムドメイン**: hn.llll-ll.com

## テストデータ

`db/seed.sql` にテスト用ユーザー・投稿・コメントが定義されている。
本番環境ではテストデータを投入しないこと。

テストユーザーのパスワードは全て `test1234`。

## DB マイグレーション

D1 にはマイグレーション機構が無いので、`db/schema.sql` を編集した後、変更分の SQL を直接適用する。

### #17 フラグ・モデレーション（2026-04 適用）

```bash
# stories.dead カラム追加
wrangler d1 execute hacker-noroshi-db --remote --command "ALTER TABLE stories ADD COLUMN dead INTEGER NOT NULL DEFAULT 0"

# comments.dead カラム追加
wrangler d1 execute hacker-noroshi-db --remote --command "ALTER TABLE comments ADD COLUMN dead INTEGER NOT NULL DEFAULT 0"

# flags テーブル作成
wrangler d1 execute hacker-noroshi-db --remote --command "CREATE TABLE IF NOT EXISTS flags (user_id INTEGER NOT NULL REFERENCES users(id), item_id INTEGER NOT NULL, item_type TEXT NOT NULL CHECK (item_type IN ('story', 'comment')), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')), PRIMARY KEY (user_id, item_id, item_type))"

# flags インデックス
wrangler d1 execute hacker-noroshi-db --remote --command "CREATE INDEX IF NOT EXISTS idx_flags_item ON flags(item_id, item_type)"
```

ローカル開発 DB に対しても同じコマンドを `--local` で実行する（`--remote` を `--local` に置き換え）。

### #76 アカウント削除（本番反映手順）

```bash
# users.deleted / deleted_at カラム追加
wrangler d1 execute hacker-noroshi-db --remote --command "ALTER TABLE users ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0"
wrangler d1 execute hacker-noroshi-db --remote --command "ALTER TABLE users ADD COLUMN deleted_at TEXT"
```

ローカル開発 DB にも `--local` で同じコマンドを流す。

### #77 IP ban / 管理者フラグ（本番反映手順）

> **重要: 本番は必ず Cloudflare 経由でアクセスさせること。直結を許すと CF-Connecting-IP ヘッダ偽装で ban を回避される。**
>
> hooks.server.ts は `CF-Connecting-IP` ヘッダを優先してクライアント IP を取得する。
> Cloudflare 越しでは Cloudflare がこのヘッダを上書きするので信頼できるが、
> Pages のオリジンに直接到達できる経路があると、攻撃者が任意のヘッダで ban を回避できる。
> Cloudflare Access / Tunnel / Zero Trust などで直結経路を塞ぐこと。

```bash
# users.is_admin カラム追加
wrangler d1 execute hacker-noroshi-db --remote --command "ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0"

# 初期管理者を付与（id=1 = noroshi。実際の管理者ユーザー id に合わせて調整）
wrangler d1 execute hacker-noroshi-db --remote --command "UPDATE users SET is_admin = 1 WHERE id = 1"

# ip_bans テーブル + インデックス
wrangler d1 execute hacker-noroshi-db --remote --command "CREATE TABLE IF NOT EXISTS ip_bans (id INTEGER PRIMARY KEY AUTOINCREMENT, ip TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', banned_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')), expires_at TEXT, banned_by INTEGER REFERENCES users(id))"
wrangler d1 execute hacker-noroshi-db --remote --command "CREATE INDEX IF NOT EXISTS idx_ip_bans_ip ON ip_bans(ip)"
wrangler d1 execute hacker-noroshi-db --remote --command "CREATE INDEX IF NOT EXISTS idx_ip_bans_expires ON ip_bans(expires_at)"
```

ローカル開発 DB にも `--local` で同じコマンドを流す。

### #74 投票投稿（本番反映手順）

`stories.type` と `votes.item_type` の CHECK 制約を変更する必要がある。
SQLite/D1 は CHECK 制約の ALTER に非対応のため、**新規 DB を再作成するか、テーブル再作成（CREATE TABLE ... AS SELECT で移行）が必要**。本番未公開の現段階では新規 DB に schema.sql を投入し直すのが最短。

```bash
# poll_options テーブル + インデックス（追加のみで済む新規パーツ）
wrangler d1 execute hacker-noroshi-db --remote --command "CREATE TABLE IF NOT EXISTS poll_options (id INTEGER PRIMARY KEY AUTOINCREMENT, story_id INTEGER NOT NULL REFERENCES stories(id), text TEXT NOT NULL, position INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')))"
wrangler d1 execute hacker-noroshi-db --remote --command "CREATE INDEX IF NOT EXISTS idx_poll_options_story ON poll_options(story_id)"

# stories.type / votes.item_type の CHECK 拡張は table 再作成が必要。
# 既存 DB が空または捨てて良いなら schema.sql を再投入する:
#   wrangler d1 execute hacker-noroshi-db --remote --file=db/schema.sql
```

### CHECK 制約変更が必要になった場合の汎用テーブル再作成手順

SQLite/D1 は `ALTER TABLE` で CHECK 制約を変更できない。本番運用後に CHECK 列挙値を
追加・変更する必要が出た場合は、以下の **rename → 新 CREATE → INSERT SELECT → DROP 旧**
パターンで再作成する。例として `stories` テーブルの `type` に新しい値を加える場合:

```sql
-- 1. 旧テーブルをリネーム
ALTER TABLE stories RENAME TO stories_old;

-- 2. 新しい CHECK 制約で新テーブルを作成（インデックス・FK 含む）
CREATE TABLE stories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  url TEXT,
  text TEXT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  points INTEGER NOT NULL DEFAULT 1,
  comment_count INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'story' CHECK (type IN ('story', 'ask', 'show', 'poll', 'NEW_VALUE')),
  dead INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- 3. データを旧テーブルから新テーブルへコピー
INSERT INTO stories (id, title, url, text, user_id, points, comment_count, type, dead, created_at)
SELECT id, title, url, text, user_id, points, comment_count, type, dead, created_at FROM stories_old;

-- 4. インデックスを再作成（schema.sql の CREATE INDEX 文を流す）
CREATE INDEX IF NOT EXISTS idx_stories_created_at ON stories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_type ON stories(type);
CREATE INDEX IF NOT EXISTS idx_stories_user_id ON stories(user_id);

-- 5. 旧テーブルを削除
DROP TABLE stories_old;
```

注意点:

- 外部キー参照（`comments.story_id`、`favorites.story_id`、`hidden.story_id`、`poll_options.story_id` 等）は
  **id を維持してコピーすれば壊れない**（id を引き継いでいるため）。
- 実行中は読み書きを止める（`wrangler d1` で1セッションずつ流す）。本番アクセスがある場合は
  メンテナンスモードを挟む。
- `votes.item_type` の CHECK 変更も同じパターンで行う（PRIMARY KEY (user_id, item_id, item_type) を維持）。
- 失敗に備え、事前に `wrangler d1 export` でバックアップを取る。
