# ハッカーのろし (Hacker Noroshi)

日本の技術者向けリンク共有・議論サイト。[Hacker News](https://news.ycombinator.com) の日本語クローン。

**HN** = **H**acker **N**oroshi（Hacker News と同じイニシャル、意図的）。

## URL

https://hn.llll-ll.com

## 趣旨

- 本家 Hacker News を「見た目で区別がつかない」レベルでトレース（`DESIGN.md` / `CLAUDE.md` の方針）
- 日本人が HN の感覚を練習するための場（英語ラベルにホバーで日本語訳を出す機能は今後追加予定 #133）
- 完全日本語 UI、ストーリー本文・コメントは日本語前提

## 機能

### 投稿・コンテンツ

- ストーリー投稿（URL or テキスト、type は `story` / `ask` / `show` を自動判定）
- poll（投票）の投稿（`/newpoll`、選択肢 2-10 個、トグル投票）
- 編集（投稿・コメント、投稿後 2 時間ウィンドウ）
- 削除（タイトルが `[deleted]` になり本文が消える）
- レート制限（投稿 10 分間隔等）

### コメント

- ネストスレッド（深さ無制限）
- 編集（投稿後 2 時間）
- 削除
- 折り畳み（`[-]` / `[+]` トグル、子孫数表示）
- 親へのリンク（parent / root / next）

### 投票・モデレーション

- upvote
- downvote（karma 500 以上）
- flag（karma 30 以上、5 件で dead 自動化）
- vouch（dead 復活、関連 flags を全削除）
- hide（自分の一覧から非表示）
- favorite（お気に入り）

### 一覧・発見

- `/` フロントページ（HN ランキングアルゴリズム）
- `/newest` 新着順
- `/best` 高得点
- `/active` 議論中
- `/front` 日付別フロントページ
- `/ask` `/show` Ask HN / Show HN
- `/asknew` `/shownew` 新着 ask/show
- `/newcomments` `/bestcomments` `/noobcomments` コメント一覧
- `/noobstories` 新規ユーザーの投稿
- `/highlights` ハイライト（全期間の高得点コメント）
- `/leaders` 高 karma ユーザー
- `/lists` 一覧へのリンク集
- `/from?site=domain` ドメイン別投稿
- `/search` 検索（ストーリー + コメント）

### ユーザー

- 登録 / ログイン / ログアウト
- プロフィール（`/user/[id]`）、submissions / comments / favorites / hidden 一覧
- アカウント削除（投稿・コメントは残るが username が `[deleted]` 化）
- ユーザー名変更（90 日クールダウン、旧名からのリダイレクト）

### 公開 API（#131、v1 で追加）

- `/api/v0/topstories.json` 等 6 listings
- `/api/v0/item/{id}.json`、`/api/v0/user/{username}.json`
- 未認証、CORS `*`、[HackerNews/API](https://github.com/HackerNews/API) 互換
- 詳細: `/api-docs` ページ

### その他

- RSS フィード（`/rss`）
- Turnstile（bot 対策、login / signup / submit）
- admin / IP ban、セルフサービス unban
- noprocrast

## 技術スタック

| 層 | 技術 |
|---|---|
| Framework | SvelteKit (Svelte 5) |
| Hosting | Cloudflare Pages + Workers |
| DB | Cloudflare D1 (SQLite) |
| Auth | 自前（salt + sha256 + セッション Cookie） |
| Style | 素の CSS（pt 単位、Verdana、フラット） |
| Test | Vitest (unit) + Playwright (E2E) |

## ローカル開発

```bash
npm install
npm run db:init    # D1 ローカル DB にスキーマ作成
npm run db:seed    # テストデータ投入
npm run dev        # 開発サーバー起動 (http://localhost:5173)
```

wrangler 経由で D1 バインディングが必要な場合:

```bash
npx wrangler pages dev -- npm run dev
```

公開 API は `/api/v0/*.json` で叩ける（例: `curl http://localhost:5173/api/v0/topstories.json`）。

## デプロイ

```bash
npm run build
wrangler pages deploy
```

## DB 操作（リモート）

```bash
wrangler d1 execute hacker-noroshi-db --remote --file=db/schema.sql
wrangler d1 execute hacker-noroshi-db --remote --file=db/seed.sql
```

## テスト

```bash
npm test               # Vitest unit
npm run test:e2e       # Playwright E2E (要 dev サーバー)
npm run test:e2e:ui    # Playwright UI モード
```

## ドキュメント

| ファイル | 内容 |
|---|---|
| [docs/spec.md](docs/spec.md) | 機能仕様（投稿・コメント・投票・認証・編集・API） |
| [DESIGN.md](DESIGN.md) | デザインシステム（カラーパレット・タイポグラフィ・レイアウト） |
| [docs/architecture.md](docs/architecture.md) | 技術構成・ルート・DB スキーマ・関数一覧 |
| [docs/operations.md](docs/operations.md) | デプロイ・DB 操作・運用手順 |
| [docs/testing.md](docs/testing.md) | テスト構成・実行方法 |

## Issue / Contributing

バグ・要望は GitHub Issues へ:
https://github.com/kako-jun/hacker-noroshi/issues

## ライセンス

MIT
