import { defineConfig, devices } from '@playwright/test';

// 監査用 config: 外部 URL（本番 + 本家 HN）を叩くため webServer は起動しない
export default defineConfig({
	testDir: 'tests/audit',
	fullyParallel: false,
	workers: 1,
	timeout: 60_000,
	use: {
		viewport: { width: 1280, height: 720 },
		trace: 'off'
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } }
		}
	]
});
