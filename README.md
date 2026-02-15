# ハッカーのろし (Hacker Noroshi)

日本の技術者向けリンク共有・議論サイト。[Hacker News](https://news.ycombinator.com) にインスパイアされた日本語コミュニティ。

**HN** = **H**acker **N**oroshi（Hacker News と同じイニシャル、意図的）

## URL

https://hn.llll-ll.com (予定)

## 技術スタック

- **SvelteKit** — フルスタックフレームワーク
- **Cloudflare Pages + Workers** — ホスティング
- **Cloudflare D1** — SQLite ベースのデータベース

## ローカル開発

```bash
npm install
npm run db:init    # D1ローカルDBにスキーマ作成
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

## DB操作（リモート）

```bash
wrangler d1 execute hacker-noroshi-db --remote --file=db/schema.sql
wrangler d1 execute hacker-noroshi-db --remote --file=db/seed.sql
```

## 機能

- 投稿（URLリンク / テキスト）
- コメント（ネストスレッド）
- 投票（upvote）
- ユーザー登録・ログイン
- ランキング（HN アルゴリズム準拠）
- Ask HN / Show HN カテゴリ

## ライセンス

MIT
