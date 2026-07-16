import type { Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

/**
 * Generate a unique-ish username (3-15 chars, alnum/underscore/hyphen).
 */
export function uniqueUsername(prefix = 'e2e'): string {
	const suffix = Math.random().toString(36).slice(2, 8);
	const name = `${prefix}_${suffix}`.slice(0, 15);
	return name;
}

/**
 * Sign up a fresh user via the /login page's "Create Account" form
 * and return their username. Leaves the browser logged in.
 */
export async function signupNewUser(page: Page, password = 'test1234'): Promise<string> {
	const username = uniqueUsername();
	await page.goto('/login');
	// hydration 待ち: enhance ハンドラが付くまで click すると、ブラウザがネイティブ
	// に submit し JSON レスポンスをそのまま表示してしまうことがある（既存 spec が
	// 稀に flake する原因）。ボタンが visible になり、networkidle になるまで待つ。
	await page.waitForLoadState('networkidle');
	const signupForm = page.locator('form[action="?/signup"]');
	await signupForm.locator('input[name="username"]').fill(username);
	await signupForm.locator('input[name="password"]').fill(password);
	await signupForm.locator('button[type="submit"]').click();
	await page.waitForURL('/', { timeout: 30_000 });
	return username;
}

/**
 * Submit a story (URL or text) via /submit. Returns the item id parsed from
 * the redirected URL (typically /newest).
 *
 * Submitter is whoever the page is currently logged in as.
 */
export async function submitStory(
	page: Page,
	{ title, url, text }: { title: string; url?: string; text?: string }
): Promise<void> {
	await page.goto('/submit');
	// hydration を待ってからフォーム操作。ネイティブ submit による JSON
	// レスポンス表示で navigation が止まるのを防ぐ。
	await page.waitForLoadState('networkidle');
	await page.fill('input[name="title"]', title);
	if (url) await page.fill('input[name="url"]', url);
	if (text) await page.fill('textarea[name="text"]', text);
	await page.click('button[type="submit"]');
	await page.waitForURL((u) => !u.pathname.startsWith('/submit'), { timeout: 30_000 });
}

/**
 * From /newest (or any list page already loaded), find a story-item by title
 * and return the item id from its first /item/N link.
 */
export async function findStoryIdByTitle(page: Page, title: string): Promise<number> {
	const item = page
		.locator('.story-item')
		.filter({ has: page.locator('a.story-title', { hasText: title }) })
		.first();
	const href = await item.locator('a[href^="/item/"]').first().getAttribute('href');
	if (!href) throw new Error(`Could not find /item/N href for "${title}"`);
	const m = href.match(/\/item\/(\d+)/);
	if (!m) throw new Error(`Bad /item href: ${href}`);
	return Number(m[1]);
}

/**
 * Post a top-level comment on a story item page. Assumes already at /item/{id}.
 */
export async function postComment(page: Page, text: string): Promise<void> {
	const form = page.locator('form[action="?/comment"]').first();
	await form.locator('textarea[name="text"]').fill(text);
	await form.locator('button[type="submit"]').click();
}

/**
 * Reply to an existing comment (nest depth 2). Clicks the comment's "reply" link
 * to open the inline reply form, fills text, and submits. Assumes already at
 * /item/{storyId} and that the target comment is rendered.
 */
export async function replyToComment(
	page: Page,
	commentLocator: ReturnType<Page['locator']>,
	text: string
): Promise<void> {
	// 単数 comment の reply リンクをクリック → form 出現を待つ
	await commentLocator.locator('.comment-reply a', { hasText: /^reply$/ }).first().click();
	const replyForm = commentLocator.locator('form[action="?/comment"]').first();
	await replyForm.locator('textarea[name="text"]').fill(text);
	await replyForm.locator('button[type="submit"]').click();
}

/**
 * Click "delete account" with the password and accept the JS confirm dialog.
 * Must already be at /user/{username}. Returns when navigation completed.
 */
export async function deleteAccount(page: Page, password: string): Promise<void> {
	page.once('dialog', (d) => d.accept());
	const form = page.locator('form[action="?/deleteAccount"]');
	await form.locator('input[name="password"]').fill(password);
	await Promise.all([
		page.waitForURL('/', { timeout: 15_000 }).catch(() => {}),
		form.locator('button[type="submit"]').click()
	]);
}

/**
 * Issue #122 helpers.
 *
 * 既存 seed (db/seed.sql) で用意されたユーザー（noroshi / tanaka / sato /
 * karma_high / karma_mid / karma_low / new_user / old_user / deleted_acc）で
 * /login の loginForm を踏んでログインする。`/` への遷移を待つ。
 *
 * 失敗（Bad login など）した場合は呼び元に判定させたいので URL 移動を強制しない。
 */
export async function loginAs(
	page: Page,
	username: string,
	password = 'test1234'
): Promise<void> {
	await page.goto('/logout').catch(() => {});
	await page.goto('/login');
	await page.waitForLoadState('networkidle');
	const loginForm = page.locator('form[action="?/login"]');
	await loginForm.locator('input[name="username"]').fill(username);
	await loginForm.locator('input[name="password"]').fill(password);
	await Promise.all([
		page.waitForURL('/', { timeout: 15_000 }).catch(() => {}),
		loginForm.locator('button[type="submit"]').click()
	]);
}

/**
 * `wrangler d1 execute hacker-noroshi-db --local --command 'SQL'` を実行する。
 * テストから直接 D1 を叩くためのユーティリティ。
 */
export function runD1(command: string): void {
	execFileSync(
		'npx',
		['wrangler', 'd1', 'execute', 'hacker-noroshi-db', '--local', '--command', command],
		{ cwd: process.cwd(), stdio: 'pipe', timeout: 30_000 }
	);
}

/**
 * 指定 story の created_at を hoursAgo 時間前に書き換える。編集ウィンドウ
 * 境界（2 時間）テスト用。
 */
export function setStoryCreatedAt(storyId: number, hoursAgo: number): void {
	runD1(
		`UPDATE stories SET created_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-${hoursAgo} hours') WHERE id = ${storyId}`
	);
}

/**
 * 指定 comment の created_at を hoursAgo 時間前に書き換える。編集ウィンドウ
 * 境界テスト用。
 */
export function setCommentCreatedAt(commentId: number, hoursAgo: number): void {
	runD1(
		`UPDATE comments SET created_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-${hoursAgo} hours') WHERE id = ${commentId}`
	);
}

/**
 * 既存ユーザーの karma を直接書き換える。#122 E2E で karma 階層別の権限分岐
 * (flag: karma>=30 / downvote: karma>=500) を確認するために使う。
 *
 * NOTE: seed.sql の bcrypt password_hash は `salt:sha256hex` 形式の verifyPassword
 * と非互換 (#125) で seed user の login が事実上 Bad login になる。そのため
 * #122 では signupNewUser で新規作成 → updateUserKarma で karma を引き上げ、
 * という流れに切り替えている。
 */
export function updateUserKarma(username: string, karma: number): void {
	const escaped = username.replace(/'/g, "''");
	runD1(`UPDATE users SET karma = ${karma} WHERE username = '${escaped}'`);
}

/**
 * 既存ユーザーを admin に昇格させる（#125 回避のため signupNewUser 経由）。
 */
export function promoteToAdmin(username: string): void {
	const escaped = username.replace(/'/g, "''");
	runD1(`UPDATE users SET is_admin = 1 WHERE username = '${escaped}'`);
}

/**
 * IP ban 系テストの後始末。`ip_bans` と `ip_login_failures` を全消去する。
 * afterAll で必ず呼び出して後続 spec を ban で巻き込まないようにする。
 */
export function cleanIpBans(): void {
	try {
		runD1('DELETE FROM ip_bans; DELETE FROM ip_login_failures;');
	} catch (e) {
		console.warn('[cleanIpBans] failed', e);
	}
}

/**
 * `wrangler d1 execute ... --json` を実行し、SELECT 結果行の配列を返す。
 * runD1 は戻り値を捨てる fire-and-forget 用途のため、値を読みたいクエリ用に別関数として用意する。
 * 施設内プロキシ下では "Proxy environment variables detected." 等の前置きが出力に混じるため、
 * `[` から末尾までの JSON 部分だけ切り出してパースする（#179 で新規追加）。
 * NOTE: api-v0.spec.ts の fetchD1Scalar() が同種の wrangler 呼び出し + JSON 切り出しロジックを
 * 独自実装のまま持っており、本関数へは未統合（統合は別スコープ）。
 */
export function queryD1Rows<T = Record<string, unknown>>(sql: string): T[] {
	const out = execFileSync(
		'npx',
		['wrangler', 'd1', 'execute', 'hacker-noroshi-db', '--local', '--json', '--command', sql],
		{ cwd: process.cwd(), stdio: 'pipe', timeout: 30_000 }
	).toString();
	const start = out.indexOf('[');
	if (start < 0) throw new Error(`No JSON in wrangler output: ${out}`);
	const parsed = JSON.parse(out.slice(start));
	return (parsed[0]?.results ?? []) as T[];
}

/**
 * 既存ユーザーの showdead を直接書き換える（#179）。updateUserKarma と同じ流儀。
 * UI（プロフィール画面のフォーム）経由の変更フロー自体を確認したいテストは
 * 代わりに setShowDeadViaProfile を使うこと。
 */
export function setUserShowdead(username: string, value: 0 | 1): void {
	const escaped = username.replace(/'/g, "''");
	runD1(`UPDATE users SET showdead = ${value} WHERE username = '${escaped}'`);
}

/**
 * 現在ログイン中ユーザーの showdead 設定を /user/{username} のプロフィール画面
 * フォーム（action="?/update"）から変更する（#179 E11: 設定変更フロー自体の検証用）。
 * about/delay 等の他フィールドは既存値のまま送信されるため副作用は無い。
 */
export async function setShowDeadViaProfile(
	page: Page,
	username: string,
	value: 'yes' | 'no'
): Promise<void> {
	await page.goto(`/user/${username}`);
	await page.waitForLoadState('networkidle');
	const form = page.locator('form[action="?/update"]');
	await form.locator('select[name="showdead"]').selectOption(value);
	await form.locator('button[type="submit"]').click();
	await page.waitForLoadState('networkidle');
}

/**
 * ログイン中のページから `page.evaluate` 経由で /api/flag を叩く（#179）。
 * UI クリックを介さないため、複数ユーザーでの一括 flag シナリオ（flagItemNTimes）を
 * 高速化するための土台。呼び出し前に該当ユーザーとしてログイン済みであること。
 */
export async function flagAsUser(
	page: Page,
	itemId: number,
	itemType: 'story' | 'comment'
): Promise<{ flagged: boolean; flagCount: number; dead: boolean }> {
	return page.evaluate(
		async ({ itemId, itemType }) => {
			const res = await fetch('/api/flag', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ itemId, itemType })
			});
			return res.json();
		},
		{ itemId, itemType }
	);
}

/**
 * n人の異なる新規ユーザー（karma=30 に引き上げ済み）で item を順に flag する（#179）。
 * DEAD_FLAG_THRESHOLD を跨ぐシナリオ（n件目で自動 dead 化）を UI クリック無しで
 * 高速に再現するための一括ヘルパ。内部で signupNewUser → updateUserKarma(30) →
 * flagAsUser を n 回ループする。最後の flag 呼び出しのレスポンスを返す
 * （n が閾値を超えていれば dead:true が返る）。
 *
 * 呼び出し後、ページは n 人目の flagger としてログインした状態のまま残る。
 */
export async function flagItemNTimes(
	page: Page,
	itemId: number,
	itemType: 'story' | 'comment',
	n: number
): Promise<{ flagged: boolean; flagCount: number; dead: boolean }> {
	let last: { flagged: boolean; flagCount: number; dead: boolean } | null = null;
	for (let i = 0; i < n; i++) {
		await page.goto('/logout').catch(() => {});
		const username = await signupNewUser(page);
		updateUserKarma(username, 30);
		await page.goto('/');
		last = await flagAsUser(page, itemId, itemType);
	}
	if (!last) throw new Error('flagItemNTimes called with n <= 0');
	return last;
}

/** flags テーブルの該当 item の行数を返す（#179）。 */
export function getFlagCount(itemId: number, itemType: 'story' | 'comment'): number {
	const rows = queryD1Rows<{ n: number }>(
		`SELECT COUNT(*) AS n FROM flags WHERE item_id = ${itemId} AND item_type = '${itemType}'`
	);
	return rows.length ? Number(rows[0].n) : 0;
}

/** stories/comments の dead 値 (0|1) を返す（#179）。該当行が無ければ throw する。 */
export function getItemDeadState(table: 'stories' | 'comments', itemId: number): number {
	const rows = queryD1Rows<{ dead: number }>(`SELECT dead FROM ${table} WHERE id = ${itemId}`);
	if (rows.length === 0) throw new Error(`No row in ${table} with id ${itemId}`);
	return Number(rows[0].dead);
}
