import { expect, test, type Page } from '@playwright/test';

/**
 * #177 のヒットテスト用ヘルパー。document.elementFromPoint による実ブラウザのヒットテストを直接
 * 検証する（コンテンツの重なりに依存する再現方法は座標依存で flaky になりやすいため避ける）。
 */
async function isElementAtPointInside(
	page: Page,
	point: { x: number; y: number },
	selector: string
): Promise<boolean> {
	return page.evaluate(
		({ x, y, selector }) => {
			const el = document.elementFromPoint(x, y);
			return el !== null && el.closest(selector) !== null;
		},
		{ x: point.x, y: point.y, selector }
	);
}

function centerOf(box: { x: number; y: number; width: number; height: number }): {
	x: number;
	y: number;
} {
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

type Box = { x: number; y: number; width: number; height: number };

/** 2つの矩形が実際に重なっているか（隙間なしの隣接や交差なしは false）。 */
function boxesOverlap(a: Box, b: Box): boolean {
	const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
	const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
	return overlapX > 0 && overlapY > 0;
}

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

	test('メタ箱は ⓘ＋スイッチの真上＝.assist-meta の y が .assist-dock-controls より小さい (#170)', async ({
		page
	}) => {
		// #170: メタ解説は最上部 .assist-hint から右下ドックへ移設し、ⓘ＋スイッチ（.assist-dock-controls）の
		// 真上に右寄せで積む。実レイアウトの bounding box で「メタが上」を保証する（CSS の縦積み順の回帰防止）。
		await page.goto('/locale?lang=ja&next=/newest');
		await page.waitForLoadState('networkidle');
		const sw = page.locator('.assist-switch');
		await expect(sw).toHaveAttribute('aria-checked', 'false');
		await sw.click();

		const meta = page.locator('.assist-meta');
		const controls = page.locator('.assist-dock-controls');
		await expect(meta).toBeVisible();
		await expect(controls).toBeVisible();

		const metaBox = await meta.boundingBox();
		const controlsBox = await controls.boundingBox();
		expect(metaBox).not.toBeNull();
		expect(controlsBox).not.toBeNull();
		// y（top）が小さい＝画面上で上にある。メタが ⓘ＋スイッチの真上。
		expect((metaBox as { y: number }).y).toBeLessThan((controlsBox as { y: number }).y);
	});

	test('en ロケールでも ON でメタが可視になり、英語メタ文（Assist を含む）が出る (#170)', async ({
		page
	}) => {
		// 既存テストは ja 中心なので en の最小スモーク。en でもメタ箱が ON ゲートで可視になり、英語で出る。
		await page.goto('/locale?lang=en&next=/newest');
		await page.waitForLoadState('networkidle');
		const sw = page.locator('.assist-switch');
		await expect(sw).toHaveAttribute('aria-checked', 'false');
		await sw.click();

		const meta = page.locator('.assist-meta');
		await expect(meta).toBeVisible();
		await expect(meta).toContainText('Assist');
		// en なので日本語のメタ文（「言語」）は出ない（ロケール分離）。
		await expect(meta).not.toContainText('言語');
	});

	test.describe('.assist-dock は背後のクリックを奪わない (#177)', () => {
		// #177: .assist-dock は背景色もサイズ指定も持たない div で、子要素（.assist-meta 等）の flow に
		// 合わせて箱が広がる。子に pointer-events: none を付けるだけでは親の箱全体がヒットテスト対象に
		// なり続け、.assist-meta の可視領域や flex gap 部分に重なる背後のクリックを奪ってしまっていた。
		// 修正: .assist-dock に pointer-events: none、実際にクリック可能な .assist-dock-controls
		// （ⓘ＋スイッチ）だけ pointer-events: auto で復元。
		//
		// 以下は全て ja ロケール（/locale?lang=ja&next=/newest）で実施し、既存テストの ja 中心方針と
		// あわせて i18n 代表確認（複数行折り返しを含むメタ文）も兼ねる。

		test('.assist-meta の矩形は背後のクリックを奪わない', async ({ page }) => {
			await page.goto('/locale?lang=ja&next=/newest');
			await page.waitForLoadState('networkidle');
			const sw = page.locator('.assist-switch');
			await expect(sw).toHaveAttribute('aria-checked', 'false');
			await sw.click();

			const meta = page.locator('.assist-meta');
			await expect(meta).toBeVisible();
			const box = await meta.boundingBox();
			expect(box).not.toBeNull();

			expect(await isElementAtPointInside(page, centerOf(box!), '.assist-dock')).toBe(false);
		});

		test('.assist-dock-controls は引き続きクリック可能（ⓘ/スイッチの回帰ガード）', async ({ page }) => {
			await page.goto('/locale?lang=ja&next=/newest');
			await page.waitForLoadState('networkidle');
			const sw = page.locator('.assist-switch');
			await expect(sw).toHaveAttribute('aria-checked', 'false');
			await sw.click();

			const about = page.locator('.assist-about');
			const switchBtn = page.locator('.assist-switch');
			await expect(about).toBeVisible();
			await expect(switchBtn).toBeVisible();
			const aboutBox = await about.boundingBox();
			const switchBox = await switchBtn.boundingBox();
			expect(aboutBox).not.toBeNull();
			expect(switchBox).not.toBeNull();

			// ⓘ は .assist-about（かその子孫の svg）がヒットする。
			expect(await isElementAtPointInside(page, centerOf(aboutBox!), '.assist-about')).toBe(true);
			// スイッチは .assist-switch（かその子孫の span）がヒットする。
			expect(await isElementAtPointInside(page, centerOf(switchBox!), '.assist-switch')).toBe(
				true
			);
		});

		test('.assist-meta と .assist-dock-controls の間の gap もクリックを奪わない', async ({ page }) => {
			await page.goto('/locale?lang=ja&next=/newest');
			await page.waitForLoadState('networkidle');
			const sw = page.locator('.assist-switch');
			await expect(sw).toHaveAttribute('aria-checked', 'false');
			await sw.click();

			const meta = page.locator('.assist-meta');
			const controls = page.locator('.assist-dock-controls');
			await expect(meta).toBeVisible();
			await expect(controls).toBeVisible();
			const metaBox = await meta.boundingBox();
			const controlsBox = await controls.boundingBox();
			expect(metaBox).not.toBeNull();
			expect(controlsBox).not.toBeNull();
			// gap が実際に存在すること（隙間なしに隣接していたらこのテストは意味を持たない）。
			expect(controlsBox!.y).toBeGreaterThan(metaBox!.y + metaBox!.height);

			const gapPoint = {
				x: metaBox!.x + metaBox!.width / 2,
				y: (metaBox!.y + metaBox!.height + controlsBox!.y) / 2
			};
			expect(await isElementAtPointInside(page, gapPoint, '.assist-dock')).toBe(false);
		});

		test('assist OFF でも同座標のクリックは奪われない', async ({ page }) => {
			await page.goto('/locale?lang=ja&next=/newest');
			await page.waitForLoadState('networkidle');
			const sw = page.locator('.assist-switch');
			await expect(sw).toHaveAttribute('aria-checked', 'false');

			// ON にして .assist-meta の座標を記録してから OFF に戻す。OFF では .assist-meta は
			// display: none で描画自体されないため、同じ座標が「メタがあれば占めていたはずの場所」
			// で奪われないことを確認する（ドックの箱がメタ分だけ縮む挙動の回帰ガードも兼ねる）。
			await sw.click();
			const meta = page.locator('.assist-meta');
			await expect(meta).toBeVisible();
			const box = await meta.boundingBox();
			expect(box).not.toBeNull();
			const point = centerOf(box!);

			await sw.click();
			await expect(sw).toHaveAttribute('aria-checked', 'false');
			await expect(meta).toBeHidden();

			expect(await isElementAtPointInside(page, point, '.assist-dock')).toBe(false);
		});

		test('ON→OFF→ON を往復しても当たり判定が保たれる（状態遷移）', async ({ page }) => {
			await page.goto('/locale?lang=ja&next=/newest');
			await page.waitForLoadState('networkidle');
			const sw = page.locator('.assist-switch');
			await expect(sw).toHaveAttribute('aria-checked', 'false');

			await sw.click();
			await expect(sw).toHaveAttribute('aria-checked', 'true');
			await sw.click();
			await expect(sw).toHaveAttribute('aria-checked', 'false');
			await sw.click();
			await expect(sw).toHaveAttribute('aria-checked', 'true');

			const meta = page.locator('.assist-meta');
			await expect(meta).toBeVisible();
			const metaBox = await meta.boundingBox();
			expect(metaBox).not.toBeNull();
			expect(await isElementAtPointInside(page, centerOf(metaBox!), '.assist-dock')).toBe(false);

			const about = page.locator('.assist-about');
			const aboutBox = await about.boundingBox();
			expect(aboutBox).not.toBeNull();
			expect(await isElementAtPointInside(page, centerOf(aboutBox!), '.assist-about')).toBe(true);
		});

		test('375×667 でメタ文が横幅いっぱいに広がってもクリックを奪わない（Issue再現条件）', async ({
			page
		}) => {
			// #177 の実再現条件: 狭幅ビューポートで .assist-meta が max-width: calc(100vw - 28px) まで
			// 広がった状態でも、矩形全域が背後のクリックを奪わないことを確認する。
			const errors: string[] = [];
			page.on('pageerror', (e) => errors.push(String(e)));

			await page.setViewportSize({ width: 375, height: 667 });
			await page.goto('/locale?lang=ja&next=/newest');
			await page.waitForLoadState('networkidle');
			const sw = page.locator('.assist-switch');
			await expect(sw).toHaveAttribute('aria-checked', 'false');
			await sw.click();

			const meta = page.locator('.assist-meta');
			await expect(meta).toBeVisible();
			const box = await meta.boundingBox();
			expect(box).not.toBeNull();
			// 帯の左端寄り・中央の2点で確認する（幅いっぱいに広がった帯全体が奪わないことを見る）。
			const leftPoint = { x: box!.x + 10, y: box!.y + box!.height / 2 };

			expect(await isElementAtPointInside(page, leftPoint, '.assist-dock')).toBe(false);
			expect(await isElementAtPointInside(page, centerOf(box!), '.assist-dock')).toBe(false);
			expect(errors).toEqual([]);
		});

		test('実コンテンツ越しの通常クリックが通る: /item/7 の [–] を force なしで畳める (#177 e2e)', async ({
			page
		}) => {
			// 上記のテスト群は document.elementFromPoint によるヒットテストそのものの検証。ここでは
			// 「実コンテンツと重なった状態で、force なしの通常クリックが本当に通る」という end-to-end
			// シナリオを1本足す。レビュー時の実機確認: 375×667・ja・assist ON で /item/7 を開くと、
			// コメントスレッド5番目（id 14, sato）の [–] 折り畳みリンクが .assist-dock の bounding box と
			// 重なる（seed データを実測して確認済み: db/seed.sql の story_id=7 は id 10/11/12/13/14 の
			// 5コメントを持ち、DFS 表示順の最後が id 14＝sato）。
			//
			// 対象コメント・座標は seed データの変更で将来ズレる可能性があるので、クリック前に
			// .assist-dock と対象トグルリンクの bounding box が実際に重なっていることをアサートする。
			// 重ならなくなったら「重なっていない」という分かりやすい理由でここが失敗する（silent skip はしない）。
			await page.setViewportSize({ width: 375, height: 667 });
			await page.goto('/locale?lang=ja&next=/item/7');
			await page.waitForLoadState('networkidle');
			const sw = page.locator('.assist-switch');
			await expect(sw).toHaveAttribute('aria-checked', 'false');
			await sw.click();

			const dock = page.locator('.assist-dock');
			await expect(dock).toBeVisible();
			const dockBox = await dock.boundingBox();
			expect(dockBox).not.toBeNull();

			const toggle = page.locator('#item-14 .comment-toggle a');
			await expect(toggle).toBeVisible();
			await expect(toggle).toHaveText('[–]');
			const toggleBox = await toggle.boundingBox();
			expect(toggleBox).not.toBeNull();

			expect(
				boxesOverlap(dockBox as Box, toggleBox as Box),
				`前提条件が崩れている: #item-14 の [–] (${JSON.stringify(toggleBox)}) が ` +
					`.assist-dock (${JSON.stringify(dockBox)}) と重なっていない。seed データか ` +
					`レイアウトが変わった可能性がある（このテストの再現条件を見直すこと）`
			).toBe(true);

			// force なしの通常クリック。.assist-dock が背後のクリックを奪っていれば、ここが
			// タイムアウトするか無関係な要素をクリックしてしまい、状態が変わらない。
			await toggle.click();
			await expect(toggle).toHaveText('[+]');
			// トグルの見た目だけでなく、実際にコメントが畳まれた（本文が DOM から消えた）ことも確認する。
			await expect(page.locator('#item-14 .comment-text')).toHaveCount(0);
		});
	});
});
