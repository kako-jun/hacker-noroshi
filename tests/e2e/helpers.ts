import type { Page } from '@playwright/test';

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
