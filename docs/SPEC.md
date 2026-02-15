# ハッカーのろし — 仕様書

## 概要

日本の技術者向けリンク共有・議論サイト。Hacker Newsクローン。
略称 **HN**（Hacker Newsと同じイニシャル、意図的）。

## 技術スタック

| 層 | 技術 |
|---|---|
| フレームワーク | SvelteKit |
| デプロイ | Cloudflare Pages + Workers |
| DB | Cloudflare D1 (SQLite) |
| 認証 | 自前（ユーザー名 + パスワード + セッションCookie） |
| スタイル | CSS（フレームワーク不使用。HNのミニマリズム踏襲） |

## データモデル

### users

| カラム | 型 | 備考 |
|---|---|---|
| id | INTEGER PK | autoincrement |
| username | TEXT UNIQUE | 3-15文字、英数字+アンダースコア |
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
| text | TEXT | テキスト投稿の場合（urlと排他） |
| user_id | INTEGER FK | 投稿者 |
| points | INTEGER | デフォルト 1（投稿者の自動upvote） |
| comment_count | INTEGER | デフォルト 0 |
| type | TEXT | 'story', 'ask', 'show' |
| created_at | TEXT | ISO8601 |

### comments

| カラム | 型 | 備考 |
|---|---|---|
| id | INTEGER PK | autoincrement |
| text | TEXT | Markdown不可、プレーンテキスト |
| user_id | INTEGER FK | 投稿者 |
| story_id | INTEGER FK | 所属する投稿 |
| parent_id | INTEGER FK | 親コメント（NULLならトップレベル） |
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

## ランキングアルゴリズム

HN準拠:

```
score = (points - 1) / (hours_since_post + 2) ^ 1.8
```

- `points - 1`: 投稿者の自動upvoteを除外
- `hours_since_post`: 投稿からの経過時間
- `1.8`: gravity（減衰定数）

## ルート

| パス | 説明 |
|---|---|
| `/` | トップページ（ランキング順、30件/ページ） |
| `/newest` | 新着順 |
| `/ask` | Ask HN（type='ask'のみ） |
| `/show` | Show HN（type='show'のみ） |
| `/item/[id]` | 投稿詳細 + コメントスレッド |
| `/user/[id]` | ユーザープロフィール + 投稿履歴 |
| `/submit` | 投稿フォーム（要ログイン） |
| `/login` | ログイン |
| `/signup` | サインアップ |

## 認証フロー

1. サインアップ: username + password → bcryptハッシュ化してDB保存
2. ログイン: username + password → 照合 → セッショントークン発行 → Cookie設定
3. セッション: SvelteKitのhooks.server.tsで毎リクエスト検証
4. ログアウト: セッション削除 + Cookie破棄

## UI方針

- HN本家のミニマリズムを踏襲
- オレンジのヘッダーバー
- モノスペースではなくsans-serifフォント（現代的に）
- レスポンシブ（モバイル対応）
- ダークモードはv2以降

## v1スコープ（今回）

- [x] 投稿の作成・表示・一覧
- [x] コメント（ネスト）
- [x] 投票（upvoteのみ、downvoteなし）
- [x] ユーザー登録・ログイン
- [x] ランキング + 新着
- [x] Ask / Show カテゴリ
- [x] ページネーション

## v1スコープ外

- 検索
- フラグ/モデレーション
- メール通知
- API
- 招待制/カルマ制限
- ダークモード
