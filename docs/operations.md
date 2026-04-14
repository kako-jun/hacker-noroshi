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
