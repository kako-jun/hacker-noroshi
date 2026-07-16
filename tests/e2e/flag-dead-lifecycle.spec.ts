/**
 * Issue #179 バッチA: flag実行→dead自動化、vouch実行の結果検証、showdead設定の実効果。
 *
 * このブランチには #180 の3件の修正（一覧のdeadタグ即時反映・ネストコメントのdeadタグ表示・
 * flaggedバッジのinvalidateAll）が既に入っている。ここでは修正後の正しい挙動をアサートする
 * （バグを仕様として固定しない）。#180 で直った箇所は「回帰ガード」と明記している。
 *
 * DEAD_FLAG_THRESHOLD はハードコードせず定数から import し、閾値が変わっても
 * テストの意図（境界の一つ手前 / ちょうど閾値超過）が保たれるようにする。
 */
import { test, expect, type Page } from '@playwright/test';
import {
	signupNewUser,
	submitStory,
	findStoryIdByTitle,
	postComment,
	replyToComment,
	loginAs,
	runD1,
	updateUserKarma,
	setUserShowdead,
	setShowDeadViaProfile,
	flagItemNTimes,
	getFlagCount,
	getItemDeadState
} from './helpers';
import { DEAD_FLAG_THRESHOLD } from '../../src/lib/constants';

// dev サーバー初回コンパイルの待ちや signup 連打が入るため、既定の 30s では
// 5人flagシナリオがぎりぎりになる。full-flow.spec.ts に倣い 120s に拡張する。
test.setTimeout(120_000);

/**
 * page.goto 直後の SSR レスポンスが、ごく稀に直前の書き込みを拾い損ねることがある
 * （#179 で観測: 同時刻の page.request.get() では直後に正しい内容が返るのに、
 * page.goto() だけ一度だけ古い内容を返すケースが低頻度で発生した。Playwright の
 * toBeVisible/toHaveCount の自動リトライは「読み込み済み DOM の再検査」であって
 * 「サーバーへの再フェッチ」ではないため、これだけでは救えない）。
 * 対象 locator が見つかるまで goto をやり直すことで、稀な SSR タイミングの
 * flake を吸収する。
 */
async function gotoUntilVisible(
	page: Page,
	url: string,
	getLocator: (page: Page) => ReturnType<Page['locator']>,
	attempts = 3
): Promise<void> {
	for (let i = 0; i < attempts; i++) {
		await page.goto(url);
		await page.waitForLoadState('networkidle');
		const visible = await getLocator(page)
			.first()
			.isVisible()
			.catch(() => false);
		if (visible) return;
	}
	// 最後の試行がそのまま残るので、呼び出し側の expect が分かりやすいエラーを出す。
}

test.describe.serial('flag → dead lifecycle (#179 E1-E5)', () => {
	let ownerUsername: string;
	let title: string;
	let storyId: number;

	test('E1+E5: karma30の5ユーザーが順にUIからflagをクリック→5件目クリック直後にリロード無しで[dead]タグが付き、DB側もdead=1になる（#180回帰ガード）', async ({
		page
	}) => {
		ownerUsername = await signupNewUser(page);
		title = `flag lifecycle ${Date.now()}`;
		await submitStory(page, { title, text: 'flag lifecycle body' });
		await page.goto('/newest');
		storyId = await findStoryIdByTitle(page, title);

		const totalFlags = DEAD_FLAG_THRESHOLD + 1;
		for (let i = 1; i <= totalFlags; i++) {
			await page.goto('/logout');
			const flagger = await signupNewUser(page);
			updateUserKarma(flagger, 30);
			await page.goto('/newest');
			await page.waitForLoadState('networkidle');
			const row = page
				.locator('.story-item')
				.filter({ has: page.locator('a.story-title', { hasText: title }) })
				.first();
			await row.getByRole('link', { name: 'flag', exact: true }).click();

			if (i < totalFlags) {
				// 閾値未満のうちは [dead] が付かないことを都度確認する（境界の手前を踏み外していないか）
				await expect(row.locator('.story-tag', { hasText: '[dead]' })).toHaveCount(0);
			}
		}

		// totalFlags 件目（DEAD_FLAG_THRESHOLD+1 件目）クリック直後、ページ遷移・リロード無しで
		// 同じ行に [dead] タグが付く（#180 の主目的の修正）。
		const row = page
			.locator('.story-item')
			.filter({ has: page.locator('a.story-title', { hasText: title }) })
			.first();
		await expect(row.locator('.story-tag', { hasText: '[dead]' })).toBeVisible();

		// DB 側も実際に dead=1 になっている
		expect(getItemDeadState('stories', storyId)).toBe(1);
	});

	test('E2: dead化後、showdead=OFFの別ユーザーが/newestを開くと一覧から消えている', async ({
		page
	}) => {
		await page.goto('/logout');
		await signupNewUser(page); // 新規 signup は showdead=0 既定
		await page.goto('/newest');
		await page.waitForLoadState('networkidle');
		await expect(page.locator('a.story-title', { hasText: title })).toHaveCount(0);
	});

	test('E3: dead化後、showdead=ONのユーザーが/newestを開くと[dead]タグ付きで表示される', async ({
		page
	}) => {
		await page.goto('/logout');
		const viewer = await signupNewUser(page);
		setUserShowdead(viewer, 1);
		await page.goto('/newest');
		await page.waitForLoadState('networkidle');
		const row = page
			.locator('.story-item')
			.filter({ has: page.locator('a.story-title', { hasText: title }) })
			.first();
		await expect(row).toHaveCount(1);
		await expect(row.locator('.story-tag', { hasText: '[dead]' })).toBeVisible();
	});

	test('E4: 投稿者本人（showdead=OFF）は/newestに出ないが、/item/{id}への直リンクでは[dead]タグ付きで見える（showdead非依存）', async ({
		page
	}) => {
		await loginAs(page, ownerUsername);
		await page.goto('/newest');
		await page.waitForLoadState('networkidle');
		await expect(page.locator('a.story-title', { hasText: title })).toHaveCount(0);

		await page.goto(`/item/${storyId}`);
		await page.waitForLoadState('networkidle');
		await expect(page.locator('.item-title .story-tag', { hasText: '[dead]' })).toBeVisible();
	});
});

test.describe('flagged badge immediate reflect (#180 regression guard)', () => {
	test('story detail: flag直後、リロード無しで[flagged]バッジが表示される', async ({ page }) => {
		await signupNewUser(page);
		const title = `flagged badge ${Date.now()}`;
		await submitStory(page, { title, text: 'body' });
		await page.goto('/newest');
		const storyId = await findStoryIdByTitle(page, title);

		await page.goto('/logout');
		const flagger = await signupNewUser(page);
		updateUserKarma(flagger, 30);
		await page.goto(`/item/${storyId}`);
		await page.waitForLoadState('networkidle');

		await expect(page.locator('.item-title .story-tag', { hasText: '[flagged]' })).toHaveCount(0);
		await page.locator('.item-meta').getByRole('link', { name: 'flag', exact: true }).click();
		// page.reload() を挟まない。flagStory() の invalidateAll() だけで即時反映されることを確認する。
		await expect(page.locator('.item-title .story-tag', { hasText: '[flagged]' })).toBeVisible();
	});
});

test.describe('vouch (#179 E6-E9)', () => {
	test('E6+E7: dead化したcommentをvouchするとdead=0に戻り、紐づくflagsが全削除される', async ({
		page
	}) => {
		await signupNewUser(page);
		const title = `vouch comment ${Date.now()}`;
		await submitStory(page, { title, text: 'body' });
		await page.goto('/newest');
		const storyId = await findStoryIdByTitle(page, title);

		await page.goto('/logout');
		await signupNewUser(page); // commenter（story owner とは別人格）
		await page.goto(`/item/${storyId}`);
		await page.waitForLoadState('networkidle');
		await postComment(page, 'vouch target comment');
		await page.waitForSelector('.comment-text', { state: 'visible', timeout: 15_000 });
		const commentHref = await page
			.locator('.comment-item .comment-head a')
			.filter({ hasText: /ago/ })
			.first()
			.getAttribute('href');
		const commentId = Number(commentHref!.match(/\/comment\/(\d+)/)![1]);

		// DEAD_FLAG_THRESHOLD+1 人の別ユーザーで実際に flag → 自動 dead 化（本物の flags 行を作る）
		const totalFlags = DEAD_FLAG_THRESHOLD + 1;
		await flagItemNTimes(page, commentId, 'comment', totalFlags);
		expect(getItemDeadState('comments', commentId)).toBe(1);
		expect(getFlagCount(commentId, 'comment')).toBe(totalFlags); // vouch前: flagsが複数行ある

		await page.goto('/logout');
		const voucher = await signupNewUser(page);
		updateUserKarma(voucher, 30);
		await page.goto(`/comment/${commentId}`);
		await page.waitForLoadState('networkidle');
		await page
			.locator('.item-detail > .comment-head')
			.getByRole('link', { name: 'vouch', exact: true })
			.click();
		await expect(
			page.locator('.item-detail > .comment-head .story-tag', { hasText: '[dead]' })
		).toHaveCount(0);

		expect(getItemDeadState('comments', commentId)).toBe(0);
		expect(getFlagCount(commentId, 'comment')).toBe(0); // vouch後: flagsが全削除されている
	});

	test('E8+E9: dead=1のstoryを/item/{id}でvouchすると[dead]タグが消えdead=0に戻り、/newestに再び出現する', async ({
		page
	}) => {
		await signupNewUser(page);
		const title = `vouch story ${Date.now()}`;
		await submitStory(page, { title, text: 'body' });
		await page.goto('/newest');
		const storyId = await findStoryIdByTitle(page, title);
		// この test は vouch 自体の挙動（[dead]解除・/newestへの復帰）を見るのが目的で
		// flags データそのものは E6+E7 で別途検証済みのため、dead 化は直接 SQL で行う。
		runD1(`UPDATE stories SET dead = 1 WHERE id = ${storyId}`);

		await page.goto('/logout');
		const voucher = await signupNewUser(page);
		updateUserKarma(voucher, 30);
		await page.goto(`/item/${storyId}`);
		await page.waitForLoadState('networkidle');
		await expect(page.locator('.item-title .story-tag', { hasText: '[dead]' })).toBeVisible();

		await page.locator('.item-meta').getByRole('link', { name: 'vouch', exact: true }).click();
		await expect(page.locator('.item-title .story-tag', { hasText: '[dead]' })).toHaveCount(0);
		expect(getItemDeadState('stories', storyId)).toBe(0);

		// E9: /newest（showdead=OFF）に戻ると復活した投稿が再び一覧に出る
		await page.goto('/newest');
		await page.waitForLoadState('networkidle');
		await expect(page.locator('a.story-title', { hasText: title })).toBeVisible();
	});
});

test.describe('showdead effect (#179 E10-E13, E15)', () => {
	test('E10+E11: showdead=OFFでは/newestに出ないが、プロフィールでshowdead=yesに変更すると[dead]タグ付きで出現する', async ({
		page
	}) => {
		await signupNewUser(page);
		const title = `showdead newest ${Date.now()}`;
		await submitStory(page, { title, text: 'body' });
		await page.goto('/newest');
		const storyId = await findStoryIdByTitle(page, title);
		runD1(`UPDATE stories SET dead = 1 WHERE id = ${storyId}`);

		await page.goto('/logout');
		const viewer = await signupNewUser(page); // showdead は既定 0
		await page.goto('/newest');
		await page.waitForLoadState('networkidle');
		await expect(page.locator('a.story-title', { hasText: title })).toHaveCount(0);

		// E11: 同じユーザーがプロフィール画面のフォームから showdead=yes に変更する
		await setShowDeadViaProfile(page, viewer, 'yes');
		await gotoUntilVisible(page, '/newest', (p) =>
			p.locator('a.story-title', { hasText: title })
		);
		const row = page
			.locator('.story-item')
			.filter({ has: page.locator('a.story-title', { hasText: title }) })
			.first();
		await expect(row).toHaveCount(1);
		await expect(row.locator('.story-tag', { hasText: '[dead]' })).toBeVisible();
	});

	test('E12+E13: スレッド内ネストコメント — showdead=ONは[dead]タグ付きで見え、showdead=OFFは表示されない（#180回帰ガード）', async ({
		page
	}) => {
		await signupNewUser(page);
		const title = `nested dead comment ${Date.now()}`;
		await submitStory(page, { title, text: 'body' });
		await page.goto('/newest');
		const storyId = await findStoryIdByTitle(page, title);

		// トップレベルコメントと reply を同じユーザーで連続投稿すると、comment action の
		// 2分間レート制限（src/lib/server/itemActions.ts）に引っかかり reply が fail(429) で
		// サイレントに弾かれる（#175 のセルフ返信検証と同じ理由で full-flow.spec.ts の B-5 も
		// 別ユーザーで reply している）。そのため commenter と replier を別ユーザーにする。
		await page.goto('/logout');
		await signupNewUser(page);
		await page.goto(`/item/${storyId}`);
		await page.waitForLoadState('networkidle');
		await postComment(page, 'top-level comment');
		await page.waitForSelector('.comment-text', { state: 'visible', timeout: 15_000 });

		await page.goto('/logout');
		await signupNewUser(page);
		await page.goto(`/item/${storyId}`);
		await page.waitForLoadState('networkidle');
		const topComment = page.locator('.comment-item').first();
		await replyToComment(page, topComment, 'nested reply comment');
		await page.waitForLoadState('networkidle');
		await expect(
			page.locator('.comment-text p', { hasText: 'nested reply comment' }).first()
		).toBeVisible({ timeout: 10_000 });

		// commentTree は DFS 順で flatten される。root は1件・その子(reply)が1件なので
		// 2件目の .comment-item がネストされた reply（depth>0）になる。
		await expect(page.locator('.comment-item')).toHaveCount(2);
		const replyItem = page.locator('.comment-item').nth(1);
		const replyIdAttr = await replyItem.getAttribute('id');
		const replyId = Number(replyIdAttr!.replace('item-', ''));
		runD1(`UPDATE comments SET dead = 1 WHERE id = ${replyId}`);

		// showdead=ON viewer: ネストコメントが [dead] タグ付きで見える
		await page.goto('/logout');
		const viewerOn = await signupNewUser(page);
		setUserShowdead(viewerOn, 1);
		await page.goto(`/item/${storyId}`);
		await page.waitForLoadState('networkidle');
		const replyItemOn = page.locator(`#item-${replyId}`);
		await expect(replyItemOn).toHaveCount(1);
		await expect(replyItemOn.locator('.story-tag', { hasText: '[dead]' })).toBeVisible();

		// showdead=OFF viewer（既定）: 自分のコメントでなければサーバー側で除外され、そもそも描画されない
		await page.goto('/logout');
		await signupNewUser(page);
		await page.goto(`/item/${storyId}`);
		await page.waitForLoadState('networkidle');
		await expect(page.locator(`#item-${replyId}`)).toHaveCount(0);
	});

	test('E15: /searchでdead投稿はshowdead=OFFで除外・showdead=ONで表示される', async ({ page }) => {
		await signupNewUser(page);
		const title = `search dead unique ${Date.now()}`;
		await submitStory(page, { title, text: 'body' });
		await page.goto('/newest');
		const storyId = await findStoryIdByTitle(page, title);
		runD1(`UPDATE stories SET dead = 1 WHERE id = ${storyId}`);

		await page.goto('/logout');
		await signupNewUser(page); // showdead 既定 OFF
		await page.goto(`/search?q=${encodeURIComponent(title)}`);
		await page.waitForLoadState('networkidle');
		await expect(page.locator('a.story-title', { hasText: title })).toHaveCount(0);

		await page.goto('/logout');
		const viewerOn = await signupNewUser(page);
		setUserShowdead(viewerOn, 1);
		await page.goto(`/search?q=${encodeURIComponent(title)}`);
		await page.waitForLoadState('networkidle');
		await expect(page.locator('a.story-title', { hasText: title })).toBeVisible();
	});
});
