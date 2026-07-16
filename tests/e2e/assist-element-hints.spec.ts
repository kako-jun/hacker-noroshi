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
 * comment-toggle/reply）へ再設計。各コントロールの真横に `.assist-hint-float` として
 * フロート表示する。
 *
 * ここでは以下を確認する:
 *  A. 重なり回帰ガード（複数ヒント同時表示で互いに重ならない・画面外に出ない）
 *  B. 正常系（コントロール単位の紐付け＝どのヒントがどのリンク直下に出るか）
 *  C. 権限・条件分岐（ゲスト・own post・編集窓・0コメント）
 *  E. 状態遷移（hide でのヒント移動、assist ON/OFF 連打）
 *  F. i18n 実配線（en ロケール）
 *  G. console error スモーク
 *
 * assistHint 自体の文言・キー網羅は tests/unit/assist.test.ts でカバー済みなのでここでは
 * 「実際の画面のどこに出るか／出ないか」だけを見る。
 */

type Box = { x: number; y: number; width: number; height: number };

/** 2つの矩形が重なっていれば true。 */
function boxesOverlap(a: Box, b: Box): boolean {
	return !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
}

/** locator が指す複数要素の boundingBox を順に取得する（null は無い前提で assert する）。 */
async function boxesOf(locator: ReturnType<Page['locator']>, count: number): Promise<Box[]> {
	const boxes: Box[] = [];
	for (let i = 0; i < count; i++) {
		const box = await locator.nth(i).boundingBox();
		expect(box, `element ${i} has no boundingBox (not rendered/visible?)`).not.toBeNull();
		boxes.push(box as Box);
	}
	return boxes;
}

/** 全ペアで重なりが無いことを assert する。 */
function expectNoOverlaps(boxes: Box[]): void {
	for (let i = 0; i < boxes.length; i++) {
		for (let j = i + 1; j < boxes.length; j++) {
			expect(boxesOverlap(boxes[i], boxes[j]), `hint ${i} と ${j} が重なっている: ${JSON.stringify(boxes[i])} / ${JSON.stringify(boxes[j])}`).toBe(
				false
			);
		}
	}
}

/** assist スイッチを ON にする（既定 OFF を前提に1回クリック）。 */
async function turnAssistOn(page: Page): Promise<void> {
	const sw = page.locator('.assist-switch');
	await expect(sw).toHaveAttribute('aria-checked', 'false');
	await sw.click();
}

test.describe('assist element hints (#172): overlap regression guard', () => {
	test('own-post: edit/delete/hide/favorite の4ヒント同時表示でも互いに重ならない（表1・行2）', async ({
		page
	}) => {
		await signupNewUser(page);
		const title = `overlap own post ${Date.now()}`;
		await submitStory(page, { title, text: 'body' });
		await page.goto('/newest');
		const storyId = await findStoryIdByTitle(page, title);
		await page.goto(`/item/${storyId}`);
		await page.waitForLoadState('networkidle');
		await turnAssistOn(page);

		const hints = page.locator('.item-meta .assist-hint-float');
		await expect(hints).toHaveCount(4);
		expectNoOverlaps(await boxesOf(hints, 4));
	});

	test('他人の投稿・高カルマ: hide/favorite/flag の3ヒント同時表示でも互いに重ならない（表1・行5）', async ({
		page
	}) => {
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

		// edit/delete は他人の投稿なので出ない（この3つだけが対象）。
		await expect(page.locator('.item-meta .assist-anchor').filter({ has: page.locator('a[href="#edit"]') })).toHaveCount(0);
		const hints = page.locator('.item-meta .assist-hint-float');
		await expect(hints).toHaveCount(3);
		expectNoOverlaps(await boxesOf(hints, 3));
	});

	test('一覧 assistFirst 行: upvote/hide/comments/flag の4ヒントが同時表示でも重ならず、upvote は story-meta 側ヒント群より下に浮く（表2・行4）', async ({
		page
	}) => {
		await signupNewUser(page);
		const title = `overlap list assistFirst ${Date.now()}`;
		await submitStory(page, { title, text: 'body' });
		await page.goto('/logout');

		const viewer = await signupNewUser(page);
		updateUserKarma(viewer, 50);
		await page.goto('/newest');
		await page.waitForLoadState('networkidle');
		// 直前に投稿した story が最新なので先頭行のはず（assistFirst はこの行に出る）。
		await expect(page.locator('.story-item').first().locator('.story-title')).toHaveText(title);
		await turnAssistOn(page);

		const firstItem = page.locator('.story-item').first();
		const allHints = firstItem.locator('.assist-hint-float');
		await expect(allHints).toHaveCount(4);
		expectNoOverlaps(await boxesOf(allHints, 4));

		const upvoteAnchorBox = await firstItem.locator('.story-vote').boundingBox();
		const upvoteBox = await firstItem.locator('.story-vote .assist-hint-float').boundingBox();
		const metaHints = firstItem.locator('.story-meta .assist-hint-float');
		await expect(metaHints).toHaveCount(3);
		const metaBoxes = await boxesOf(metaHints, 3);
		expect(upvoteBox).not.toBeNull();
		expect(upvoteAnchorBox).not.toBeNull();
		for (const metaBox of metaBoxes) {
			expect((upvoteBox as Box).y, 'upvote ヒントが story-meta 側ヒントより下にない').toBeGreaterThan(metaBox.y);
		}
		// #172 must 1 回帰ガード: 旧 190px オフセットでは upvote ヒントが自分の行から5行下（約216px）まで
		// 離れ、無関係な行のタイトル群に重なっていた。近傍（200px以内）に留まることを確認する。
		expect(
			(upvoteBox as Box).y - (upvoteAnchorBox as Box).y,
			'upvote ヒントが自分の▲から離れすぎている（無関係な行に重なる不具合の再発）'
		).toBeLessThan(200);
	});

	test('▲（14px幅）直下のヒントは横幅つぶれで縦に潰れない（アンカー幅より明確に広く・異常な高さでない）', async ({
		page
	}) => {
		// upvote ヒントは assistFirst であれば未ログインでも出る（データ依存なし）。
		await page.goto('/newest');
		await page.waitForLoadState('networkidle');
		await turnAssistOn(page);

		const firstItem = page.locator('.story-item').first();
		const anchorBox = await firstItem.locator('.story-vote').boundingBox();
		const hintBox = await firstItem.locator('.story-vote .assist-hint-float').boundingBox();
		expect(anchorBox).not.toBeNull();
		expect(hintBox).not.toBeNull();
		// アンカー（▲ボタン、数十px幅）よりヒントは明確に広い＝横幅つぶれで縦長になっていない。
		expect((hintBox as Box).width).toBeGreaterThan((anchorBox as Box).width + 30);
		// 1〜2行程度に収まる高さで、縦に潰れて何行にもなっていない。
		expect((hintBox as Box).height).toBeLessThan(80);
	});

	test('狭幅ビューポート(375×667)でも item-meta の4ヒントが重ならず、画面右にはみ出さない', async ({
		page
	}) => {
		// 既知のギャップ（#172 テスト設計時点で判明・未修正）: .assist-hint-float は固定 px オフセット
		// （stagger-1〜4）と width:max-content/max-width:200pt の絶対配置で、狭幅向けの CSS 分岐が無い。
		// 375px 幅では stagger-3（item.favorite）のヒントが右に 100px 超はみ出す（実測確認済み）。
		// これはテストコードの誤りではなくプロダクション側の未対応（本タスクでは実装変更禁止のため
		// 直さない）。重なり無しは満たすので、はみ出し検知だけ test.fail() で「現状は失敗して当然」と
		// 明示する。将来レスポンシブ対応が入って通るようになったら、この行を消して昇格させる。
		test.fail(true, '#172: 狭幅ビューポートでの assist-hint-float 右はみ出し（CSS 未対応、既知のギャップ）');
		await page.setViewportSize({ width: 375, height: 667 });
		await signupNewUser(page);
		const title = `narrow viewport own post ${Date.now()}`;
		await submitStory(page, { title, text: 'body' });
		await page.goto('/newest');
		const storyId = await findStoryIdByTitle(page, title);
		await page.goto(`/item/${storyId}`);
		await page.waitForLoadState('networkidle');
		await turnAssistOn(page);

		const hints = page.locator('.item-meta .assist-hint-float');
		await expect(hints).toHaveCount(4);
		const boxes = await boxesOf(hints, 4);
		expectNoOverlaps(boxes);
		for (const box of boxes) {
			expect(box.x + box.width, `ヒントが画面右(375px)からはみ出している: ${JSON.stringify(box)}`).toBeLessThanOrEqual(375);
		}
	});
});

test.describe('assist element hints (#172): control-to-hint mapping', () => {
	test('一覧: story.hide が hide リンク直下、story.comments がコメント数リンク直下に出る', async ({
		page
	}) => {
		await page.goto('/locale?lang=ja&next=/newest');
		await page.waitForLoadState('networkidle');
		await turnAssistOn(page);

		// ゲストは flag が出ないので .story-meta 内の assist-anchor は [hide, comments] の2個で固定。
		const anchors = page.locator('.story-item').first().locator('.story-meta .assist-anchor');
		await expect(anchors).toHaveCount(2);
		await expect(anchors.nth(0).locator('.assist-hint-float')).toContainText('非表示（hide）');
		await expect(anchors.nth(1).locator('.assist-hint-float')).toContainText('コメント');
	});

	test('/item: item.edit / item.delete が各リンク直下に出る', async ({ page }) => {
		await page.goto('/locale?lang=ja&next=/login');
		await signupNewUser(page);
		const title = `mapping edit delete ${Date.now()}`;
		await submitStory(page, { title, text: 'body' });
		await page.goto('/newest');
		const storyId = await findStoryIdByTitle(page, title);
		await page.goto(`/item/${storyId}`);
		await page.waitForLoadState('networkidle');
		await turnAssistOn(page);

		const editAnchor = page.locator('.item-meta .assist-anchor').filter({ has: page.locator('a[href="#edit"]') });
		await expect(editAnchor.locator('.assist-hint-float')).toContainText('編集（edit）');
		const deleteAnchor = page.locator('.item-meta form[action="?/deleteStory"]');
		await expect(deleteAnchor.locator('.assist-hint-float')).toContainText('削除（delete）');
	});

	test('/item: item.hide / item.favorite が各リンク直下に出る', async ({ page }) => {
		await page.goto('/locale?lang=ja&next=/login');
		await signupNewUser(page);
		const title = `mapping hide favorite ${Date.now()}`;
		await submitStory(page, { title, text: 'body' });
		await page.goto('/newest');
		const storyId = await findStoryIdByTitle(page, title);
		await page.goto(`/item/${storyId}`);
		await page.waitForLoadState('networkidle');
		await turnAssistOn(page);

		const hideAnchor = page.locator('.item-meta .assist-anchor').filter({ has: page.locator('a[href="#hide"]') });
		await expect(hideAnchor.locator('.assist-hint-float')).toContainText('非表示（hide）');
		const favAnchor = page.locator('.item-meta .assist-anchor').filter({ has: page.locator('a[href="#favorite"]') });
		await expect(favAnchor.locator('.assist-hint-float')).toContainText('お気に入り（favorite）');
	});

	test('/item: item.comment-toggle が最初のコメント行の折り畳みリンク直下、item.reply が reply 直下に出る', async ({
		page
	}) => {
		// seed story id=8 (BBS) は 5段ネストのコメントツリー(id 15→16→17→18→19)を持つ。
		// DFS 平坦化順の先頭は id=15 = firstCommentId。
		await page.goto('/locale?lang=ja&next=/login');
		await signupNewUser(page);
		await page.goto('/item/8');
		await page.waitForLoadState('networkidle');
		await turnAssistOn(page);

		const firstComment = page.locator('#item-15');
		await expect(firstComment.locator('.comment-toggle .assist-hint-float')).toContainText('たたみ');
		await expect(firstComment.locator('.comment-reply .assist-hint-float')).toContainText('返信（reply）');
	});
});

test.describe('assist element hints (#172): permission & condition branches', () => {
	test('ゲスト（未ログイン）で /item を開くと item-meta 配下のヒントが0件（表1・行1）', async ({ page }) => {
		await page.goto('/item/1');
		await page.waitForLoadState('networkidle');
		await turnAssistOn(page);
		await expect(page.locator('.item-meta .assist-hint-float')).toHaveCount(0);
	});

	test('編集窓超過（3時間前）で item.edit/item.delete ヒントが消え、item.hide/item.favorite は残る（表1・行3）', async ({
		page
	}) => {
		await signupNewUser(page);
		const title = `edit window hint ${Date.now()}`;
		await submitStory(page, { title, text: 'body' });
		await page.goto('/newest');
		const storyId = await findStoryIdByTitle(page, title);
		setStoryCreatedAt(storyId, 3);
		await page.goto(`/item/${storyId}`);
		await page.waitForLoadState('networkidle');
		await turnAssistOn(page);

		await expect(page.locator('.item-meta .assist-anchor').filter({ has: page.locator('a[href="#edit"]') })).toHaveCount(0);
		await expect(page.locator('.item-meta form[action="?/deleteStory"]')).toHaveCount(0);
		await expect(
			page.locator('.item-meta .assist-anchor').filter({ has: page.locator('a[href="#hide"]') }).locator('.assist-hint-float')
		).toBeVisible();
		await expect(
			page.locator('.item-meta .assist-anchor').filter({ has: page.locator('a[href="#favorite"]') }).locator('.assist-hint-float')
		).toBeVisible();
	});

	test('自分の投稿では karma が十分でも item.flag ヒントが決して出ない（表1・行2との対比）', async ({ page }) => {
		const username = await signupNewUser(page);
		updateUserKarma(username, 50);
		const title = `own post high karma no flag ${Date.now()}`;
		await submitStory(page, { title, text: 'body' });
		await page.goto('/newest');
		const storyId = await findStoryIdByTitle(page, title);
		await page.goto(`/item/${storyId}`);
		await page.waitForLoadState('networkidle');
		await turnAssistOn(page);

		await expect(page.locator('.item-meta .assist-anchor').filter({ has: page.locator('a[href="#flag"]') })).toHaveCount(0);
	});

	test('コメント0件のストーリーでは item.comment-toggle/item.reply ヒントがどちらも出ずクラッシュしない（表3・行1）', async ({
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
		await expect(page.locator('.comments-section .assist-hint-float')).toHaveCount(0);
		// ページ自体はクラッシュせず正常に描画されている。
		await expect(page.locator('.item-title', { hasText: title })).toBeVisible();
		expect(errors).toEqual([]);
	});

	test('未ログインでコメントがある投稿では item.comment-toggle は出るが item.reply は出ない（表3・行2）', async ({
		page
	}) => {
		await page.goto('/item/8');
		await page.waitForLoadState('networkidle');
		await turnAssistOn(page);

		const firstComment = page.locator('#item-15');
		await expect(firstComment.locator('.comment-toggle .assist-hint-float')).toBeVisible();
		// reply ブロック自体が {#if data.user} でゲストには描画されない。
		await expect(firstComment.locator('.comment-reply')).toHaveCount(0);
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
		await firstItem.locator('.story-meta .assist-anchor a[href="#hide"]').click();
		await page.waitForLoadState('networkidle');

		// 隠した行はもう一覧に無い。
		await expect(page.locator('.story-item').filter({ has: page.locator('.story-title', { hasText: firstTitle }) })).toHaveCount(0);
		// upvote ヒントは重複せず1個だけ（新しい先頭行に移った）。
		await expect(page.locator('.assist-hint', { hasText: 'upvote' })).toHaveCount(1);
		await expect(page.locator('.story-item').first().locator('.assist-hint', { hasText: 'upvote' })).toHaveCount(1);
	});

	test('assist ON→OFF→ON を素早く繰り返しても assist-hint-float:visible の個数が毎回同じで累積しない', async ({
		page
	}) => {
		await page.goto('/newest');
		await page.waitForLoadState('networkidle');
		const sw = page.locator('.assist-switch');

		await sw.click(); // ON
		const initialCount = await page.locator('.assist-hint-float:visible').count();
		expect(initialCount).toBeGreaterThan(0);

		for (let i = 0; i < 3; i++) {
			await sw.click(); // OFF
			await expect(page.locator('.assist-hint-float:visible')).toHaveCount(0);
			await sw.click(); // ON
			await expect(page.locator('.assist-hint-float:visible')).toHaveCount(initialCount);
		}
	});
});

test.describe('assist element hints (#172): i18n wiring', () => {
	test('en ロケールで /item の item.edit ヒントが英語テキストで出る', async ({ page }) => {
		await page.goto('/locale?lang=en&next=/login');
		await signupNewUser(page);
		const title = `en edit hint ${Date.now()}`;
		await submitStory(page, { title, text: 'body' });
		await page.goto('/newest');
		const storyId = await findStoryIdByTitle(page, title);
		await page.goto(`/item/${storyId}`);
		await page.waitForLoadState('networkidle');
		await turnAssistOn(page);

		const editAnchor = page.locator('.item-meta .assist-anchor').filter({ has: page.locator('a[href="#edit"]') });
		await expect(editAnchor.locator('.assist-hint-float')).toContainText('edit lets you change the post');
	});

	test('en ロケールで一覧の story.hide ヒントが英語テキストで出る', async ({ page }) => {
		await page.goto('/locale?lang=en&next=/newest');
		await page.waitForLoadState('networkidle');
		await turnAssistOn(page);

		const hideAnchor = page.locator('.story-item').first().locator('.story-meta .assist-anchor').first();
		await expect(hideAnchor.locator('.assist-hint-float')).toContainText('hide removes this post');
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

		await expect(page.locator('.item-meta .assist-hint-float')).toHaveCount(4);
		expect(errors).toEqual([]);
	});
});
