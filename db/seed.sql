-- Seed data for local development
-- password is "test1234" for all users (bcrypt hash)
-- $2a$10$K4GzQqBq9LZlh9OvBOE6eOqv7GYFv9HZVq3YR6R0HjKq5AXq5GQSy

INSERT INTO users (username, password_hash, karma, about) VALUES
  ('noroshi', '$2a$10$K4GzQqBq9LZlh9OvBOE6eOqv7GYFv9HZVq3YR6R0HjKq5AXq5GQSy', 100, 'ハッカーのろし管理人'),
  ('tanaka', '$2a$10$K4GzQqBq9LZlh9OvBOE6eOqv7GYFv9HZVq3YR6R0HjKq5AXq5GQSy', 42, 'Rustが好き'),
  ('sato', '$2a$10$K4GzQqBq9LZlh9OvBOE6eOqv7GYFv9HZVq3YR6R0HjKq5AXq5GQSy', 15, 'フロントエンド開発者');

INSERT INTO stories (title, url, user_id, points, comment_count, type, created_at) VALUES
  ('Rust 2026 Edition が正式リリース', 'https://blog.rust-lang.org/2026/02/01/rust-2026.html', 1, 45, 3, 'story', strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-2 hours')),
  ('SvelteKit + Cloudflare D1 で個人開発サイトを作った話', 'https://zenn.dev/example/sveltekit-d1', 2, 32, 2, 'story', strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-5 hours')),
  ('Ask HN: 個人開発で使っているデプロイ先は？', NULL, 3, 18, 2, 'ask', strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-8 hours')),
  ('Show HN: riscfetch - RISC-V向けシステム情報表示ツール', 'https://github.com/kako-jun/riscfetch', 1, 28, 1, 'show', strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-1 hours')),
  ('日本語プログラミング言語の歴史', 'https://example.com/jp-prog-history', 2, 12, 0, 'story', strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-24 hours')),
  ('WebAssembly でブラウザ上にLinuxを動かす', 'https://example.com/wasm-linux', 3, 55, 1, 'story', strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-30 minutes'));

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

-- Votes (投稿者は自分の投稿に自動upvote済みなので、他者の投票のみ)
INSERT INTO votes (user_id, item_id, item_type) VALUES
  (2, 1, 'story'), (3, 1, 'story'),
  (1, 2, 'story'), (3, 2, 'story'),
  (1, 3, 'story'), (2, 3, 'story'),
  (2, 4, 'story'), (3, 4, 'story'),
  (1, 6, 'story'), (2, 6, 'story'),
  (1, 1, 'comment'), (3, 1, 'comment'),
  (2, 8, 'comment');
