-- 2026-05-06 本番復旧マイグレーション (#109)
--
-- 直近の機能追加 (#76 アカウント削除 / #77 IP ban / #88 username 変更 /
-- #74 poll / #92 自動 ban / #18 hide / favorites) で db/schema.sql は拡張されたが
-- 本番 D1 への適用が抜けており、`getStories` クエリ等が「no such column / table」で
-- 全 500 になっていた。本ファイルを冪等に流すと復旧する。
--
-- 適用方法:
--   wrangler d1 execute hacker-noroshi-db --remote --file=db/migrations/2026-05-recovery.sql
--
-- ALTER TABLE ADD COLUMN は冪等ではない（既存だとエラー）。本ファイルは未適用環境を
-- 想定している。一部適用済みで再実行する場合は、エラーを無視するか個別 SQL を抜粋して流す。

-- ============================================================
-- Tier 1: users カラム追加（500 直接の主犯）
-- ============================================================

ALTER TABLE users ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN deleted_at TEXT;
ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;

-- ============================================================
-- Tier 2: 不足テーブル（CREATE TABLE IF NOT EXISTS で冪等）
-- ============================================================

CREATE TABLE IF NOT EXISTS favorites (
  user_id INTEGER NOT NULL REFERENCES users(id),
  story_id INTEGER NOT NULL REFERENCES stories(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (user_id, story_id)
);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);

CREATE TABLE IF NOT EXISTS hidden (
  user_id INTEGER NOT NULL REFERENCES users(id),
  story_id INTEGER NOT NULL REFERENCES stories(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (user_id, story_id)
);
CREATE INDEX IF NOT EXISTS idx_hidden_user_id ON hidden(user_id);

CREATE TABLE IF NOT EXISTS username_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  old_username TEXT NOT NULL,
  new_username TEXT NOT NULL,
  changed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_username_history_old ON username_history(old_username);
CREATE INDEX IF NOT EXISTS idx_username_history_user ON username_history(user_id);

CREATE TABLE IF NOT EXISTS ip_bans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  banned_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  expires_at TEXT,
  banned_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_ip_bans_ip ON ip_bans(ip);
CREATE INDEX IF NOT EXISTS idx_ip_bans_expires ON ip_bans(expires_at);

CREATE TABLE IF NOT EXISTS ip_login_failures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_ip_login_failures_ip_created ON ip_login_failures(ip, created_at);

CREATE TABLE IF NOT EXISTS poll_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_poll_options_story ON poll_options(story_id);
