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
