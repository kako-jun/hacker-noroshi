import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
	resolve: {
		alias: {
			// SvelteKit の $lib エイリアスをユニットテストでも解決する。
			// production の +server.ts / +page.server.ts を直接 import するテスト
			// （hide.test.ts, item-actions.test.ts 等）で必要。
			// '$app/*' '$env/*' は本テストでは未使用のため未エイリアス。
			// 将来必要になったらここで追加する。
			$lib: fileURLToPath(new URL('./src/lib', import.meta.url))
		}
	},
	test: {
		include: ['tests/unit/**/*.test.ts'],
		environment: 'node'
	}
});
