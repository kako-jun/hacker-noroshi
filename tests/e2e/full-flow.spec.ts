/**
 * Issue #105: full-flow E2E.
 *
 * v1 リリース前の最終確認として、本サイトの主要フローを 4 シナリオに
 * 分けてシリアルに通す。playwright.config.ts は既に workers=1 のため、
 * シナリオ間の干渉は IP ban シナリオ C のみ気にすればよい。
 *
 * シナリオ C （連続失敗 → /ipban）はプロセスの IP に対して 1h ban を
 * 残す。後続テストへの影響を避けるため最後に置く。
 */

import { test, expect, type Page } from '@playwright/test';
import {
	signupNewUser,
	uniqueUsername,
	submitStory,
	findStoryIdByTitle,
	postComment
} from './helpers';

// dev サーバー初回コンパイルや bcrypt の待ちが入るため、デフォルトの 30s では
// 各シナリオで signup * 複数回 + 編集多段でぎりぎり。各テストとも 120s に拡張する。
test.setTimeout(120_000);

/**
 * use:enhance のフォームを submit する小さなヘルパ。click 前に hydration を
 * 待ち、submit 後にコンテンツ変化（reload / invalidateAll）まで待つ。
 */
async function submitForm(page: Page, submitClick: () => Promise<void>) {
	await page.waitForLoadState('networkidle');
	await submitClick();
	// invalidateAll() が走り終わるのを待つ
	await page.waitForLoadState('networkidle');
}

// ────────────────────────────────────────────────────────────────────
// シナリオ A: 投稿者目線
// ────────────────────────────────────────────────────────────────────
test.describe.serial('A: 投稿者目線', () => {
	test('story 投稿 → 編集 → コメント → 編集 → 削除 → about → submissions/comments → story 削除', async ({
		page
	}) => {
		const username = await signupNewUser(page);

		// 1+2. /submit から URL story 投稿 → /newest に出る
		const ts = Date.now();
		const title = `E2E A url story ${ts}`;
		const url = `https://example.com/e2e-a-${ts}`;
		await submitStory(page, { title, url });

		await page.goto('/newest');
		await expect(
			page.locator('a.story-title', { hasText: title }).first()
		).toBeVisible();

		// 3. /item/[id] で title 編集 → 反映確認
		const storyId = await findStoryIdByTitle(page, title);
		await page.goto(`/item/${storyId}`);
		await page.waitForLoadState('networkidle');
		// item-meta 内の story 編集 "edit" リンク（最初の #edit）をクリック
		await page.locator('.item-meta a[href="#edit"]').first().click();
		const newTitle = `${title} (edited)`;
		const editForm = page.locator('form[action="?/editStory"]');
		await editForm.locator('input[name="title"]').fill(newTitle);
		await submitForm(page, () => editForm.locator('button[type="submit"]').click());
		await expect(page.locator('.item-title', { hasText: newTitle })).toBeVisible();

		// 4. コメント投稿 → 表示確認
		const commentText = `E2E A comment ${ts}`;
		await postComment(page, commentText);
		await page.waitForLoadState('networkidle');
		await expect(
			page.locator('.comment-text p', { hasText: commentText }).first()
		).toBeVisible();

		// 5. コメント編集 → 反映確認。
		// 単一コメントしか無い前提で、最初の comment-item の edit リンクを使う。
		const commentItem = page.locator('.comment-item').first();
		await commentItem.locator('.comment-reply a', { hasText: /^edit$/ }).click();
		const commentEditForm = commentItem.locator('form[action="?/editComment"]');
		await expect(commentEditForm).toBeVisible();
		const editedComment = `${commentText} EDITED`;
		await commentEditForm.locator('textarea[name="text"]').fill(editedComment);
		await submitForm(page, () => commentEditForm.locator('button[type="submit"]').click());
		await expect(
			page.locator('.comment-text p', { hasText: editedComment }).first()
		).toBeVisible();

		// 6. コメント削除 → [deleted] 表示
		page.once('dialog', (d) => d.accept());
		await page
			.locator('.comment-item')
			.first()
			.locator('form[action="?/deleteComment"] button[type="submit"]')
			.click();
		await page.waitForLoadState('networkidle');
		await expect(
			page.locator('.comment-text p', { hasText: '[deleted]' }).first()
		).toBeVisible({ timeout: 15_000 });

		// 7. /user/[id] で about 編集 → 反映確認
		const aboutText = `E2E A about ${ts}`;
		await page.goto(`/user/${username}`);
		await page.waitForLoadState('networkidle');
		await page.locator('textarea[name="about"]').fill(aboutText);
		await submitForm(page, () =>
			page.locator('form[action="?/update"] button[type="submit"]').click()
		);
		// 同じパスへ goto しても use:enhance のフォームリセットや SvelteKit の
		// クライアントキャッシュで textarea 値が空のまま見えるケースがある。
		// 別ページを挟んでから戻り、サーバー load をフレッシュに走らせる。
		await page.goto('/');
		await page.goto(`/user/${username}`);
		await page.waitForLoadState('networkidle');
		await expect(page.locator('textarea[name="about"]')).toHaveValue(aboutText, { timeout: 10_000 });

		// 8. /user/[id]/submissions に投稿が出る
		await page.goto(`/user/${username}/submissions`);
		await expect(page.locator('a.story-title', { hasText: newTitle }).first()).toBeVisible();

		// 9. /user/[id]/comments にコメントが出る（[deleted] 化済みだが行は残る）
		// この画面は .comment-item クラスを使わない（plain div ラップ）。
		// .comment-head の存在で判定する。
		await page.goto(`/user/${username}/comments`);
		await expect(page.locator('.comment-head').first()).toBeVisible();

		// 10. ストーリー削除 → [deleted] 化確認
		await page.goto(`/item/${storyId}`);
		await page.waitForLoadState('networkidle');
		page.once('dialog', (d) => d.accept());
		await page.locator('form[action="?/deleteStory"] button[type="submit"]').click();
		await page.waitForLoadState('networkidle');
		await page.goto(`/item/${storyId}`);
		const bodyText = await page.locator('body').innerText();
		expect(bodyText).toContain('[deleted]');
	});
});

// ────────────────────────────────────────────────────────────────────
// シナリオ B: コミュニティ目線
// ────────────────────────────────────────────────────────────────────
test.describe.serial('B: コミュニティ目線', () => {
	test('upvote / hide / favorite / search / 各タブの GET 200', async ({ page }) => {
		// 1. ユーザー A: 投稿 → logout
		const ts = Date.now();
		const titleA = `E2E B story ${ts}`;
		const urlA = `https://example.com/e2e-b-${ts}`;
		await signupNewUser(page);
		await submitStory(page, { title: titleA, url: urlA });
		await page.goto('/logout');

		// 2. ユーザー B: signup
		const userB = await signupNewUser(page);

		// 3. /newest で A の story を upvote
		await page.goto('/newest');
		const item = page
			.locator('.story-item')
			.filter({ has: page.locator('a.story-title', { hasText: titleA }) })
			.first();
		await expect(item).toBeVisible();
		await item.locator('button.upvote').click();
		await expect(item.locator('button.upvote')).toHaveClass(/voted/, { timeout: 5000 });

		// 4. hide → /user/B/hidden に出る → un-hide
		await item.locator('.story-meta a', { hasText: 'hide' }).click();
		await expect(
			page
				.locator('.story-item')
				.filter({ has: page.locator('a.story-title', { hasText: titleA }) })
		).toHaveCount(0, { timeout: 5000 });

		await page.goto(`/user/${userB}/hidden`);
		const hiddenItem = page
			.locator('.story-item')
			.filter({ has: page.locator('a.story-title', { hasText: titleA }) })
			.first();
		await expect(hiddenItem).toBeVisible();
		// un-hide リンクが hidden ページにあるかどうかは実装次第。
		// 無い場合は /item/{id} の hide トグルで un-hide する。
		const unHideLink = hiddenItem.locator('.story-meta a', { hasText: /un-?hide/i }).first();
		const storyId = await findStoryIdByTitle(page, titleA);
		if ((await unHideLink.count()) > 0) {
			await unHideLink.click();
			await page.waitForLoadState('networkidle');
		} else {
			await page.goto(`/item/${storyId}`);
			await page.waitForLoadState('networkidle');
			await page.locator('a[href="#hide"]', { hasText: /un-?hide/i }).click();
			await page.waitForTimeout(500);
		}

		// 5. favorite → /user/B/favorites に出る
		await page.goto(`/item/${storyId}`);
		await page.waitForLoadState('networkidle');
		await page.locator('a[href="#favorite"]').click();
		// favorite は client fetch。少し待ってから /favorites を確認。
		await page.waitForTimeout(500);
		await page.goto(`/user/${userB}/favorites`);
		await expect(
			page
				.locator('.story-item')
				.filter({ has: page.locator('a.story-title', { hasText: titleA }) })
				.first()
		).toBeVisible();

		// 6. /search?q=<title 一部> で見つかる
		const q = encodeURIComponent(titleA.split(' ').slice(0, 3).join(' '));
		await page.goto(`/search?q=${q}`);
		await expect(
			page.locator('a.story-title', { hasText: titleA }).first()
		).toBeVisible();

		// 7. /best /active /ask /show /front /polls /from /newcomments の GET 200
		const tabs = ['/best', '/active', '/ask', '/show', '/front', '/polls', '/from', '/newcomments'];
		for (const tab of tabs) {
			const res = await page.goto(tab);
			expect(res?.status(), `${tab} status`).toBe(200);
		}

		// 8. logout
		await page.goto('/logout');
		await expect(page.locator('a[href="/login"]')).toBeVisible();
	});
});

// ────────────────────────────────────────────────────────────────────
// シナリオ D: 投票投稿（poll） — IP ban 前に実行する
// ────────────────────────────────────────────────────────────────────
test.describe.serial('D: poll 投稿と投票', () => {
	test('newpoll → /polls 一覧 → /item で選択肢 → 別ユーザーで投票', async ({ page }) => {
		// 1. ユーザー C: signup
		await signupNewUser(page);

		// 2. /newpoll で title + text + 選択肢 3 個
		const ts = Date.now();
		const pollTitle = `E2E D poll ${ts}`;
		const opt1 = `Choice One ${ts}`;
		const opt2 = `Choice Two ${ts}`;
		const opt3 = `Choice Three ${ts}`;
		await page.goto('/newpoll');
		await page.waitForLoadState('networkidle');
		await page.fill('input[name="title"]', pollTitle);
		await page.fill('textarea[name="text"]', `Poll text body ${ts}`);
		await page.fill('textarea[name="options"]', `${opt1}\n${opt2}\n${opt3}`);
		await submitForm(page, () => page.click('button[type="submit"]'));
		// submit 後は /item/{id} へ redirect されるはず
		await expect(page).toHaveURL(/\/item\/\d+/, { timeout: 15_000 });
		const pollUrl = page.url();
		const pollIdMatch = pollUrl.match(/\/item\/(\d+)/);
		const pollId = pollIdMatch ? Number(pollIdMatch[1]) : 0;
		expect(pollId).toBeGreaterThan(0);

		// 3. /polls 一覧に [poll] 表示で出る
		await page.goto('/polls');
		const pollItem = page
			.locator('.story-item')
			.filter({ has: page.locator('a.story-title', { hasText: pollTitle }) })
			.first();
		await expect(pollItem).toBeVisible();
		await expect(pollItem.locator('.story-tag', { hasText: '[poll]' })).toBeVisible();

		// 4. /item/[poll_id] で選択肢が並ぶ
		await page.goto(`/item/${pollId}`);
		const optionsBlock = page.locator('.poll-options');
		await expect(optionsBlock).toBeVisible();
		await expect(optionsBlock.locator('.poll-option')).toHaveCount(3);
		await expect(optionsBlock).toContainText(opt1);
		await expect(optionsBlock).toContainText(opt2);
		await expect(optionsBlock).toContainText(opt3);

		// 5. ユーザー D: signup → 1 選択肢を upvote → 票数+1
		await page.goto('/logout');
		await signupNewUser(page);
		await page.goto(`/item/${pollId}`);
		await page.waitForLoadState('networkidle');

		const firstOption = page.locator('.poll-option').first();
		const meta = firstOption.locator('.poll-option-meta');
		const beforeText = (await meta.innerText()).trim();
		const beforeMatch = beforeText.match(/^(-?\d+)/);
		const before = beforeMatch ? Number(beforeMatch[1]) : 0;

		await firstOption.locator('button.upvote').click();
		await expect(firstOption.locator('button.upvote')).toHaveClass(/voted/, { timeout: 5000 });

		await expect
			.poll(
				async () => {
					const t = (await meta.innerText()).trim();
					const m = t.match(/^(-?\d+)/);
					return m ? Number(m[1]) : 0;
				},
				{ timeout: 5000 }
			)
			.toBe(before + 1);
	});
});

// ────────────────────────────────────────────────────────────────────
// シナリオ C: モデレーション（IP ban）— 必ず最後
// このシナリオは IP に 1 時間 ban を残すため、同じ IP で動く後続テストは
// /ipban にリダイレクトされる。describe 内の他テストへの影響を避けるため、
// ファイル末尾に置きつつ describe.serial で隔離する。
// ────────────────────────────────────────────────────────────────────
test.describe.serial('C: モデレーション (IP ban)', () => {
	// このシナリオは ip_bans テーブルに 1h ban を作る。次回 e2e 実行時に
	// signup すらできなくなって debug が困難になるため、afterAll で確実に
	// 物理削除する。本番 DB ではなく wrangler の local D1 を直接叩く。
	test.afterAll(async () => {
		const { execFileSync } = await import('node:child_process');
		try {
			execFileSync(
				'npx',
				[
					'wrangler',
					'd1',
					'execute',
					'hacker-noroshi-db',
					'--local',
					'--command',
					'DELETE FROM ip_bans; DELETE FROM ip_login_failures;'
				],
				{ stdio: 'ignore', timeout: 30_000 }
			);
		} catch {
			// 後始末失敗は test 結果に影響させない
		}
	});

	test('login 11 連続失敗 → /ipban リダイレクト → ban 情報表示', async ({ page }) => {
		// 念のため未認証セッションから始める
		await page.goto('/logout').catch(() => {});

		const badUser = uniqueUsername('badusr');
		// 5 分窓で 10 失敗から auto-ban (#92)。10 回目で ban、11 回目以降は
		// hooks で /ipban へ強制リダイレクト。
		// dev サーバーでは getClientAddress() が ::1 や 127.0.0.1 を返す。
		// /login への POST は use:enhance 経由でも Native submit でも結果は同じ。
		// ここでは fetch で直接 POST して bcrypt の確実な失敗を 11 回回す。
		for (let i = 0; i < 11; i++) {
			const res = await page.request.post('/login?/login', {
				form: {
					username: badUser,
					password: 'definitely_wrong_password_xyz'
				},
				maxRedirects: 0
			});
			// 307/302 でも fail() の 400 でも構わない。続行する。
			void res;
		}

		// この時点で次のリクエストは /ipban にリダイレクトされるはず
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		expect(page.url()).toContain('/ipban');

		// /ipban が ban 情報を表示
		await expect(page.locator('body')).toContainText(/ban されています/);
	});
});
