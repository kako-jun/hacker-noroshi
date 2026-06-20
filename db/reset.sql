-- ローカル D1 を初期化前の空状態に戻すための DROP スクリプト（#166）。
-- db:init / db:seed は CREATE TABLE IF NOT EXISTS で DROP しないため、繰り返すと
-- 行が累積して seed 固定データや ban 残留に依存する e2e が汚染される。
-- `npm run db:reset` で reset.sql → schema.sql → seed.sql の順に流してクリーンにする。
-- 子テーブルから先に落とす必要は SQLite では無い（FK は緩い）が、依存の薄い順に並べておく。
DROP TABLE IF EXISTS ip_login_failures;
DROP TABLE IF EXISTS flags;
DROP TABLE IF EXISTS poll_options;
DROP TABLE IF EXISTS ip_bans;
DROP TABLE IF EXISTS username_history;
DROP TABLE IF EXISTS hidden;
DROP TABLE IF EXISTS favorites;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS votes;
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS stories;
DROP TABLE IF EXISTS users;
