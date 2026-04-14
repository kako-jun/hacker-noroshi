# ハッカーのろし (Hacker Noroshi)

日本の技術者向けリンク集約＋議論サイト。Hacker News の完全クローン（日本語版）。

## ドキュメント

| ファイル | 内容 |
|---|---|
| `docs/spec.md` | 機能仕様（投稿・コメント・投票・認証・編集） |
| `docs/design.md` | デザインシステム（色・フォント・レイアウト規則） |
| `docs/architecture.md` | 技術構成・ルート・DB スキーマ・関数一覧 |
| `docs/operations.md` | デプロイ・DB 操作・運用手順 |

## 基本ルール

- **本家 HN を完全にトレースする**。迷ったら本家に合わせる
- **デザインは `docs/design.md` に従う**。定義外の色・フォント・スペーシングを使わない
- pt 単位のみ（px, rem 禁止）。Verdana フォント。フラットデザイン
- シャドウ、グラデーション、ボーダーラディウス、アニメーション禁止
- テーブルレイアウトでフォーム構成（本家 HN と同じ）

## 技術スタック

SvelteKit + Cloudflare Pages/Workers + D1 (SQLite)

## URL

https://hn.llll-ll.com
