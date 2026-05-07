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
