-- ハッカーのろし DB Schema

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  karma INTEGER NOT NULL DEFAULT 0,
  about TEXT DEFAULT '',
  email TEXT DEFAULT '',
  delay INTEGER NOT NULL DEFAULT 0,
  noprocrast INTEGER NOT NULL DEFAULT 0,
  maxvisit INTEGER NOT NULL DEFAULT 20,
  minaway INTEGER NOT NULL DEFAULT 180,
  showdead INTEGER NOT NULL DEFAULT 0,
  last_visit TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  -- アカウント削除フラグ（#76）。deleted=1 のとき表示時は [deleted] に置換し、
  -- ログインも拒否する。username は UNIQUE 制約で永久ロックされる（再取得不可）。
  deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS stories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  url TEXT,
  text TEXT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  points INTEGER NOT NULL DEFAULT 1,
  comment_count INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'story' CHECK (type IN ('story', 'ask', 'show')),
  dead INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  story_id INTEGER NOT NULL REFERENCES stories(id),
  parent_id INTEGER REFERENCES comments(id),
  points INTEGER NOT NULL DEFAULT 1,
  dead INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS votes (
  user_id INTEGER NOT NULL REFERENCES users(id),
  item_id INTEGER NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('story', 'comment')),
  vote_type TEXT NOT NULL DEFAULT 'up' CHECK (vote_type IN ('up', 'down')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (user_id, item_id, item_type)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id INTEGER NOT NULL REFERENCES users(id),
  story_id INTEGER NOT NULL REFERENCES stories(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (user_id, story_id)
);

CREATE TABLE IF NOT EXISTS hidden (
  user_id INTEGER NOT NULL REFERENCES users(id),
  story_id INTEGER NOT NULL REFERENCES stories(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (user_id, story_id)
);

CREATE TABLE IF NOT EXISTS username_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  old_username TEXT NOT NULL,
  new_username TEXT NOT NULL,
  changed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS flags (
  user_id INTEGER NOT NULL REFERENCES users(id),
  item_id INTEGER NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('story', 'comment')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (user_id, item_id, item_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hidden_user_id ON hidden(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_created_at ON stories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_type ON stories(type);
CREATE INDEX IF NOT EXISTS idx_stories_user_id ON stories(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_story_id ON comments(story_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_flags_item ON flags(item_id, item_type);
CREATE INDEX IF NOT EXISTS idx_username_history_old ON username_history(old_username);
CREATE INDEX IF NOT EXISTS idx_username_history_user ON username_history(user_id);

-- Migrations (#76 アカウント削除)
-- SQLite/D1 の ALTER TABLE は IF NOT EXISTS をサポートしないため、
-- 既存DBに対しては手動で1度だけ流す。新規セットアップでは上の CREATE TABLE 側で列が定義済み。
-- ALTER TABLE users ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE users ADD COLUMN deleted_at TEXT;
