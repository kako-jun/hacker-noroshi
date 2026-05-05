import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
	resolve: {
		alias: {
			// SvelteKit の $lib エイリアスをユニットテストでも解決する。
			// production の +page.server.ts を直接 import するテスト（item-actions.test.ts 等）で必要。
			$lib: fileURLToPath(new URL('./src/lib', import.meta.url))
		}
	},
	test: {
		include: ['tests/unit/**/*.test.ts'],
		environment: 'node'
	}
});
