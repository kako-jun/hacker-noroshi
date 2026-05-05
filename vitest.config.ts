import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
	resolve: {
		alias: {
			// SvelteKit の '$app/*' '$env/*' は本テストでは未使用のため未エイリアス。
			// 将来 +server.ts 等が依存し始めたらここで追加する。
			$lib: fileURLToPath(new URL('./src/lib', import.meta.url))
		}
	},
	test: {
		include: ['tests/unit/**/*.test.ts'],
		environment: 'node'
	}
});
