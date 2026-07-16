import { test, expect } from '@playwright/test';
import {
	signupNewUser,
	submitStory,
	postComment,
	findStoryIdByTitle,
	setStoryCreatedAt,
	setCommentCreatedAt
} from './helpers';

/**
 * Issue #179 バッチB: レート制限（story投稿10分 / comment投稿2分）の実動作確認。
 *
 * 閾値のミリ秒境界は tests/unit/rate-limit.test.ts と tests/unit/item-actions.test.ts
 * の 'comment action' describe で固定済みなので、ここでは実ブラウザで
 * .form-error / .comment-error に正しいメッセージが出ること、および
 * setStoryCreatedAt / setCommentCreatedAt で押し戻せば解除されることを確認する。
 *
 * comment のレート制限は user_id のみで判定され story/parent_id に無関係
 * （#179 バッチAで発見済み・スレッド横断で効く）ため、別スレッドへの投稿も
 * ブロックされることを合わせて確認する。
 */
test.describe('rate limit', () => {
	test('story投稿: 直後の2件目は429でブロックされ、1時間空ければ成功する', async ({ page }) => {
		await page.goto('/logout').catch(() => {});
		await signupNewUser(page);

		const titleA = `rate-limit story A ${Date.now()}`;
		await submitStory(page, { title: titleA, text: 'first submission' });
		await page.goto('/newest');
		const storyIdA = await findStoryIdByTitle(page, titleA);

		// 直後の2件目投稿は 429 でブロックされる
		const titleB = `rate-limit story B ${Date.now()}`;
		await page.goto('/submit');
		await page.waitForLoadState('networkidle');
		await page.fill('input[name="title"]', titleB);
		await page.fill('textarea[name="text"]', 'second, too fast');
		await page.click('button[type="submit"]');
		await expect(page.locator('.form-error')).toContainText("You're submitting too fast");

		// created_at を1時間前に押し戻せば、同じフォームからの再送信が成功する
		setStoryCreatedAt(storyIdA, 1);
		await page.click('button[type="submit"]');
		await page.waitForURL((u) => !u.pathname.startsWith('/submit'), { timeout: 30_000 });
		await expect(page.locator('.item-title')).toContainText(titleB);
	});

	test('comment投稿: 直後の2件目は429でブロックされ、別スレッドでも同様、1時間空ければ成功する', async ({
		page
	}) => {
		await page.goto('/logout').catch(() => {});
		await signupNewUser(page);

		const titleA = `rate-limit thread A ${Date.now()}`;
		await submitStory(page, { title: titleA, text: 'story A body' });
		await page.goto('/newest');
		const storyIdA = await findStoryIdByTitle(page, titleA);
		// 直後に story B を作ると自分の 10分クールダウン（story 投稿）に引っかかるため、
		// story A を1時間前に押し戻してから B を作る（comment のレート制限テストとは無関係な前提整備）。
		setStoryCreatedAt(storyIdA, 1);

		const titleB = `rate-limit thread B ${Date.now()}`;
		await submitStory(page, { title: titleB, text: 'story B body' });
		await page.goto('/newest');
		const storyIdB = await findStoryIdByTitle(page, titleB);

		// story A への1件目コメントは成功し、直後の2件目は 429 でブロックされる
		await page.goto(`/item/${storyIdA}`);
		await page.waitForLoadState('networkidle');
		await postComment(page, 'first comment on A');
		await expect(page.locator('.comment-item').first()).toBeVisible({ timeout: 10_000 });
		const elementId = await page.locator('.comment-item').first().getAttribute('id');
		const m = elementId!.match(/item-(\d+)/);
		const commentId = Number(m![1]);

		await postComment(page, 'second comment on A, too fast');
		await expect(page.locator('.comment-error')).toContainText("You're posting too fast");

		// 別スレッド(B)への投稿も、このユーザーの直近コメント時刻が基準になるためブロックされる
		await page.goto(`/item/${storyIdB}`);
		await page.waitForLoadState('networkidle');
		await postComment(page, 'comment on B, too fast (cross-thread)');
		await expect(page.locator('.comment-error')).toContainText("You're posting too fast");

		// 直近コメントを1時間前に押し戻せば、別スレッドへの投稿は成功する
		setCommentCreatedAt(commentId, 1);
		await postComment(page, 'comment on B, allowed now');
		await expect(page.locator('.comment-error')).toHaveCount(0);
		await expect(
			page.locator('.comment-text').filter({ hasText: 'comment on B, allowed now' })
		).toBeVisible();
	});
});
