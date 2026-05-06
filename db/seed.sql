-- Seed data for local development
-- password is "test1234" for all users (bcrypt hash)
-- $2a$10$K4GzQqBq9LZlh9OvBOE6eOqv7GYFv9HZVq3YR6R0HjKq5AXq5GQSy
--
-- Issue #121: 各タブ・各クエリパラメータ・権限分岐を seed 一発で網羅できるように拡充。
-- 既存 user id 1-3 / story id 1-6 は維持（既存テストや手動検証手順との互換性のため）。

-- ────────────────────────────────────────────────────────────────────
-- users（既存 3 + 新規 6 = 9）
--   id 対応: 1=noroshi, 2=tanaka, 3=sato, 4=karma_high, 5=karma_mid,
--            6=karma_low, 7=new_user, 8=old_user, 9=deleted_acc
-- ────────────────────────────────────────────────────────────────────
INSERT INTO users (username, password_hash, karma, about, is_admin) VALUES
  ('noroshi', '$2a$10$K4GzQqBq9LZlh9OvBOE6eOqv7GYFv9HZVq3YR6R0HjKq5AXq5GQSy', 100, 'ハッカーのろし管理人', 1),
  ('tanaka', '$2a$10$K4GzQqBq9LZlh9OvBOE6eOqv7GYFv9HZVq3YR6R0HjKq5AXq5GQSy', 42, 'Rustが好き', 0),
  ('sato', '$2a$10$K4GzQqBq9LZlh9OvBOE6eOqv7GYFv9HZVq3YR6R0HjKq5AXq5GQSy', 15, 'フロントエンド開発者', 0);

-- karma 階層・期間別ユーザー
INSERT INTO users (username, password_hash, karma, about, is_admin, created_at) VALUES
  ('karma_high', '$2a$10$K4GzQqBq9LZlh9OvBOE6eOqv7GYFv9HZVq3YR6R0HjKq5AXq5GQSy', 600, 'downvote 可（karma>=500）', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-90 days')),
  ('karma_mid', '$2a$10$K4GzQqBq9LZlh9OvBOE6eOqv7GYFv9HZVq3YR6R0HjKq5AXq5GQSy', 50, 'flag 可（karma>=30、500未満）', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-60 days')),
  ('karma_low', '$2a$10$K4GzQqBq9LZlh9OvBOE6eOqv7GYFv9HZVq3YR6R0HjKq5AXq5GQSy', 1, 'まだ権限なし', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-10 days')),
  ('new_user', '$2a$10$K4GzQqBq9LZlh9OvBOE6eOqv7GYFv9HZVq3YR6R0HjKq5AXq5GQSy', 2, 'はじめまして', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  ('old_user', '$2a$10$K4GzQqBq9LZlh9OvBOE6eOqv7GYFv9HZVq3YR6R0HjKq5AXq5GQSy', 250, '6ヶ月前に登録', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-180 days'));

-- 削除済みアカウント（[deleted] 表示確認用）
INSERT INTO users (username, password_hash, karma, about, is_admin, deleted, deleted_at, created_at) VALUES
  ('deleted_acc', '$2a$10$K4GzQqBq9LZlh9OvBOE6eOqv7GYFv9HZVq3YR6R0HjKq5AXq5GQSy', 5, '', 0, 1, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-3 days'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-30 days'));

-- ────────────────────────────────────────────────────────────────────
-- stories（既存 6 + 新規 35 = 41）
-- type: story 26 / ask 5 / show 5 / poll 2 + 既存内訳
-- 既存 1-6 は順序維持（id 固定のため）
-- ────────────────────────────────────────────────────────────────────
INSERT INTO stories (title, url, user_id, points, comment_count, type, created_at) VALUES
  ('Rust 2026 Edition が正式リリース', 'https://blog.rust-lang.org/2026/02/01/rust-2026.html', 1, 45, 3, 'story', strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-2 hours')),
  ('SvelteKit + Cloudflare D1 で個人開発サイトを作った話', 'https://zenn.dev/example/sveltekit-d1', 2, 32, 2, 'story', strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-5 hours')),
  ('Ask HN: 個人開発で使っているデプロイ先は？', NULL, 3, 18, 2, 'ask', strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-8 hours')),
  ('Show HN: riscfetch - RISC-V向けシステム情報表示ツール', 'https://github.com/kako-jun/riscfetch', 1, 28, 1, 'show', strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-1 hours')),
  ('日本語プログラミング言語の歴史', 'https://example.com/jp-prog-history', 2, 12, 0, 'story', strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-24 hours')),
  ('WebAssembly でブラウザ上にLinuxを動かす', 'https://example.com/wasm-linux', 3, 55, 1, 'story', strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-30 minutes'));

-- 新規 7-41: 高得点 / 期間分布 / type 分布 / dead / ドメイン重複
INSERT INTO stories (title, url, text, user_id, points, comment_count, type, dead, created_at) VALUES
  -- 高得点 (100+) 5 件 → /best 用 (id 7-11)
  ('SQLite の WAL モードを徹底解説', 'https://example.com/sqlite-wal', NULL, 4, 320, 5, 'story', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-3 days')),
  ('Show HN: 自作 BBS をフルスクラッチで作った', 'https://github.com/example/bbs', NULL, 8, 215, 5, 'show', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-2 days')),
  ('Linux カーネル 7.0 リリースノート', 'https://kernel.org/7.0', NULL, 1, 180, 3, 'story', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-4 days')),
  ('Ask HN: 30代エンジニアのキャリアパス', NULL, '管理職か技術専門職か悩んでいます。みなさんの経験談を聞かせてください。', 8, 145, 5, 'ask', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-6 days')),
  ('TypeScript 6.0 announcement', 'https://github.com/microsoft/TypeScript', NULL, 4, 110, 0, 'story', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-12 hours')),

  -- 直近 1 時間以内: 3 件 (id 12-14)
  ('Hacker Noroshi が seed 充実した', 'https://hn.llll-ll.com', NULL, 7, 2, 0, 'story', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-10 minutes')),
  ('Show HN: 個人で作った Markdown エディタ', 'https://github.com/example/md-editor', NULL, 7, 3, 1, 'show', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-25 minutes')),
  ('Ask HN: 今日のおすすめポッドキャスト', NULL, '通勤中に聞けるエンジニア向けポッドキャストを教えてください。', 5, 4, 0, 'ask', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-50 minutes')),

  -- 1-6 時間前: 10 件 (id 15-24)
  ('Vim 9.2 のニュース', 'https://www.vim.org/news.php', NULL, 2, 38, 1, 'story', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-3 hours')),
  ('Cloudflare Workers の新機能', 'https://blog.cloudflare.com/workers-new', NULL, 4, 42, 2, 'story', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-2 hours')),
  ('PostgreSQL 18 RC', 'https://www.postgresql.org/about/news/18-rc', NULL, 8, 25, 1, 'story', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-4 hours')),
  ('Show HN: tail-match — 物件サイト統合検索', 'https://github.com/kako-jun/tail-match', NULL, 1, 30, 1, 'show', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-5 hours')),
  ('Ask HN: 副業エンジニアが使うタイマーアプリ', NULL, 'ポモドーロを定着させたいです。おすすめあれば。', 5, 14, 0, 'ask', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-2 hours')),
  ('Bun 1.5 リリース', 'https://bun.sh/blog/bun-v1.5', NULL, 4, 48, 2, 'story', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-3 hours')),
  ('Deno 2.5 が KV 強化', 'https://deno.com/blog/v2.5', NULL, 3, 22, 0, 'story', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-6 hours')),
  ('GitHub Actions の新しいキャッシュ戦略', 'https://github.com/actions/cache', NULL, 2, 18, 0, 'story', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-5 hours')),
  ('Show HN: 占いアプリ作った', 'https://zenn.dev/example/uranai', NULL, 8, 11, 0, 'show', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-4 hours')),
  ('Tailscale で家の NAS に外から繋ぐ', 'https://tailscale.com/blog/nas', NULL, 4, 35, 1, 'story', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-3 hours')),

  -- 1-7 日前: 15 件 (id 25-39)
  ('Go 1.27 の generics 改善', 'https://go.dev/blog/generics-1.27', NULL, 4, 28, 0, 'story', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-1 days')),
  ('Ask HN: モニター何枚使ってますか', NULL, 'デスク広くないので 2 枚で迷っています。', 6, 9, 0, 'ask', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-2 days')),
  ('Linux で Wayland に乗り換えた', 'https://example.com/wayland', NULL, 2, 21, 1, 'story', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-3 days')),
  ('VSCode 拡張開発ガイド', 'https://github.com/microsoft/vscode-docs', NULL, 5, 17, 0, 'story', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-4 days')),
  ('Web フォントの最適化', 'https://zenn.dev/example/web-font', NULL, 3, 13, 0, 'story', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-3 days')),
  ('SvelteKit 2.x の更新点', 'https://kit.svelte.dev/docs', NULL, 8, 19, 0, 'story', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-5 days')),
  ('CSS :has() の実例集', 'https://example.com/css-has', NULL, 3, 16, 0, 'story', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-2 days')),
  ('低位投稿: 何かに役に立つかも', 'https://example.com/low-1', NULL, 6, 1, 0, 'story', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-6 days')),
  ('低位投稿: ニッチネタ', 'https://example.com/low-2', NULL, 6, 2, 0, 'story', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-5 days')),
  ('低位投稿: 個人メモ', 'https://example.com/low-3', NULL, 5, 3, 0, 'story', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-4 days')),
  ('低位投稿: 日記', 'https://example.com/low-4', NULL, 6, 1, 0, 'story', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-3 days')),
  ('低位投稿: 雑談', 'https://example.com/low-5', NULL, 5, 2, 0, 'story', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-2 days')),
  -- dead 投稿（showdead=1 ユーザーで表示確認）
  ('Spam 的に見える投稿', 'https://spam.example.com/buy-now', NULL, 6, 0, 0, 'story', 1, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-2 days')),
  ('Dead Show HN: 削除済みのデモ', 'https://example.com/dead-show', NULL, 9, 0, 0, 'show', 1, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-1 days')),
  ('日本語タイトルのみ・URL 無し', NULL, '本文のみの story 系投稿（type=story, url=NULL）。', 8, 4, 0, 'story', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-1 days')),

  -- 30 日以上前: 5 件 → /front?day= 用 (id 40-44)
  ('過去記事: Cloud Native Days 2025', 'https://example.com/cnd2025', NULL, 1, 64, 0, 'story', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-45 days')),
  ('過去記事: Rust 1.80 の話', 'https://blog.rust-lang.org/2025/rust-1.80', NULL, 4, 78, 0, 'story', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-60 days')),
  ('過去記事: Vim 9.0 のメモ', 'https://www.vim.org/news.php?9.0', NULL, 2, 41, 0, 'story', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-90 days')),
  ('過去記事: GitHub のセキュリティ機能', 'https://github.com/security', NULL, 8, 33, 0, 'story', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-120 days')),
  ('過去記事: Cloudflare Pages の制限まとめ', 'https://developers.cloudflare.com/pages/limits', NULL, 3, 27, 0, 'story', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-150 days'));

-- poll 2 件（id 45, 46）— poll_options で参照する
INSERT INTO stories (title, text, user_id, points, comment_count, type, dead, created_at) VALUES
  ('好きなエディタは？', 'みなさんが普段使っているエディタを教えてください。', 1, 56, 0, 'poll', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-1 days')),
  ('使ってる JS フレームワークは？', '個人開発で実際に手が動く順で投票してください。', 2, 38, 0, 'poll', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-2 days'));

-- ────────────────────────────────────────────────────────────────────
-- poll_options
-- 上記 2 件の poll は story id 45 / 46（既存 6 + 新規 38 + poll 2 = 46）
-- ────────────────────────────────────────────────────────────────────
INSERT INTO poll_options (story_id, text, position) VALUES
  (45, 'Vim / Neovim', 1),
  (45, 'Emacs', 2),
  (45, 'VSCode', 3),
  (45, 'JetBrains 系', 4),
  (45, 'その他', 5),
  (46, 'SvelteKit', 1),
  (46, 'Next.js', 2),
  (46, 'Nuxt', 3),
  (46, 'Astro', 4);

-- ────────────────────────────────────────────────────────────────────
-- comments（既存 9 + 新規 35 = 44）
--   高得点 (5+) 多め、深ネスト 5 段、dead 1-2、author 分散
-- ────────────────────────────────────────────────────────────────────
INSERT INTO comments (text, user_id, story_id, parent_id, points, created_at) VALUES
  ('Rust 2026、async周りがかなり改善されていて嬉しい', 2, 1, NULL, 8, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-1 hours')),
  ('特にasync closureが安定化されたのが大きいですね', 3, 1, 1, 5, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-45 minutes')),
  ('GAT使ってる人いますか？', 1, 1, NULL, 3, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-30 minutes')),
  ('D1のパフォーマンスどうですか？本番で使える？', 1, 2, NULL, 6, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-4 hours')),
  ('小規模なら全然問題ないです。無料枠も十分', 2, 2, 4, 4, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-3 hours')),
  ('Cloudflare Workers使ってます。無料枠が神', 1, 3, NULL, 7, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-7 hours')),
  ('Vercel + PlanetScale の組み合わせが多い印象', 2, 3, NULL, 5, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-6 hours')),
  ('RISC-Vで動くの面白い！Orange Pi持ってるので試してみます', 3, 4, NULL, 4, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-30 minutes')),
  ('これすごい。ブラウザの中でsystemd動いてて笑った', 1, 6, NULL, 9, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-15 minutes'));

-- 新規 10-44
INSERT INTO comments (text, user_id, story_id, parent_id, points, dead, created_at) VALUES
  -- story 7 (SQLite WAL) — highlights 用に高得点コメントを集中（comment_count>=3 + points>=5）
  ('WAL 周りの解説、production の地雷ポイントまで踏み込んでて参考になった', 4, 7, NULL, 18, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-3 days')),
  ('checkpoint の挙動が特に勉強になりました', 8, 7, 10, 12, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-3 days')),
  ('長時間トランザクションを避けるのが大事ですね', 2, 7, 11, 9, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-2 days')),
  ('journal_mode=WAL の前に PRAGMA synchronous も触ること', 1, 7, NULL, 15, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-2 days')),
  ('NORMAL で良いケース教えてください', 3, 7, 13, 7, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-2 days')),

  -- story 8 (BBS) — 深ネスト 5 段（id 15→16→17→18→19）
  ('自作 BBS いいですね、HTTP は何で書きましたか', 3, 8, NULL, 11, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-2 days')),
  ('std::net::TcpListener から自作してます', 8, 8, 15, 9, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-2 days')),
  ('keep-alive 対応はどうしてますか？', 2, 8, 16, 6, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-2 days')),
  ('Connection ヘッダで分岐して TCP を使い回しています', 8, 8, 17, 5, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-1 days')),
  ('そこまでやってるの本格的すぎでは', 4, 8, 18, 8, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-1 days')),

  -- story 9 (Linux 7.0)
  ('mainline 7.0 でた、busy', 5, 9, NULL, 14, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-4 days')),
  ('スケジューラ周りの変更が気になる', 4, 9, 20, 10, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-4 days')),
  ('LTS は 6.x のままなので、業務向けはまだ追わなくて良さそう', 8, 9, NULL, 13, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-3 days')),

  -- story 10 (Ask HN: キャリア)
  ('技術専門職で続けるのは年齢的に厳しい現場もあるが、楽しさで選ぶのは正解', 4, 10, NULL, 22, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-6 days')),
  ('副業 + 本業 で両建てが安全策', 1, 10, NULL, 16, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-5 days')),
  ('管理職経由で技術に戻った人もいる', 8, 10, 24, 11, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-5 days')),
  ('海外も視野に入れると選択肢広い', 3, 10, NULL, 9, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-5 days')),
  ('career advice: 続けたいことを毎月手で書く', 5, 10, NULL, 5, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-5 days')),

  -- karma_high が他人のコメントへ反論する文脈
  ('それ言うなら GAT の話に戻したい', 4, 1, 3, 6, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-25 minutes')),

  -- 中位 / 通常コメント
  ('Vim 9.2 の dictionary 改善は大きい', 5, 15, NULL, 4, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-2 hours')),
  ('Workers の Durable Objects 推し', 1, 16, NULL, 4, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-2 hours')),
  ('Workers KV と D1 の使い分け教えてください', 2, 16, 30, 3, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-1 hours')),
  ('Bun の bundler 速くて感動', 5, 20, NULL, 3, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-2 hours')),
  ('Bun の Node 互換まだ穴ある', 8, 20, 32, 2, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-2 hours')),
  ('PostgreSQL 18 の merge 文最高', 4, 17, NULL, 3, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-3 hours')),
  ('tail-match の使い心地どうですか', 6, 18, NULL, 2, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-4 hours')),
  ('Tailscale Funnel が便利', 3, 24, NULL, 4, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-2 hours')),
  ('Wayland、ATOK で困らなくなった', 8, 27, NULL, 3, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-2 days')),

  -- フェード（points 0 以下 → downvote 表示確認）
  ('意味の薄い書き込み (downvoted)', 6, 11, NULL, 0, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-12 hours')),
  ('荒らし気味コメント (downvoted)', 6, 12, NULL, -2, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-1 days')),
  ('単発の no content', 6, 13, NULL, 0, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-30 minutes')),

  -- dead コメント（showdead 表示確認）
  ('flagged spam comment', 6, 7, NULL, 0, 1, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-2 days')),
  ('自動 ban 直前の暴言', 9, 9, NULL, -1, 1, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-3 days')),

  -- new_user / karma_low の通常コメント
  ('はじめて投稿してみました', 7, 13, NULL, 1, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-30 minutes')),
  ('Markdown エディタ、ローカル保存対応してますか？', 2, 13, NULL, 2, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-15 minutes'));

-- ────────────────────────────────────────────────────────────────────
-- votes（投稿者は自分の投稿に自動 upvote 済みなので、他者の投票のみ）
-- 既存 13 + 新規 30+ = 43+
-- ────────────────────────────────────────────────────────────────────
INSERT INTO votes (user_id, item_id, item_type) VALUES
  -- 既存
  (2, 1, 'story'), (3, 1, 'story'),
  (1, 2, 'story'), (3, 2, 'story'),
  (1, 3, 'story'), (2, 3, 'story'),
  (2, 4, 'story'), (3, 4, 'story'),
  (1, 6, 'story'), (2, 6, 'story'),
  (1, 1, 'comment'), (3, 1, 'comment'),
  (2, 8, 'comment'),
  -- 新規 story upvote (story 7-46 中心に分散)
  (4, 7, 'story'), (8, 7, 'story'), (1, 7, 'story'), (2, 7, 'story'), (3, 7, 'story'),
  (1, 8, 'story'), (4, 8, 'story'), (2, 8, 'story'),
  (4, 9, 'story'), (8, 9, 'story'), (5, 9, 'story'),
  (4, 10, 'story'), (1, 10, 'story'),
  (2, 11, 'story'), (3, 11, 'story'),
  (4, 15, 'story'),
  (1, 16, 'story'), (8, 16, 'story'),
  (3, 20, 'story'), (5, 20, 'story'),
  (4, 24, 'story'),
  (1, 45, 'story'), (4, 45, 'story'), (8, 45, 'story'),
  (1, 46, 'story'), (3, 46, 'story'),
  -- 新規 comment upvote
  (1, 10, 'comment'), (8, 10, 'comment'),
  (1, 13, 'comment'), (4, 13, 'comment'),
  (4, 23, 'comment'), (8, 23, 'comment'), (1, 23, 'comment'),
  (4, 24, 'comment'),
  (1, 19, 'comment'), (3, 19, 'comment');

-- karma_high (id=4) からの downvote (5 件) → vote_type='down'
-- 注: 上記の (4, 13, 'comment') / (4, 24, 'comment') は up なので別 item を down に
INSERT INTO votes (user_id, item_id, item_type, vote_type) VALUES
  (4, 38, 'comment', 'down'),
  (4, 39, 'comment', 'down'),
  (4, 40, 'comment', 'down'),
  (4, 35, 'story', 'down'),
  (4, 36, 'story', 'down');

-- poll_option への up vote
INSERT INTO votes (user_id, item_id, item_type) VALUES
  (1, 1, 'poll_option'),  -- noroshi → Vim
  (2, 3, 'poll_option'),  -- tanaka  → VSCode
  (3, 3, 'poll_option'),  -- sato    → VSCode
  (4, 1, 'poll_option'),  -- karma_high → Vim
  (8, 2, 'poll_option'),  -- old_user   → Emacs
  (1, 6, 'poll_option'),  -- noroshi → SvelteKit
  (2, 6, 'poll_option'),  -- tanaka  → SvelteKit
  (4, 7, 'poll_option');  -- karma_high → Next.js

-- ────────────────────────────────────────────────────────────────────
-- hidden（tanaka が 3 件 hide）
-- ────────────────────────────────────────────────────────────────────
INSERT INTO hidden (user_id, story_id) VALUES
  (2, 4),   -- riscfetch (Show HN)
  (2, 11),  -- TypeScript 6.0
  (2, 27);  -- Wayland

-- ────────────────────────────────────────────────────────────────────
-- favorites（sato が 3 件 favorite）
-- ────────────────────────────────────────────────────────────────────
INSERT INTO favorites (user_id, story_id) VALUES
  (3, 1),   -- Rust 2026
  (3, 7),   -- SQLite WAL
  (3, 9);   -- Linux 7.0

-- ────────────────────────────────────────────────────────────────────
-- ip_bans（過去 expire 済み 1 件のみ。active な ban は無し）
-- ────────────────────────────────────────────────────────────────────
INSERT INTO ip_bans (ip, reason, banned_at, expires_at, banned_by) VALUES
  ('203.0.113.42', 'expired test ban', strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-2 days'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-1 days'), 1);
