# ハッカーのろし — 仕様書

## 概要

日本の技術者向けリンク共有・議論サイト。Hacker News クローン。
略称 **HN**（Hacker Newsと同じイニシャル、意図的）。

URL: https://hn.llll-ll.com

## 機能仕様

### 投稿

- URL リンク投稿またはテキスト投稿（排他）
- タイトル最大80文字
- 投稿フォームには Hacker Noroshi の操作補助として story / ask / show の種別選択がある
- 種別選択は `stories.type` の安定メタデータとして保存し、翻訳済み文字列をタイトルには挿入しない
- `type=show` の表示ラベルは locale に応じて英語 UI では `Show HN`、日本語 UI では `作ったもの` として描画する
- タイトルが「Ask HN:」で始まる → type=ask
- タイトルが「Show HN:」で始まる → type=show
- 既存互換のため、タイトルプレフィックスがある場合は種別選択より優先する
- それ以外 → type=story
- 投稿には要ログイン
- レート制限: 同一ユーザーの連続投稿は10分間隔が必要。違反時は "You're submitting too fast. Please slow down." を表示

### 投票投稿（poll, #74）

本家HN /newpoll 相当。

- `/newpoll` から投稿。要ログイン（karma 閾値なし）
- フィールド: タイトル（1-80文字）、テキスト（任意、最大4000文字）、選択肢（改行区切り、2-10個、各1-300文字）
- type='poll' として stories に保存。url は NULL
- 各選択肢は `poll_options` テーブルに position 順で保存
- 選択肢への投票は `votes` に `item_type='poll_option'` で記録。トグル式（再クリックで取り消し）
- 1ユーザーが複数選択肢に重複投票可能
- 選択肢への投票では karma 加算しない（投稿者・投票者の両方）
- 一覧ページで `[poll]` タグを表示。`/polls` で投票投稿のみ一覧表示
- `/submit` ページに「Or submit a poll」リンクあり
- レート制限は `/submit` と同枠（同一ユーザーの連続投稿は10分間隔）。違反時は "You're submitting too fast. Please slow down." を表示
- poll を削除（`[deleted]` 化）すると、選択肢テキストと既存の投票は残る（論理削除のため）。物理削除時のみ `poll_options` が `ON DELETE CASCADE` で消える
- poll の編集（編集窓 2 時間以内）では type は `poll` のまま固定。タイトル先頭が `Ask HN:` / `Show HN:` でも type を書き換えない

### コメント

- ネストスレッド（40px/段のインデント）
- トップレベルコメントまたは既存コメントへの返信
- テキストフォーマット: URL自動リンク（`rel="nofollow noreferrer"`）、`*text*` でイタリック
- パーマリンク: `/item/{comment_id}` でコメント単体 + 子スレッドを表示
- parent リンク（親コメント or 親ストーリーへ）、on: リンク（親ストーリーへ）
- タイムスタンプがパーマリンクリンクを兼ねる
- スレッドクローズ: 投稿から14日経過したストーリーは新規コメント不可。フォームとreplyリンクを非表示（メッセージなし）。サーバーサイドでもバリデーション
- レート制限: 同一ユーザーの連続コメントは2分間隔が必要。違反時は "You're posting too fast. Please slow down." を表示

### 投票

- ストーリー: upvote のみ
- コメント: upvote + downvote
- トグル式（再クリックで取り消し、逆方向クリックで切替）
- 重複投票は PK 制約で防止

#### downvote（コメント専用）

- karma 500 以上のユーザーのみ downvote 可能
- ストーリーへの downvote は不可
- 自分のコメントへの直接返信には downvote 不可
- downvote されたコメント（points < 1）はテキストがフェード表示（薄い色）
- downvote 済みの ▼ はオレンジ色で表示

### ランキングアルゴリズム

HN 準拠:

```
score = (points - 1) / (hours_since_post + 2) ^ 1.8
```

- `points - 1`: 投稿者の自動 upvote を除外
- `hours_since_post`: 投稿からの経過時間
- `1.8`: gravity（減衰定数）

### 認証

1. サインアップ: username + password → bcrypt ハッシュ化して DB 保存
2. ログイン: username + password → 照合 → セッショントークン発行 → Cookie 設定
3. セッション: SvelteKit の hooks.server.ts で毎リクエスト検証
4. ログアウト: セッション削除 + Cookie 破棄

ログインとサインアップは同一ページ（/login）に統合（本家HN準拠）。/signup は /login にリダイレクト。

ユーザー名: 3-15文字、英数字+アンダースコア+ハイフン
新規ユーザー表示: アカウント作成から14日以内のユーザー名を緑色（#3c963c）で表示

#### ユーザー名変更

- プロフィールページ `/user/[id]` の「Change username」フォームから本人がセルフサービスで変更可能
- 頻度制限: **90日に1回**まで。直前の変更時刻を `username_history.changed_at` から判定
- バリデーション: signup と同じ規則（3-15文字、英数字+`_-`）。`validateUsernameFormat()` で共通化
- 重複チェック: 現在の users.username だけでなく `username_history.old_username` も対象（過去に使われた名前は永久ロック、自分の旧名も含む）
- 成功時: users.username を更新、`username_history` に旧名を insert（D1 batch でアトミック）、`/user/{new_username}` に **303 See Other** リダイレクト（form action の POST 後 GET 用、一時的な遷移）
- 旧 URL（`/user/{old_username}` とその子ルート submissions/comments/favorites/hidden）は最新の username へ **301 Moved Permanently** リダイレクト（永続的）。連鎖変更（A→B→C）も最新まで解決。querystring（`?p=2` 等）は保持する
- 本家HN FAQ #31「Can I change my username?」相当だが、本家とは異なりセルフサービスで完結する

#### アカウント削除

- プロフィールページ `/user/[id]` の「Delete account」フォームから本人がセルフサービスで削除可能
- パスワード再入力 + ブラウザの `confirm()` 二重確認（CSR で `use:enhance` 経由）
- 削除処理（`deleteAccount(db, userId)`）:
  - users 行は残す（username の永久ロックのため）。`deleted=1`, `deleted_at=now`
  - 個人情報をクリア: `about='', password_hash=''`
  - 設定をデフォルトに戻す: `delay=0, noprocrast=0, maxvisit=20, minaway=180, showdead=0, last_visit=NULL`
  - 当該ユーザーの sessions を全削除（即時ログアウト）
  - D1 batch でアトミック実行
- 削除済みアカウントの挙動:
  - `getSession()` は `u.deleted = 0` で絞るためログイン済みでもセッション無効化される
  - ログイン時 `user.deleted === 1` は通常の "Bad login" として拒否（列挙防止）
  - プロフィールページ本体: "This user has deleted their account." のみ表示
  - `/user/[name]/submissions` `/user/[name]/comments`: 投稿・コメントは残し、username 表示は `[deleted]`（`displayUsername` ヘルパで一貫）
  - `/user/[name]/favorites`: プライバシー観点で空表示
  - `/leaders`: 削除済みは除外。アクティブユーザーのみ表彰（小規模時はページング歯抜けを許容）
- 即時実行・復旧不可。投稿・コメントはスレッド整合性のため `[deleted]` 名義で保持
- 削除済み username は **永久に再取得不可**（自分自身も含む）
- 本家HN FAQ #32「Can I delete my account?」相当だが、本家とは異なりセルフサービスで完結する
- スキーマ追加 (`users.deleted`, `users.deleted_at`) は `db/schema.sql` に ALTER 文をコメントとして併記。本番反映手順は `docs/operations.md` の「#76 アカウント削除」を参照

### ユーザー設定

プロフィールページ（`/user/[id]`）で本人のみ編集可能。テーブルレイアウトのインラインフォーム（本家HN準拠）。

| 設定 | 型 | デフォルト | 説明 |
|---|---|---|---|
| about | TEXT | '' | 自己紹介 |
| showdead | yes/no | no | dead 状態の投稿・コメントを表示（モデレーション実装後に有効） |
| noprocrast | yes/no | no | アクセス制限を有効にする |
| maxvisit | INTEGER | 20 | noprocrast: 連続アクセス可能時間（分） |
| minaway | INTEGER | 180 | noprocrast: 必要な離脱時間（分） |
| delay | INTEGER | 0 | 自分のコメントが他者に表示されるまでの遅延（0-10分） |

#### noprocrast

1. 有効時、最初のアクセスで `last_visit` を記録
2. `last_visit` から `maxvisit` 分以内 → 通常アクセス
3. `maxvisit` 分超過 → `/noprocrast` ページにリダイレクト
4. `maxvisit + minaway` 分経過 → `last_visit` リセット、通常アクセス再開

#### delay（コメント遅延）

- コメント投稿者の `delay` 設定に基づき、`created_at + delay分` が現在時刻より未来のコメントは投稿者本人以外に非表示
- サーバーサイドフィルタ（`getCommentsByStoryId`, `getRecentComments`, `getCommentsByUserId` で適用）

### 検索

- `/search` ページで検索フォーム + 結果表示
- 検索対象: ストーリー（タイトル・URL・テキスト）、コメント（テキスト）
- タイプフィルタ: all（両方）/ stories / comments
- LIKE 検索（`%` `_` `\` はエスケープ）、ページネーション
- フッターに Search リンク + テキスト入力欄

### 編集機能

- プロフィール: ログイン中の本人が about + 設定フィールドを編集可能
- 投稿: 投稿から2時間以内、本人のみ title と text を編集可能
- コメント: 投稿から2時間以内、本人のみ text を編集可能
- ストーリー編集時は type を再判定（Ask HN: / Show HN: プレフィックス）

### Story-list メタ行 (#114)

13 ページ共通 `StoryListItem.svelte` のメタ行は本家 HN と並びを揃える:

```
{points} point(s) by {user} {timeAgo} | hide | [past] | {discuss|N comment(s)} | [un-]flag
```

- `hide` は未ログイン時も表示し、クリックすると `/login` にリダイレクト（本家 HN と同じ挙動）
- `past` は URL 付きストーリーのみ。`/from?site={domain}` で同ドメインの過去投稿一覧へ
- コメント数 0 件のときは `discuss`、1 件以上は `{N} comment(s)` に切替
- `flag` はログイン中で karma 閾値を満たすときだけ表示（`canFlag`）

### hide 機能

ストーリーをユーザー単位で非表示化する機能（本家HN準拠）。

- ログイン中のユーザーが各ストーリーのメタ行 `hide` リンクをクリックすると、`hidden` テーブルに `(user_id, story_id)` を保存
- 一覧ページではサーバー側で `getHiddenStoryIds(db, user_id)` を取得し、該当 story を `stories.filter((s) => !hiddenIds.has(s.id))` で除外
- フロントエンドでは hide クリック後すぐに行が消える（`localHiddenIds` セットに追加して `isHidden(story.id)` で行を非表示）
- `/user/[id]/hidden` で自分が hide した一覧を確認・un-hide 可能
- API: `POST /api/hide`（toggle 式。再度クリックで un-hide。対象 story が存在しないと 404、未ログインは 401）

#### 対象ページ（13 ページ）

hide リンクとサーバー側除外ロジックを実装するページ:

| パス | 役割 |
|---|---|
| `/` | ホームページ（rank 順） |
| `/newest` | 新着 story 一覧（投稿日時降順） |
| `/best` | 高得点 story 一覧（points 降順） |
| `/active` | アクティブな議論一覧（最新コメント順） |
| `/front` | 過去日付の rank 上位（`?day=YYYY-MM-DD`、その日の rank 順） |
| `/ask` | Ask HN 一覧（rank 順） |
| `/show` | Show HN 一覧（rank 順） |
| `/asknew` | Ask HN 新着（投稿日時降順） |
| `/shownew` | Show HN 新着（投稿日時降順） |
| `/noobstories` | 新規ユーザー投稿一覧（投稿日時降順） |
| `/from` | ドメイン別投稿一覧（投稿日時降順） |
| `/polls` | 投票投稿一覧（投稿日時降順） |
| `/search` | 検索結果（stories タブ、関連度・日時順） |

加えて `/item/[id]` 詳細ページのメタ行にも hide リンクがあるが、単体表示のため一覧除外ロジックは不要（hide 後にリロードしても通常表示されたまま）。`/user/[id]/hidden` は hide 済み一覧を表示する管理ページで、除外ではなく逆に hidden のみを表示する。username 変更時は L96 の通り旧 URL 子ルート `hidden` も 301 リダイレクトで追従する。

#### 新規 story-list ページ追加時のガイド

新しい story 一覧ページを追加するときは、上記 12 ページと同じパターンを踏襲する:

1. `+page.server.ts` で `getHiddenStoryIds(db, locals.user.id)` を取得
2. ログイン中のユーザーには `stories.filter((s) => !hiddenIds.has(s.id))` で除外
3. `+page.svelte` のメタ行に hide / un-hide トグルリンクを追加
4. クリック後の即時消去のため `localHiddenIds` を保持

`<StoryListItem />` 共通コンポーネント（#86）を抽出済み。新規ページはこれを使うだけで自動的に hide が入る。

#### StoryListItem 抽出後の DOM 同一性（#86, #106 で検証）

抽出前の `+page.svelte` 等にハードコードされていた `.story-item` レンダリング DOM と、抽出後の `<StoryListItem />` レンダリング DOM はクラス名・タグ階層・テキストノードの並びが完全に一致する（`/`,  `/newest`, `/best`, `/active`, `/front`, `/ask`, `/show`, `/asknew`, `/shownew`, `/noobstories`, `/from`, `/polls`, `/search` の全 13 ページが対象）。具体的には次の構造:

```
<div class="story-item">
  <span class="story-rank">{rank}.</span>      <!-- /search 等で rank=null のときは省略 -->
  <span class="story-vote"><button class="upvote" /></span>
  <div class="story-content">
    <div class="story-title-line">{title} {domain} {[poll]} {[flagged]} {[dead]}</div>
    <div class="story-meta">{points} by {user} {age} | {N comments} | {hide?} | {flag?}</div>
  </div>
</div>
```

抽出時に変わったのは「楽観的更新の state を親側から行ごとに分散」「`canFlag` / `[poll]` 判定を `$lib/storyActions.ts` の純粋関数化」のみで、CSS / DOM は同等。`/polls` の `forcePollTag` と `/search` の `rank` 省略は元々ページ側にあった分岐をそのまま prop 化したもの。

### フラグ・モデレーション

- ログイン中、karma 30 以上のユーザーは他人の投稿/コメントに **flag** を付けられる
- フラグはトグル式（再度クリックで un-flag）
- 自分の投稿/コメントには flag 不可
- フラグ数が **5 件以上**（>4）になるとアイテムは `dead = 1` に自動マーク
- dead アイテムは通常の listing から除外される（`WHERE dead = 0`）
- `showdead = 1` のユーザーは dead アイテムも表示される（薄表示 / `[dead]` タグ付き）
- フラグ済みアイテム（flag_count > 0）には `[flagged]` タグが表示される
- コメントの flag リンクは **コメント単体ページ（/item/{comment_id}）の対象コメントのみ**で表示（本家 HN 準拠）

### Vouch（復活）

- karma 30 以上のユーザーは dead アイテムに対して **vouch** を付けられる
- vouch は dead=1 のアイテムにのみ可能
- vouch 成功時: `dead = 0` に戻し、関連する flags レコードを **全削除**（再炎上防止）
- 自分の投稿/コメントには vouch 不可
- vouch リンクは /item/{id} の単体ページでのみ表示

### ランキング降格（flag による score ペナルティ）

通常のランキングスコアにフラグ数のペナルティを掛ける:

```
score = ((points - 1) / (hours_since_post + 2)^1.8) / (flag_count + 1)^1.5
```

- フラグ 1 件で score は約 36% に、フラグ 4 件で約 9% に低下
- dead 化される前の段階でも、フラグが集まったストーリーは自然にランキングから降格していく

### 削除機能

- 投稿・コメントから 2 時間以内、本人のみ削除可能（編集ウィンドウと同条件）
- 物理削除ではなく **論理削除**: テキストを `[deleted]` に置換するのみ
  - 投稿: `title`、`url`、`text` を `[deleted]` に置換（url は NULL）
  - コメント: `text` を `[deleted]` に置換
- `[deleted]` は `dead`（モデレーション）とは別概念。`showdead` 設定の影響を受けず、常に `[deleted]` のまま表示される
- フロントエンドでは確認ダイアログ（`confirm()`）を挟む

### IP ban (#77)

悪質な投稿・スパムに対する IP 単位の防衛機構。骨格のみを v1 スコープに含める。

- スキーマ: `ip_bans` テーブル（id / ip / reason / banned_at / expires_at / banned_by）
- 判定: `hooks.server.ts` で session 取得より前に `getActiveBan(ip)` を呼ぶ。
  - `expires_at IS NULL`（無期限）または `expires_at > now`（時限）のとき active
  - active なら `/ipban` に 302 リダイレクト
  - `/ipban` 自身と `/api/*` は除外（無限ループ防止）
- IP 取得: `CF-Connecting-IP` ヘッダ（Cloudflare 経由）→ `getClientAddress()`（直結）の優先順位
- 認可: `users.is_admin = 1` のユーザーのみ `/admin/*` にアクセス可能
- 管理 UI: `/admin/ipban`
  - active な ban の一覧（IP / 理由 / ban日時 / 解除予定）
  - ban フォーム（IP / 理由 / 有効期限を時間単位、空欄で無期限）
  - 各行に unban ボタン（物理削除）
- 自分のステータス確認: `/ipban`（誰でもアクセス可、自分の IP の状態を見るだけ）

別 Issue で対応:

- `#91` CAPTCHA セルフサービス unban

#### 自動 ban (#92)

連続ログイン失敗を IP 単位で計測し、閾値超過で自動的に `ip_bans` に行を投入する。
ブルートフォース・パスワードスプレー対策。

- **5 分間で 10 回以上ログイン失敗** → そのIPを **1 時間 ban**
- **1 時間で 30 回以上ログイン失敗** → そのIPを **24 時間 ban**（より長い側を優先）

両方の条件を上から順に評価し、24h 条件が先にマッチしたら 24h ban を採用する。
24h ban が active な間に更に失敗が続いてもより長い ban に上書きはしない（既に ban 中）。

対象とする失敗:

- パスワード不一致
- 該当ユーザー不在（存在しない username でのログイン試行）
- `users.deleted = 1` の削除済みユーザーへのログイン試行
- いずれも `/login` の login action がパスワード検証経路で `Bad login` を返す状況

対象外:

- バリデーションエラー（username/password が空）— 攻撃ではなく入力ミスのため
- ban 発動レスポンスは元の `Bad login` のまま。次のリクエストで `hooks.server.ts` が `/ipban` にリダイレクトする

スコープ外:

- 過剰リクエスト（HTTP リクエスト数）系の自動 ban — ストレージコストとフォールスポジティブのバランスから見送り
- アカウント単位のレート制限は #28 で実装済み

テーブル管理:

- `ip_login_failures` に IP と失敗時刻を保持
- `hooks.server.ts` が 1% の確率で 24h 超のレコードを物理削除（fire-and-forget）。テーブル肥大化を防ぐ

自動 ban の `banned_by` は NULL（管理者ではないため）。`reason` は
`auto: 5min/10 login failures` / `auto: 60min/30 login failures` のいずれかで識別できる。

#### セルフサービス unban (#91)

共有 IP（職場・学校・公共 Wi-Fi）で巻き込まれた正当ユーザーの自助手段。

- プロバイダ: **Cloudflare Turnstile**（Cloudflare Pages との親和性 + 無料 + reCAPTCHA より軽量）
- 動作: `/ipban` ページで ban 中のときのみ Turnstile widget を表示する。
  通過するとサーバー側で `https://challenges.cloudflare.com/turnstile/v0/siteverify` に
  POST して検証し、`success: true` なら当該 IP の active な ban を全削除する。
  完了後 `/` へ 303 redirect する。
- ソフト制限: 24h 以内 3 回まで（cookie `unban_attempts` ベース）。
  cookie 削除で回避可能なことは v1 範囲では許容する。永続的な対策は将来検討。
- env: `TURNSTILE_SITE_KEY`（public, `[vars]`）と `TURNSTILE_SECRET_KEY`（secret, `wrangler pages secret put`）
- フェイルセーフ: site key が未設定（dev / 未デプロイ）なら widget を出さない。
  secret 未設定なら 500 を返す（管理側に連絡する旨のメッセージ）。
- ban 中でない IP からの unban POST は 400（直接 POST 攻撃の防御）。

### 静的ページ

- `/guidelines` — 投稿・コメントのガイドライン
- `/faq` — よくある質問
- `/showhn` — Show HN 専用ルール

### 英語 / 日本語 UI 切替 (#133, #138)

UI ラベルは英語・日本語を切り替えられる。切替は表示文字列のみで、ルート、投稿種別、API、
ランキング、認証、フォーム処理の挙動は変えない。

- locale は Cookie `locale` に `en` / `ja` として保存する。未設定または不正値は `en`
- `/locale?lang={en|ja}&next={relative-path}` で切替し、`safeNext()` で安全な相対パスに戻す
- ヘッダー nav、ヘッダー右、フッター、topright、submit/login/newpoll フォーム、
  story-list の主要アクションは `src/lib/i18n.ts` の共有辞書から表示する
- 英語モードでは HN 風の英語ラベルを本体表示し、日本語訳を `title` tooltip に入れる
- 日本語モードでは日本語ラベルを本体表示し、必要な箇所では英語ラベルを `title` tooltip に入れる
- 動的 label（time-ago 等）は対象 formatter の責務。数値混合の一部（points/comments）は
  `StoryListItem.svelte` 内で locale に応じて表示する

## v1 スコープ

- [x] 投稿の作成・表示・一覧
- [x] コメント（ネスト）
- [x] 投票（upvote のみ）
- [x] ユーザー登録・ログイン
- [x] ランキング + 新着
- [x] Ask / Show カテゴリ
- [x] ページネーション
- [x] プロフィール編集
- [x] 投稿・コメント編集（2時間以内）
- [x] 投稿・コメント削除（2時間以内、`[deleted]` 置換）
- [x] ガイドライン・FAQ・Show HN ルールページ
- [x] ユーザーの submissions / comments 一覧ページ
- [x] コメントパーマリンク（/item/{comment_id}）
- [x] テキストフォーマット（URL自動リンク、*イタリック*）
- [x] 新規アカウントの緑色ユーザー名（作成14日以内）
- [x] 追加ブラウズページ（/newcomments, /best）
- [x] ログイン+サインアップ1ページ統合（本家HN準拠）
- [x] ヘッダーナビに comments リンク追加
- [x] /front ページ（日付別フロントページ）+ ヘッダーナビに past リンク追加
- [x] フッター構成を本家HNに合わせる + /lists ページ追加
- [x] RSS フィード（/rss）追加
- [x] /active ページ追加（アクティブな議論一覧）
- [x] APIドキュメントページ追加（/api-docs、フッターからリンク）
- [x] favorites 機能（favorite/un-fav トグル + /user/[id]/favorites 一覧）
- [x] hide 機能（ストーリー非表示 + /user/[id]/hidden 一覧 + 一覧からの除外）
- [x] downvote 機能（コメント専用、karma 500 閾値、フェード表示）
- [x] ユーザー設定（showdead, noprocrast, delay）
- [x] noprocrast アクセス制限（/noprocrast ブロックページ）
- [x] コメント delay フィルタ（サーバーサイド）
- [x] 検索機能（/search、ストーリー+コメントの LIKE 検索、フッター検索欄）
- [x] スレッドクローズ（投稿から14日経過でコメント不可）
- [x] レート制限（投稿10分間隔、コメント2分間隔）
- [x] フラグ・モデレーション（karma>=30 でフラグ可能、5件で dead 自動化、vouch で復活）
- [x] ランキング降格（flag 数で score にペナルティ）
- [x] ユーザー名変更（セルフサービス、90日に1回、過去名は永久ロック、旧URLは301リダイレクト）
- [x] 公開 API v0（読み取り専用 JSON、本家HN /v0/* 互換、#131）

## v2 以降
- ~~フラグ / モデレーション~~ → v1 で実装済み（flag/vouch、dead カラム、ランキング降格）
- ~~パスワードリセット~~ → email 認証が機能しないため廃止 (#90)
- ~~API 公開~~ → v1 で実装済み（/api/v0/* 読み取り専用 JSON、#131）
- 招待制 / カルマ制限
- ダークモード
- ~~favorites 機能~~ → v1 で実装済み
