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
	postComment,
	replyToComment,
	deleteAccount
} from './helpers';

// dev サーバー初回コンパイルや bcrypt の待ちが入るため、デフォルトの 30s では
// 各シナリオで signup * 複数回 + 編集多段でぎりぎり。各テストとも 120s に拡張する。
test.setTimeout(120_000);

/**
 * use:enhance のフォームを submit する小さなヘルパ。click 前に hydration を
 * 待ち、submit 後にコンテンツ変化（reload / invalidateAll）まで待つ。
 *
 * networkidle は SvelteKit の HMR WebSocket と相性が悪い局面もあるが、
 * dev サーバー起動直後に submit するシナリオでは、ここで idle を待たないと
 * server-side の DB 永続化と client 側の rerender がレースして
 * 直後の `expect(...).toHaveValue(...)` が空文字を見るケースがあった
 * （実機で flake 確認済み）。caller の expect だけでは救いきれないので
 * 引き続き networkidle を待つ。
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

		// A-3. 自分の投稿は submit 時に自動 upvote (+1) が入る HN 仕様。
		// /newest 上で該当行の upvote ボタンが既に voted 状態であることを確認する。
		// API レイヤでは self-upvote をブロックしないため、再度 click すると un-vote
		// されて points が 0 になりうる（HN は実際そうなる）。回帰しないよう
		// 「初期状態で voted」だけを assertion する。
		const ownItem = page
			.locator('.story-item')
			.filter({ has: page.locator('a.story-title', { hasText: title }) })
			.first();
		await expect(ownItem.locator('button.upvote')).toHaveClass(/voted/);

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

		// 4. コメント投稿 → 表示確認（expect の visible 待ちで idle 不要）
		const commentText = `E2E A comment ${ts}`;
		await postComment(page, commentText);
		await expect(
			page.locator('.comment-text p', { hasText: commentText }).first()
		).toBeVisible({ timeout: 10_000 });

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

		// 6. コメント削除 → [deleted] 表示（expect 側で待つので idle 不要）
		page.once('dialog', (d) => d.accept());
		await page
			.locator('.comment-item')
			.first()
			.locator('form[action="?/deleteComment"] button[type="submit"]')
			.click();
		await expect(
			page.locator('.comment-text p', { hasText: '[deleted]' }).first()
		).toBeVisible({ timeout: 15_000 });

		// 7. /user/[id] で about + 各種 noprocrast 系フィールドを編集 → 反映確認
		// A-8 拡張: about 以外に delay / noprocrast / showdead / maxvisit / minaway
		// もまとめて submit し、reload 後に値が persist しているか確認する。
		const aboutText = `E2E A about ${ts}`;
		await page.goto(`/user/${username}`);
		const profileForm = page.locator('form[action="?/update"]');
		await expect(profileForm).toBeVisible();
		await profileForm.locator('textarea[name="about"]').fill(aboutText);
		await profileForm.locator('select[name="showdead"]').selectOption('yes');
		await profileForm.locator('select[name="noprocrast"]').selectOption('yes');
		await profileForm.locator('input[name="maxvisit"]').fill('30');
		await profileForm.locator('input[name="minaway"]').fill('15');
		await profileForm.locator('input[name="delay"]').fill('5');
		await submitForm(page, () =>
			profileForm.locator('button[type="submit"]').click()
		);
		// 同じパスへ goto しても use:enhance のフォームリセットや SvelteKit の
		// クライアントキャッシュで textarea 値が空のまま見えるケースがある。
		// 別ページを挟んでから戻り、サーバー load をフレッシュに走らせる。
		await page.goto('/');
		await page.goto(`/user/${username}`);
		const reloadedForm = page.locator('form[action="?/update"]');
		await expect(reloadedForm.locator('textarea[name="about"]')).toHaveValue(
			aboutText,
			{ timeout: 10_000 }
		);
		await expect(reloadedForm.locator('select[name="showdead"]')).toHaveValue('yes');
		await expect(reloadedForm.locator('select[name="noprocrast"]')).toHaveValue('yes');
		await expect(reloadedForm.locator('input[name="maxvisit"]')).toHaveValue('30');
		await expect(reloadedForm.locator('input[name="minaway"]')).toHaveValue('15');
		await expect(reloadedForm.locator('input[name="delay"]')).toHaveValue('5');

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
		// 削除ボタンが visible になるまで待ってから click（idle でなくても可）
		const deleteStoryBtn = page.locator(
			'form[action="?/deleteStory"] button[type="submit"]'
		);
		await expect(deleteStoryBtn).toBeVisible();
		page.once('dialog', (d) => d.accept());
		await deleteStoryBtn.click();
		// 再 goto して [deleted] 表示を確認（expect で待機）
		await page.goto(`/item/${storyId}`);
		await expect(page.locator('body')).toContainText('[deleted]', { timeout: 10_000 });

		// A-9. username 変更（#88: 旧 username の URL は新 username に redirect する）
		// 90日制限は username_history が空（新規ユーザー）なら適用されないため、
		// 1 回だけ変更を試行できる。
		const newUsername = uniqueUsername('renamed');
		await page.goto(`/user/${username}`);
		const renameForm = page.locator('form[action="?/changeUsername"]');
		await renameForm.locator('input[name="newUsername"]').fill(newUsername);
		await Promise.all([
			page.waitForURL(`/user/${newUsername}`, { timeout: 15_000 }),
			renameForm.locator('button[type="submit"]').click()
		]);
		// 新名でプロフィールが見える
		await expect(page.locator('body')).toContainText(`user:`);
		// 旧 username で /user/{old} に行くと /user/{new} に 301 redirect される
		await page.goto(`/user/${username}`);
		await expect(page).toHaveURL(`/user/${newUsername}`);

		// A-10. /user/[id]/favorites と /hidden が 200 を返す（中身は空でよい）
		const favRes = await page.goto(`/user/${newUsername}/favorites`);
		expect(favRes?.status(), 'favorites status').toBe(200);
		const hiddenRes = await page.goto(`/user/${newUsername}/hidden`);
		expect(hiddenRes?.status(), 'hidden status').toBe(200);

		// A-11. アカウント削除 → ログアウト → 削除済みユーザーで再ログイン試行 → "Bad login"
		await page.goto(`/user/${newUsername}`);
		await deleteAccount(page, 'test1234');
		// 削除直後はトップに飛び、未ログイン状態（login リンクが見える）
		await expect(page.locator('a[href="/login"]').first()).toBeVisible({ timeout: 10_000 });
		// 削除済みユーザーで再ログインを試みる（プロフィール画面は [deleted] 表示）
		await page.goto(`/user/${newUsername}`);
		await expect(page.locator('body')).toContainText('deleted');
		await page.goto('/login');
		await page.waitForLoadState('networkidle');
		const loginForm = page.locator('form[action="?/login"]');
		await loginForm.locator('input[name="username"]').fill(newUsername);
		await loginForm.locator('input[name="password"]').fill('test1234');
		await loginForm.locator('button[type="submit"]').click();
		// /login に留まり、エラーが表示される（"Bad login" 系）
		await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
		await expect(page.locator('body')).toContainText(/Bad login|Invalid|incorrect/i);
	});
});

// ────────────────────────────────────────────────────────────────────
// シナリオ B: コミュニティ目線
// ────────────────────────────────────────────────────────────────────
test.describe.serial('B: コミュニティ目線', () => {
	test('upvote / hide / favorite / search / 各タブの GET 200', async ({ page }) => {
		// 1. ユーザー A: 投稿 + コメント → logout
		const ts = Date.now();
		const titleA = `E2E B story ${ts}`;
		const urlA = `https://example.com/e2e-b-${ts}`;
		const commentA = `User A top-level comment ${ts}`;
		await signupNewUser(page);
		await submitStory(page, { title: titleA, url: urlA });
		// 投稿直後に /item/{id} へ移動して A のコメントを残す（B-5 で B が返信、
		// B-6 で B が upvote するための土台）
		const storyIdForB = await (async () => {
			await page.goto('/newest');
			return findStoryIdByTitle(page, titleA);
		})();
		await page.goto(`/item/${storyIdForB}`);
		await page.waitForLoadState('networkidle');
		await postComment(page, commentA);
		await page.waitForLoadState('networkidle');
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

		// B-2 拡張: 同じ upvote を再 click すると un-upvote される（voted class が外れる）
		await item.locator('button.upvote').click();
		await expect(item.locator('button.upvote')).not.toHaveClass(/voted/, { timeout: 5000 });
		// 元に戻す（後段の hide 等が影響しないよう、再度 voted 状態に）
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

		// B-5. 他人のコメントに返信（ネスト 2 段目）+ B-6. コメント upvote 動作
		// 同時に B-7 も検証（自分の投稿に flag リンクが出ないこと）。
		await page.goto(`/item/${storyIdForB}`);
		await expect(page.locator('.comment-text p', { hasText: commentA }).first()).toBeVisible();
		const aComment = page
			.locator('.comment-item')
			.filter({ has: page.locator('.comment-text p', { hasText: commentA }) })
			.first();

		// B-6. 他人のコメントに upvote → voted 化。
		// downvote は karma >= 500 が必要なので新規ユーザーには表示されない。
		await aComment.locator('button.upvote').first().click();
		await expect(aComment.locator('button.upvote').first()).toHaveClass(/voted/, {
			timeout: 5000
		});
		// downvote ボタンは UI 階層に存在しない（karma 不足のため）
		await expect(aComment.locator('button.downvote')).toHaveCount(0);

		// B-5. 返信投稿（ネスト 2 段目）
		const replyText = `B reply to A ${ts}`;
		await replyToComment(page, aComment, replyText);
		await page.waitForLoadState('networkidle');
		await expect(
			page.locator('.comment-text p', { hasText: replyText }).first()
		).toBeVisible({ timeout: 10_000 });

		// B-7. flag リンクの可視性
		// 新規ユーザー B は karma=1 なので FLAG_KARMA_THRESHOLD (30) 未満。
		// 自分の投稿に対しても他人の投稿に対しても flag UI は出ない（karma gate）。
		// 「自分の投稿に flag できない」「他人の投稿に flag できる」の本来意図は
		// karma 30 以上が前提だが、E2E で karma を稼がせるのはテスト時間を浪費する。
		// 代わりに「new user は own story の flag link が出ない」事実を確認する。
		// （karma 30 取得時のフロー整合性は API 単体テスト側で担保）
		await expect(
			page.locator('a[href="#flag"]', { hasText: /^flag$/ })
		).toHaveCount(0);

		// 6. /search?q=<title 一部> で見つかる
		const q = encodeURIComponent(titleA.split(' ').slice(0, 3).join(' '));
		await page.goto(`/search?q=${q}`);
		await expect(
			page.locator('a.story-title', { hasText: titleA }).first()
		).toBeVisible();

		// B-8. /search?q=...&type=comments でコメント検索が動く
		// commentA は十分ユニークなので 1 件以上ヒットするはず。
		const cq = encodeURIComponent('top-level comment');
		const searchRes = await page.goto(`/search?q=${cq}&type=comments`);
		expect(searchRes?.status(), '/search type=comments status').toBe(200);
		// 検索結果に commentA の本文が含まれる
		await expect(page.locator('body')).toContainText(commentA, { timeout: 10_000 });

		// 7 + B-9. 既存 8 タブ + 6 タブ = 14 タブの GET 200
		const tabs = [
			// 既存 8
			'/best',
			'/active',
			'/ask',
			'/show',
			'/front',
			'/polls',
			'/from',
			'/newcomments',
			// B-9 追加 6
			'/shownew',
			'/asknew',
			'/noobstories',
			'/noobcomments',
			'/bestcomments',
			'/highlights'
		];
		for (const tab of tabs) {
			const res = await page.goto(tab);
			expect(res?.status(), `${tab} status`).toBe(200);
		}

		// B-10. /front?day=YYYY-MM-DD（昨日の日付）が 200
		const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
			.toISOString()
			.split('T')[0];
		const frontDayRes = await page.goto(`/front?day=${yesterday}`);
		expect(frontDayRes?.status(), `/front?day=${yesterday} status`).toBe(200);

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

		// D-3. 投票後の取消（再 click で un-vote、票数が元の値に戻る）
		await firstOption.locator('button.upvote').click();
		await expect(firstOption.locator('button.upvote')).not.toHaveClass(/voted/, {
			timeout: 5000
		});
		await expect
			.poll(
				async () => {
					const t = (await meta.innerText()).trim();
					const m = t.match(/^(-?\d+)/);
					return m ? Number(m[1]) : 0;
				},
				{ timeout: 5000 }
			)
			.toBe(before);

		// D-4. poll の投稿者本人が title を編集 → type=poll を維持して保存できる
		await page.goto('/logout');
		// 投稿者（最初の signupNewUser したユーザー）でログインし直す手段が無いので、
		// シンプルに「別タブで投票者として upvote 取消したあと、元の作成者で再 login」
		// は spec の手間が大きい。代わりに以下の方針:
		//   投稿者ユーザーで /item/{pollId} を編集し、type=poll 維持の確認は
		//   /polls 一覧に [poll] バッジが残ることで担保する。
		// →実装上、ここまでで投票者 (D2) としてログイン中なので、改めて poll 作成者
		//   として signup ＋ 新規 poll 編集... は手間が増えすぎる。
		//   投票者からは編集権限が無いため、ここでは作成済み poll を作成者で編集する
		//   ところまでをカバーするために、最初に作成した poll の作成者でログインし直す
		//   手段が必要。signupNewUser はランダム ID なのでパスワードは固定 'test1234'。
		// 解決策: D-4 専用の独立した小さなフローを別シナリオとして追加するのが
		// シンプル。下記は D の最後に「新しい poll を作って自身で編集 → /polls の
		// [poll] タグが残る」を行う。
		const pollAuthor = await signupNewUser(page);
		void pollAuthor;
		const ts2 = Date.now();
		const pollTitle2 = `E2E D2 poll ${ts2}`;
		await page.goto('/newpoll');
		await page.waitForLoadState('networkidle');
		await page.fill('input[name="title"]', pollTitle2);
		await page.fill('textarea[name="text"]', `Poll text body ${ts2}`);
		await page.fill('textarea[name="options"]', `Opt A ${ts2}\nOpt B ${ts2}`);
		await submitForm(page, () => page.click('button[type="submit"]'));
		await expect(page).toHaveURL(/\/item\/\d+/, { timeout: 15_000 });
		const pollId2 = Number(page.url().match(/\/item\/(\d+)/)?.[1] ?? 0);
		expect(pollId2).toBeGreaterThan(0);

		// 編集: タイトル変更 → 保存 → type=poll が保たれている
		await page.locator('.item-meta a[href="#edit"]').first().click();
		const editPollForm = page.locator('form[action="?/editStory"]');
		await expect(editPollForm).toBeVisible();
		const newPollTitle = `${pollTitle2} (edited)`;
		await editPollForm.locator('input[name="title"]').fill(newPollTitle);
		await submitForm(page, () => editPollForm.locator('button[type="submit"]').click());
		await expect(page.locator('.item-title', { hasText: newPollTitle })).toBeVisible({
			timeout: 10_000
		});
		// /polls 一覧で [poll] タグ付きで残る = type=poll を維持している
		await page.goto('/polls');
		const editedPollItem = page
			.locator('.story-item')
			.filter({ has: page.locator('a.story-title', { hasText: newPollTitle }) })
			.first();
		await expect(editedPollItem).toBeVisible();
		await expect(editedPollItem.locator('.story-tag', { hasText: '[poll]' })).toBeVisible();
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
		// レビュー指摘: silent な try/catch は CI で次回 signup を全死させても
		// 気づけない。失敗時はログに残して必ず気付けるようにする（test 結果には
		// 影響させないが、stderr に warning を出す）。
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
				{ cwd: process.cwd(), stdio: 'pipe', timeout: 30_000 }
			);
		} catch (e) {
			console.warn('[afterAll] ip_bans / ip_login_failures cleanup failed', e);
		}
	});

	// C-3 / C-4: Turnstile によるセルフ unban の UI 検証は dev では不可。
	// /ipban の load で TURNSTILE_SITE_KEY が 'REPLACE_ME' / 未設定の場合は
	// turnstileSiteKey=null になり、widget が描画されない。よって UI レベルで
	// セルフ unban → 通常ログイン復帰の動作を確認する手段が無い。
	// 本番では手動確認、ここでは skip 表明にとどめる。
	test.skip(
		'C-3/C-4: Turnstile セルフ unban → 通常ログイン復帰 (dev disabled)',
		() => {
			// dev 環境で Turnstile が無効化されており UI レベルでは検証不能。
			// 本番では手動確認する。
		}
	);

	test('C-5: 削除済みアカウントは Bad login で拒否される', async ({ page }) => {
		// このテストは IP ban トリガー前に走らせる必要がある。
		// 同 describe 内では宣言順に直列実行されるため、ban テストより前に置く。
		// （シナリオ A-11 で削除したアカウントが残っているとは限らないので、
		// ここで独立に signup → 削除 → 再ログイン試行する）
		await page.goto('/logout').catch(() => {});
		const targetUsername = await signupNewUser(page);
		await page.goto(`/user/${targetUsername}`);
		await deleteAccount(page, 'test1234');
		// 削除済みユーザーで login 試行
		await page.goto('/login');
		await page.waitForLoadState('networkidle');
		const lf = page.locator('form[action="?/login"]');
		await lf.locator('input[name="username"]').fill(targetUsername);
		await lf.locator('input[name="password"]').fill('test1234');
		await lf.locator('button[type="submit"]').click();
		await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
		await expect(page.locator('body')).toContainText(/Bad login/i);
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
		await expect(page).toHaveURL(/\/ipban/, { timeout: 10_000 });

		// /ipban が ban 情報を表示
		await expect(page.locator('body')).toContainText(/ban されています/);
	});
});
