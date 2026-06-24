import { expect, test } from '@playwright/test';

/**
 * アシストモード（#140）。右下の常設スイッチで「初心者の館」風の解説層をオン/オフする。
 * - 既定オフ＝素の HN 画面（.assist-intro は CSS で非表示）。
 * - オンで各画面上部に解説。cookie で永続（リロードしても維持）。
 * - オフで素の HN 画面に完全復元。
 */
test.describe('assist mode', () => {
	test('右下スイッチでトグルでき、cookie で永続し、オフで素の画面に戻る', async ({ page }) => {
		await page.goto('/');
		// hydration 完了前にクリックすると onclick 未装着で no-op になり flaky。他テストと同じく待つ。
		await page.waitForLoadState('networkidle');
		const sw = page.locator('.assist-switch');
		await expect(sw).toBeVisible();

		// 既定オフ：解説は隠れている。
		await expect(sw).toHaveAttribute('aria-checked', 'false');
		await expect(page.locator('.assist-intro').first()).toBeHidden();

		// オンにする：解説が出る。
		await sw.click();
		await expect(sw).toHaveAttribute('aria-checked', 'true');
		await expect(page.locator('.assist-intro').first()).toBeVisible();

		// リロードしても維持（cookie 永続・SSR で復元）。
		await page.reload();
		await expect(page.locator('.assist-switch')).toHaveAttribute('aria-checked', 'true');
		await expect(page.locator('.assist-intro').first()).toBeVisible();

		// オフにする：素の HN 画面へ完全復元（解説は隠れる）。
		await page.locator('.assist-switch').click();
		await expect(page.locator('.assist-switch')).toHaveAttribute('aria-checked', 'false');
		await expect(page.locator('.assist-intro').first()).toBeHidden();

		// オフもリロードを跨いで維持。
		await page.reload();
		await expect(page.locator('.assist-switch')).toHaveAttribute('aria-checked', 'false');
		await expect(page.locator('.assist-intro').first()).toBeHidden();
	});

	test('日本語ロケールではオン時に日本語の解説が出る', async ({ page }) => {
		await page.goto('/locale?lang=ja&next=/');
		await page.waitForLoadState('networkidle');
		// hydration 後にトグルが効くよう、押す前にスイッチの初期状態を待つ。
		const sw = page.locator('.assist-switch');
		await expect(sw).toHaveAttribute('aria-checked', 'false');
		await sw.click();
		const intro = page.locator('.assist-intro').first();
		await expect(intro).toBeVisible();
		await expect(intro).toContainText('ハッカーのろし');
	});

	test('intro は layout 集約済み＝辞書にキーを足しただけの /search でも解説が出る', async ({ page }) => {
		// #143: intro を各ページにベタ書きせず +layout.svelte で route id 引きに集約した。
		// /search は専用の描画コードを足していないのに、辞書キーがあるだけで解説が出る。
		await page.goto('/locale?lang=ja&next=/search');
		await page.waitForLoadState('networkidle');
		const sw = page.locator('.assist-switch');
		await expect(sw).toHaveAttribute('aria-checked', 'false');
		await sw.click();
		const intro = page.locator('.assist-intro').first();
		await expect(intro).toBeVisible();
		await expect(intro).toContainText('検索ページ');
	});

	test('検索結果（rank を渡さない一覧）でも先頭行に行コントロール解説が出る', async ({ page }) => {
		// 回帰防止: 以前は story.controls を絶対 rank===1 で出していたため、rank を渡さない /search では
		// 永久に出なかった。描画 index（assistFirst=i===0）に直したので検索結果の先頭行にも出る。
		await page.goto('/locale?lang=ja&next=' + encodeURIComponent('/search?q=HN'));
		await page.waitForLoadState('networkidle');
		const sw = page.locator('.assist-switch');
		await expect(sw).toHaveAttribute('aria-checked', 'false');
		// 検索結果が前提のテスト（シードに "Ask HN:"/"Show HN:" 等の HN 慣用句がある）。
		await expect(page.locator('.story-item').first()).toBeVisible();
		await sw.click();
		await expect(page.locator('.assist-hint', { hasText: 'upvote' })).toHaveCount(1);
		await expect(page.locator('.assist-hint', { hasText: 'upvote' })).toBeVisible();
	});

	test('ユーザーページでカルマの解説（karma 教育）が出る', async ({ page }) => {
		await page.goto('/locale?lang=ja&next=/');
		await page.waitForLoadState('networkidle');
		// 一覧の投稿者リンクから実在ユーザーの profile へ（locale cookie は ja のまま引き継がれる）。
		const authorHref = await page
			.locator('.story-meta a[href^="/user/"]')
			.first()
			.getAttribute('href');
		expect(authorHref).toBeTruthy();
		await page.goto(authorHref as string);
		// hydration 完了前にクリックすると onclick 未装着で no-op になり flaky（他テストと同じく待つ）。
		await page.waitForLoadState('networkidle');
		const sw = page.locator('.assist-switch');
		await expect(sw).toHaveAttribute('aria-checked', 'false');
		await sw.click();
		const intro = page.locator('.assist-intro').first();
		await expect(intro).toBeVisible();
		await expect(intro).toContainText('カルマ');
	});

	test('ⓘ リンクは常設で、assist OFF→ON 切替でも消えない（assist ゲート外）', async ({ page }) => {
		// #160: ⓘ は .assist-on 配下ではなく常設。assist の OFF/ON どちらでも見える。
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		const about = page.locator('.assist-about');
		const sw = page.locator('.assist-switch');

		// 既定 OFF でも ⓘ は見える。
		await expect(sw).toHaveAttribute('aria-checked', 'false');
		await expect(about).toBeVisible();

		// ON にしても ⓘ は見えたまま。
		await sw.click();
		await expect(sw).toHaveAttribute('aria-checked', 'true');
		await expect(about).toBeVisible();

		// もう一度 OFF に戻しても見えたまま。
		await sw.click();
		await expect(sw).toHaveAttribute('aria-checked', 'false');
		await expect(about).toBeVisible();
	});

	test('ⓘ の href はロケール別に正しく、別タブ（target=_blank・rel=noopener）で開く', async ({
		page
	}) => {
		// 既定（en）：ja prefix 無しの目的記事へ。
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		const aboutEn = page.locator('.assist-about');
		await expect(aboutEn).toHaveAttribute('href', 'https://llll-ll.com/posts/hacker-noroshi/');
		await expect(aboutEn).toHaveAttribute('target', '_blank');
		await expect(aboutEn).toHaveAttribute('rel', /noopener/);

		// ja に切り替えるとページ遷移するので locator を取り直して href を厳密一致で確認。
		await page.goto('/locale?lang=ja&next=/');
		await page.waitForLoadState('networkidle');
		const aboutJa = page.locator('.assist-about');
		await expect(aboutJa).toHaveAttribute('href', 'https://llll-ll.com/ja/posts/hacker-noroshi/');
		// 外部 URL なので実クリックでの遷移はしない（href 検証に留める）。
	});

	test('ⓘ リンクはスイッチより左（DOM 順で .assist-about が先頭）', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		// #170: ⓘ＋スイッチは .assist-dock-controls にまとまった（上にメタ解説）。その横並びの最初の子が
		// .assist-about（= 左）であること。
		const firstChild = page.locator('.assist-dock-controls > *:first-child');
		await expect(firstChild).toHaveClass(/assist-about/);

		// 念のため実レイアウトの x 座標でも about が switch より左にあることを確認。
		const aboutBox = await page.locator('.assist-about').boundingBox();
		const switchBox = await page.locator('.assist-switch').boundingBox();
		expect(aboutBox).not.toBeNull();
		expect(switchBox).not.toBeNull();
		expect((aboutBox as { x: number }).x).toBeLessThan((switchBox as { x: number }).x);
	});

	test('一覧の先頭行に行コントロール解説が1回だけ＋メタ解説も出て、OFF で全アシストが消える', async ({
		page
	}) => {
		await page.goto('/locale?lang=ja&next=/newest');
		await page.waitForLoadState('networkidle');
		const sw = page.locator('.assist-switch');
		await expect(sw).toHaveAttribute('aria-checked', 'false');

		// ON：行コントロール解説（▲ upvote）は先頭行に1回だけ。メタ解説（#170 で右下ドック上段 .assist-meta へ
		// 移設）も出る。
		await sw.click();
		await expect(page.locator('.assist-hint', { hasText: 'upvote' })).toHaveCount(1);
		await expect(page.locator('.assist-hint', { hasText: 'upvote' })).toBeVisible();
		await expect(page.locator('.assist-meta')).toBeVisible();
		await expect(page.locator('.assist-meta')).toContainText('言語');
		// 未ログインでは存在しないカルマ (123) の解説を出さない（ログイン時だけ meta.karma を足す）。
		await expect(page.locator('.assist-meta', { hasText: '(123)' })).toHaveCount(0);

		// OFF：素の HN へ完全復元＝解説もヒントもメタも1つも見えない（不変条件）。
		await page.locator('.assist-switch').click();
		await expect(page.locator('.assist-intro:visible')).toHaveCount(0);
		await expect(page.locator('.assist-hint:visible')).toHaveCount(0);
		await expect(page.locator('.assist-meta:visible')).toHaveCount(0);
	});
});
