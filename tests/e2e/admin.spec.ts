import { test, expect } from '@playwright/test';
import { signupNewUser, promoteToAdmin, cleanIpBans } from './helpers';

// run ごとにユニークな TEST-NET-2 (198.51.100.0/24・RFC 5737) アドレスを払い出す。
// ip_bans に ip の UNIQUE 制約が無く、固定 IP だと前回 run の残留 ban と衝突して
// ban→unban 後も行が残り toHaveCount(0) が非決定的に落ちていた（#167）。
function uniqueTestIp(): string {
	return `198.51.100.${(Date.now() % 254) + 1}`;
}

/**
 * Issue #122: /admin/ipban の admin 限定アクセスと手動 ban / unban。
 *
 * - 非 admin で /admin/ipban → 403
 * - admin で /admin/ipban → 200 + フォーム表示
 * - admin が IP を ban → 一覧に出る
 * - admin が unban → 消える
 *
 * NOTE: seed user の login が #125 で失敗するため、signup したユーザーを
 *       D1 直接 UPDATE で is_admin=1 に昇格させ、page を reload して使う。
 */
test.describe('admin /admin/ipban', () => {
	// 毎 run クリーンな状態から開始する（#167）。前回 run の afterAll が走らなかった／
	// local D1 が累積している場合でも残留 ban に依存しないよう、開始前にも掃除する。
	test.beforeAll(() => {
		cleanIpBans();
	});
	test.afterAll(() => {
		cleanIpBans();
	});

	test('非 admin で /admin/ipban → 403', async ({ page }) => {
		await signupNewUser(page);
		const res = await page.goto('/admin/ipban');
		expect(res?.status()).toBe(403);
	});

	test('admin で /admin/ipban → 200 + ban フォーム → ban → unban', async ({ page }) => {
		const adminUser = await signupNewUser(page);
		promoteToAdmin(adminUser);
		// セッション側の is_admin はサーバー時に SELECT し直されるので reload で十分。
		// (locals.user は session 経由 getSession で都度 DB から取得される)
		const res = await page.goto('/admin/ipban');
		expect(res?.status()).toBe(200);
		await expect(page.locator('text=新規 ban')).toBeVisible();

		// #126: SvelteKit のハイドレーションで input value が `value={form?.ip ?? ''}`
		// 経由でリセットされるため、ban 送信ボタンが enabled になり、Svelte runtime が
		// イベントを処理できる状態を待ってから fill する。
		const banButton = page.locator('button:has-text("ban する")');
		await expect(banButton).toBeEnabled();

		// 手動で run ごとにユニークな IP を ban（#167・残留 ban との衝突回避）
		const targetIp = uniqueTestIp();
		const reason = `e2e #126 ${Date.now()}`;
		const ipInput = page.locator('input[name="ip"]');
		const reasonInput = page.locator('input[name="reason"]');
		const expiresInput = page.locator('input[name="expiresIn"]');
		// #167: 真の flake 原因はハイドレーション・レース。fill した直後に Svelte が
		// `value={form?.ip ?? ''}` でフォームを再描画して入力値を空に戻すことがあり、
		// 「enabled を待って1回 fill」だけでは非決定的に空になる（Received ""）。
		// 値が定着するまで fill+検証をリトライして、ハイドレーション完了後の状態を掴む。
		await expect(async () => {
			await ipInput.fill(targetIp);
			await reasonInput.fill(reason);
			await expiresInput.fill('1');
			expect(await ipInput.inputValue()).toBe(targetIp);
			expect(await reasonInput.inputValue()).toBe(reason);
			expect(await expiresInput.inputValue()).toBe('1');
		}).toPass({ timeout: 10_000 });

		await banButton.click();
		// banError が出ていないことを先に確認
		const errorVisible = await page.locator('p[style*="ff0000"]').isVisible().catch(() => false);
		if (errorVisible) {
			const msg = await page.locator('p[style*="ff0000"]').innerText();
			throw new Error(`ban form error: ${msg}`);
		}
		// 一覧に出る
		await expect(page.locator(`.ipban-list td:has-text("${targetIp}")`).first()).toBeVisible({
			timeout: 10_000
		});

		// unban: 該当行の unban ボタンを押す
		const row = page
			.locator('.ipban-list tr')
			.filter({ has: page.locator(`td:has-text("${targetIp}")`) });
		await row.locator('button:has-text("unban")').click();
		// 消える
		await expect(page.locator(`.ipban-list td:has-text("${targetIp}")`)).toHaveCount(0);
	});
});
