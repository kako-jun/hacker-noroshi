# テスト

ハッカーのろしのテスト構成と実行方法。

## テスト種別

| 種別 | フレームワーク | 場所 | 用途 |
|---|---|---|---|
| Unit | Vitest | `tests/unit/` | 純粋関数・ロジックの検証 |
| E2E | Playwright | `tests/e2e/` | 認証・投稿・投票等のフロー検証 |

## 実行方法

### Unit (Vitest)

```bash
npm test           # 1回実行
npm run test:watch # ファイル変更で再実行
```

依存: なし（純粋関数のみ）。CI でも自動実行される（`.github/workflows/test.yml`）。

### E2E (Playwright)

```bash
npm run test:e2e        # ヘッドレス実行
npm run test:e2e:ui     # UI モード（インタラクティブ）
```

依存:
- ローカルで dev server (`npm run dev`) が起動できること
- ローカル D1 データベースが初期化されていること:
  ```bash
  npm run db:init  # スキーマ作成
  npm run db:seed  # シードデータ投入
  ```

CI では現状 **実行しない**（D1 のセットアップが複雑なため）。将来 `wrangler dev` を CI で起動する仕組みを整えたら有効化する。

## カバレッジ

### Unit
- `calculateScore` — ランキング算出（時間・ポイント・フラグ数）
- `timeAgo` — 相対時刻表示
- `extractDomain` — URL からドメイン抽出
- `isNewUser` `isThreadOpen` — 14日閾値判定
- `formatText` — XSS エスケープ・自動リンク・イタリック
- `hashPassword` `verifyPassword` — Web Crypto ベースの認証
- レート制限の閾値計算（`isRateLimited` ロジックピン）

### E2E
- 認証フロー（signup → logout → login）
- ログイン失敗エラー表示
- 投稿フロー
- 投票フロー

## 新しいテストを追加するとき

### Unit
1. 対象が **純粋関数** か確認（DB/ネットワーク依存があれば E2E へ）
2. `tests/unit/` に `<name>.test.ts` を追加
3. `vitest.config.ts` の `include` パターンに自動マッチ

### E2E
1. `tests/e2e/<name>.spec.ts` を追加
2. ユーザー作成等の共通処理は `tests/e2e/helpers.ts` を流用
3. 各テストは独立して動くようにする（順序依存禁止）

## 既知の課題（Refactor candidates）

- レート制限ロジックが `+page.server.ts` に inline 散在 → 共通ヘルパー化したい (#61 で観察)
- E2E テストの DB は実 D1 ローカルなのでテスト同士で状態が混ざる → トランザクション分離 or テスト用 schema コピー
- 14日閾値の定数が `src/lib/ranking.ts` に集約済みだが、SQL 側 (`getStoriesByNewUsers` 等) では文字列計算 → 共通の閾値生成ヘルパーが欲しい

## CI

`.github/workflows/test.yml` で以下を実行:

- `npm ci`
- `npm run prepare`（SvelteKit sync）
- `npm test`（vitest unit）
- `npm run check`（型チェック、現状 main 由来の既存エラー 8件があるため `continue-on-error: true`）

PR ごと・main への push で自動実行される。
