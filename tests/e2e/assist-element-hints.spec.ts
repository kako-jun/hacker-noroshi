import { test, expect, type Page } from '@playwright/test';
import {
	signupNewUser,
	submitStory,
	findStoryIdByTitle,
	updateUserKarma,
	setStoryCreatedAt
} from './helpers';

/**
 * Issue #172: アシストヒントを画面単位パラグラフ（story.controls / item.controls）から
 * 要素単位（story.upvote/hide/flag/comments・item.favorite/hide/flag/edit/delete/
 * comment-toggle/reply）へ再設計。
 *
 * 第1段（`.assist-anchor` + `.assist-hint-float` + `.assist-stagger-*` による絶対配置・固定pxオフセット
 * 階段状レイアウト）はセルフレビュー2巡で、固定pxオフセットが実際のレイアウト（行の高さ・ページごとの
 * ヒント段数・ビューポート幅）に追従できないという同じ欠陥クラスのバグを繰り返し出した（story.upvote が
 * 無関係な行に重なる／item.upvote がコメント本文に重なる／狭幅ビューポートで画面右にはみ出す=#174）。
 *
 * 第2段では絶対配置をやめ、コントロール群の直下に通常のドキュメントフロー要素として `.assist-hint-list`
 * （`.assist-hint` を縦積み）を挿入する設計に置き換えた。documentフローは要素同士が押し合うだけで重ならず、
 * 幅もコンテナ内に自然に収まるため、旧設計にあった「重なり回帰ガード」テスト群はもう意味を持たない
 * （構造的に重なりが起きない）。代わりに、行の直後に正しいヒント一覧が正しい文言・順序・条件で出ることを
 * 検証する。
 *
 * ここでは以下を確認する:
 *  A. 配置（行/コントロール群の直後に assist-hint-list が document フローで出る）
 *  B. 正常系（どのヒントがどの行のリストに、どの順序で出るか）
 *  C. 権限・条件分岐（ゲスト・own post・編集窓・0コメント）
 *  D. 狭幅ビューポート（#174 再現ケースの直り確認・test.fail() からの格上げ）
 *  E. 状態遷移（hide でのヒント移動、assist ON/OFF 連打）
 *  F. i18n 実配線（en ロケール）
 *  G. console error スモーク
 *
 * assistHint 自体の文言・キー網羅は tests/unit/assist.test.ts でカバー済みなのでここでは
 * 「実際の画面のどこに出るか／出ないか」だけを見る。
 */

/** assist スイッチを ON にする（既定 OFF を前提に1回クリック）。 */
async function turnAssistOn(page: Page): Promise<void> {
	const sw = page.locator('.assist-switch');
	await expect(sw).toHaveAttribute('aria-checked', 'false');
	await sw.click();
}

test.describe('assist element hints (#172): list row hint placement', () => {
	test('一覧 先頭行: hint list が .story-item の直後に document フローで出て、upvote/hide/comments の3件が順に並ぶ（ゲスト・flag無し）', async ({
		page
	}) => {
		await page.goto('/locale?lang=ja&next=/newest');
		await page.waitForLoadState('networkidle');
		await turnAssistOn(page);

		// .story-list の直下の子として .story-item の直後に .assist-hint-list が1つだけ出る
		// （assistFirst は先頭可視行にしか付かないため）。
		const list = page.locator('.story-list > .assist-hint-list');
		await expect(list).toHaveCount(1);
		const hints = list.locator('.assist-hint');
		await expect(hints).toHaveCount(3);
		await expect(hints.nth(0)).toContainText('▲ は upvote（投票）');
		await expect(hints.nth(1)).toContainText('非表示（hide）');
		await expect(hints.nth(2)).toContainText('コメント');

		// document フロー配置なので、リストは対象行の下（y座標が対象行より大きい）に自然に落ちる。
		const rowBox = await page.locator('.story-item').first().boundingBox();
		const listBox = await list.boundingBox();
		expect(rowBox).not.toBeNull();
		expect(listBox).not.toBeNull();
		expect((listBox!).y).toBeGreaterThan((rowBox!).y);
	});

	test('一覧 先頭行・他人の投稿＋高カルマ: upvote/hide/comments/flag の4件がこの順に並ぶ', async ({ page }) => {
		await page.goto('/locale?lang=ja&next=/login');
		await signupNewUser(page);
		const title = `list hints flag ${Date.now()}`;
		await submitStory(page, { title, text: 'body' });
		await page.goto('/logout');

		const viewer = await signupNewUser(page);
		updateUserKarma(viewer, 50);
		await page.goto('/newest');
		await page.waitForLoadState('networkidle');
		await expect(page.locator('.story-item').first().locator('.story-title')).toHaveText(title);
		await turnAssistOn(page);

		const hints = page.locator('.story-list > .assist-hint-list').locator('.assist-hint');
		await expect(hints).toHaveCount(4);
		await expect(hints.nth(0)).toContainText('▲ は upvote（投票）');
		await expect(hints.nth(1)).toContainText('非表示（hide）');
		await expect(hints.nth(2)).toContainText('コメント');
		await expect(hints.nth(3)).toContainText('通報（flag）');
	});

	test('/user/[id]/hidden: story.un-hide がリストに出て、story.hide の文言は出ない（#172 must 2）', async ({
		page
	}) => {
		await page.goto('/locale?lang=ja&next=/login');
		await signupNewUser(page);
		const title = `mapping unhide hint ${Date.now()}`;
		await submitStory(page, { title, text: 'body' });
		await page.goto('/logout');

		const viewer = await signupNewUser(page);
		await page.goto('/newest');
		const item = page
			.locator('.story-item')
			.filter({ has: page.locator('a.story-title', { hasText: title }) })
			.first();
		await item.locator('.story-meta a[href="#hide"]').click();
		await expect(
			page.locator('.story-item').filter({ has: page.locator('a.story-title', { hasText: title }) })
		).toHaveCount(0, { timeout: 5000 });

		await page.goto(`/user/${viewer}/hidden`);
		await page.waitForLoadState('networkidle');
		await turnAssistOn(page);

		const hints = page.locator('.story-list > .assist-hint-list').locator('.assist-hint');
		await expect(hints.filter({ hasText: '非表示解除（un-hide）' })).toHaveCount(1);
		await expect(hints.filter({ hasText: 'この投稿を自分の一覧から消します' })).toHaveCount(0);
	});
});

test.describe('assist element hints (#172): item-meta hint list', () => {
	test('own-post・編集窓内: item-meta の直後に upvote/edit/delete/hide/favorite の5件がこの順に並ぶ', async ({
		page
	}) => {
		await page.goto('/locale?lang=ja&next=/login');
		await signupNewUser(page);
		const title = `own post hints ${Date.now()}`;
		await submitStory(page, { title, text: 'body' });
		await page.goto('/newest');
		const storyId = await findStoryIdByTitle(page, title);
		await page.goto(`/item/${storyId}`);
		await page.waitForLoadState('networkidle');
		await turnAssistOn(page);

		const list = page.locator('.item-meta + .assist-hint-list');
		await expect(list).toHaveCount(1);
		const hints = list.locator('.assist-hint');
		await expect(hints).toHaveCount(5);
		await expect(hints.nth(0)).toContainText('▲ は upvote（投票）');
		await expect(hints.nth(1)).toContainText('編集（edit）');
		await expect(hints.nth(2)).toContainText('削除（delete）');
		await expect(hints.nth(3)).toContainText('非表示（hide）');
		await expect(hints.nth(4)).toContainText('お気に入り（favorite）');

		// document フロー配置なので item-meta の下に自然に落ち、コメント本文とは重ならない。
		const metaBox = await page.locator('.item-meta').boundingBox();
		const listBox = await list.boundingBox();
		expect(metaBox).not.toBeNull();
		expect(listBox).not.toBeNull();
		expect((listBox!).y).toBeGreaterThan((metaBox!).y);
	});

	test('他人の投稿・高カルマ: upvote/hide/favorite/flag の4件（edit/delete は出ない）', async ({ page }) => {
		await page.goto('/locale?lang=ja&next=/login');
		await signupNewUser(page);
		const title = `overlap other post ${Date.now()}`;
		await submitStory(page, { title, text: 'body' });
		await page.goto('/logout');

		const viewer = await signupNewUser(page);
		updateUserKarma(viewer, 50);
		await page.goto('/newest');
		const storyId = await findStoryIdByTitle(page, title);
		await page.goto(`/item/${storyId}`);
		await page.waitForLoadState('networkidle');
		await turnAssistOn(page);

		const hints = page.locator('.item-meta + .assist-hint-list').locator('.assist-hint');
		await expect(hints).toHaveCount(4);
		await expect(hints.nth(0)).toContainText('▲ は upvote（投票）');
		await expect(hints.nth(1)).toContainText('非表示（hide）');
		await expect(hints.nth(2)).toContainText('お気に入り（favorite）');
		await expect(hints.nth(3)).toContainText('通報（flag）');
	});

	test('ゲスト（未ログイン）: item-meta 直後のヒント一覧は item.upvote の1件だけ', async ({ page }) => {
		await page.goto('/locale?lang=ja&next=/item/1');
		await page.waitForLoadState('networkidle');
		await turnAssistOn(page);

		const hints = page.locator('.item-meta + .assist-hint-list').locator('.assist-hint');
		await expect(hints).toHaveCount(1);
		await expect(hints.first()).toContainText('▲ は upvote（投票）');
	});

	test('編集窓超過（3時間前）: edit/delete ヒントが消え、upvote/hide/favorite は残る', async ({ page }) => {
		await page.goto('/locale?lang=ja&next=/login');
		await signupNewUser(page);
		const title = `edit window hint ${Date.now()}`;
		await submitStory(page, { title, text: 'body' });
		await page.goto('/newest');
		const storyId = await findStoryIdByTitle(page, title);
		setStoryCreatedAt(storyId, 3);
		await page.goto(`/item/${storyId}`);
		await page.waitForLoadState('networkidle');
		await turnAssistOn(page);

		const hints = page.locator('.item-meta + .assist-hint-list').locator('.assist-hint');
		await expect(hints).toHaveCount(3);
		await expect(hints.filter({ hasText: '編集（edit）' })).toHaveCount(0);
		await expect(hints.filter({ hasText: '削除（delete）' })).toHaveCount(0);
		await expect(hints.filter({ hasText: '非表示（hide）' })).toHaveCount(1);
		await expect(hints.filter({ hasText: 'お気に入り（favorite）' })).toHaveCount(1);
	});

	test('自分の投稿では karma が十分でも item.flag ヒントが決して出ない', async ({ page }) => {
		await page.goto('/locale?lang=ja&next=/login');
		const username = await signupNewUser(page);
		updateUserKarma(username, 50);
		const title = `own post high karma no flag ${Date.now()}`;
		await submitStory(page, { title, text: 'body' });
		await page.goto('/newest');
		const storyId = await findStoryIdByTitle(page, title);
		await page.goto(`/item/${storyId}`);
		await page.waitForLoadState('networkidle');
		await turnAssistOn(page);

		// own post なので upvote/edit/delete/hide/favorite の5件のみ。flag は karma が十分でも出ない。
		const hints = page.locator('.item-meta + .assist-hint-list').locator('.assist-hint');
		await expect(hints).toHaveCount(5);
		await expect(hints.filter({ hasText: '通報（flag）' })).toHaveCount(0);
	});
});

test.describe('assist element hints (#172): comment row hint list', () => {
	test('最初のコメント行の直後に comment-toggle/reply の2件がこの順に並ぶ', async ({ page }) => {
		// seed story id=8 (BBS) は 5段ネストのコメントツリー(id 15→16→17→18→19)を持つ。
		// DFS 平坦化順の先頭は id=15 = firstCommentId。
		await page.goto('/locale?lang=ja&next=/login');
		await signupNewUser(page);
		await page.goto('/item/8');
		await page.waitForLoadState('networkidle');
		await turnAssistOn(page);

		const list = page.locator('#item-15 + .assist-hint-list');
		await expect(list).toHaveCount(1);
		const hints = list.locator('.assist-hint');
		await expect(hints).toHaveCount(2);
		await expect(hints.nth(0)).toContainText('たたみ');
		await expect(hints.nth(1)).toContainText('返信（reply）');

		// 後続のコメント行（id=16 以降）には出ない（連呼防止）。
		await expect(page.locator('#item-16 + .assist-hint-list')).toHaveCount(0);
	});

	test('未ログインでコメントがある投稿では item.comment-toggle は出るが item.reply は出ない', async ({
		page
	}) => {
		await page.goto('/locale?lang=ja&next=/item/8');
		await page.waitForLoadState('networkidle');
		await turnAssistOn(page);

		const hints = page.locator('#item-15 + .assist-hint-list').locator('.assist-hint');
		await expect(hints).toHaveCount(1);
		await expect(hints.first()).toContainText('たたみ');
	});

	test('コメント0件のストーリーでは comments-section 内に assist-hint-list が出ずクラッシュしない', async ({
		page
	}) => {
		const errors: string[] = [];
		page.on('pageerror', (e) => errors.push(String(e)));

		await signupNewUser(page);
		const title = `zero comments ${Date.now()}`;
		await submitStory(page, { title, text: 'body' });
		await page.goto('/newest');
		const storyId = await findStoryIdByTitle(page, title);
		await page.goto(`/item/${storyId}`);
		await page.waitForLoadState('networkidle');
		await turnAssistOn(page);

		await expect(page.locator('.comment-item')).toHaveCount(0);
		await expect(page.locator('.comments-section .assist-hint-list')).toHaveCount(0);
		// ページ自体はクラッシュせず正常に描画されている。
		await expect(page.locator('.item-title', { hasText: title })).toBeVisible();
		expect(errors).toEqual([]);
	});
});

test.describe('assist element hints (#172): narrow viewport (#174 fix confirmation)', () => {
	test('375×667 でも item-meta ヒント一覧が画面右にはみ出さず、正しい件数で表示される', async ({ page }) => {
		// #174: 旧 .assist-hint-float 設計では固定 px オフセット絶対配置＋width:max-content により、
		// 375px 幅で一部ヒントが右に100px超はみ出していた（既知のギャップ、test.fail() で明示していた）。
		// document フロー配置への置き換えでコンテナ幅に自然に収まるようになったはずなので、通常の
		// assertion に格上げして確認する。
		await page.setViewportSize({ width: 375, height: 667 });
		await signupNewUser(page);
		const title = `narrow viewport own post ${Date.now()}`;
		await submitStory(page, { title, text: 'body' });
		await page.goto('/newest');
		const storyId = await findStoryIdByTitle(page, title);
		await page.goto(`/item/${storyId}`);
		await page.waitForLoadState('networkidle');
		await turnAssistOn(page);

		const list = page.locator('.item-meta + .assist-hint-list');
		const hints = list.locator('.assist-hint');
		await expect(hints).toHaveCount(5);
		for (let i = 0; i < 5; i++) {
			const box = await hints.nth(i).boundingBox();
			expect(box, `hint ${i} has no boundingBox`).not.toBeNull();
			expect(
				box!.x + box!.width,
				`hint ${i} が画面右(375px)からはみ出している: ${JSON.stringify(box)}`
			).toBeLessThanOrEqual(375);
			expect(box!.x, `hint ${i} が画面左からはみ出している: ${JSON.stringify(box)}`).toBeGreaterThanOrEqual(0);
		}
	});

	test('375×667 でも一覧ページの先頭行ヒントが画面右にはみ出さない', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/newest');
		await page.waitForLoadState('networkidle');
		await turnAssistOn(page);

		const hints = page.locator('.story-list > .assist-hint-list').locator('.assist-hint');
		const count = await hints.count();
		expect(count).toBeGreaterThan(0);
		for (let i = 0; i < count; i++) {
			const box = await hints.nth(i).boundingBox();
			expect(box).not.toBeNull();
			expect(box!.x + box!.width, `hint ${i} が画面右(375px)からはみ出している`).toBeLessThanOrEqual(375);
		}
	});
});

test.describe('assist element hints (#172): state transitions', () => {
	test('assistFirst 行で hide をクリックすると、次の行に upvote ヒントが1つだけ移り、古い行に残らない', async ({
		page
	}) => {
		await signupNewUser(page);
		await page.goto('/newest');
		await page.waitForLoadState('networkidle');
		await turnAssistOn(page);

		await expect(page.locator('.assist-hint', { hasText: 'upvote' })).toHaveCount(1);

		const firstItem = page.locator('.story-item').first();
		const firstTitle = await firstItem.locator('.story-title').innerText();
		await firstItem.locator('.story-meta a[href="#hide"]').click();
		await page.waitForLoadState('networkidle');

		// 隠した行はもう一覧に無い。
		await expect(
			page.locator('.story-item').filter({ has: page.locator('.story-title', { hasText: firstTitle }) })
		).toHaveCount(0);
		// upvote ヒントは重複せず1個だけ（新しい先頭行に移った）、かつ .story-list 直下のリストは1つだけ。
		await expect(page.locator('.assist-hint', { hasText: 'upvote' })).toHaveCount(1);
		await expect(page.locator('.story-list > .assist-hint-list')).toHaveCount(1);
	});

	test('assist ON→OFF→ON を素早く繰り返しても表示中の assist-hint 個数が毎回同じで累積しない', async ({
		page
	}) => {
		await page.goto('/newest');
		await page.waitForLoadState('networkidle');
		const sw = page.locator('.assist-switch');

		await sw.click(); // ON
		const initialCount = await page.locator('.assist-hint:visible').count();
		expect(initialCount).toBeGreaterThan(0);

		for (let i = 0; i < 3; i++) {
			await sw.click(); // OFF
			await expect(page.locator('.assist-hint:visible')).toHaveCount(0);
			await sw.click(); // ON
			await expect(page.locator('.assist-hint:visible')).toHaveCount(initialCount);
		}
	});
});

test.describe('assist element hints (#172): i18n wiring', () => {
	test('en ロケールで /item の item-meta ヒント一覧が英語テキストで出る', async ({ page }) => {
		await page.goto('/locale?lang=en&next=/login');
		await signupNewUser(page);
		const title = `en edit hint ${Date.now()}`;
		await submitStory(page, { title, text: 'body' });
		await page.goto('/newest');
		const storyId = await findStoryIdByTitle(page, title);
		await page.goto(`/item/${storyId}`);
		await page.waitForLoadState('networkidle');
		await turnAssistOn(page);

		const hints = page.locator('.item-meta + .assist-hint-list').locator('.assist-hint');
		await expect(hints.filter({ hasText: 'edit lets you change the post' })).toHaveCount(1);
	});

	test('en ロケールで一覧の先頭行ヒントが英語テキストで出る', async ({ page }) => {
		await page.goto('/locale?lang=en&next=/newest');
		await page.waitForLoadState('networkidle');
		await turnAssistOn(page);

		const hints = page.locator('.story-list > .assist-hint-list').locator('.assist-hint');
		await expect(hints.filter({ hasText: 'hide removes this post' })).toHaveCount(1);
	});
});

test.describe('assist element hints (#172): console error smoke', () => {
	test('own-post 最大ヒント表示シナリオで console error が出ない', async ({ page }) => {
		const errors: string[] = [];
		page.on('console', (msg) => {
			if (msg.type() === 'error') errors.push(msg.text());
		});

		await signupNewUser(page);
		const title = `console smoke ${Date.now()}`;
		await submitStory(page, { title, text: 'body' });
		await page.goto('/newest');
		const storyId = await findStoryIdByTitle(page, title);
		await page.goto(`/item/${storyId}`);
		await page.waitForLoadState('networkidle');
		await turnAssistOn(page);

		await expect(page.locator('.item-meta + .assist-hint-list').locator('.assist-hint')).toHaveCount(5);
		expect(errors).toEqual([]);
	});
});
