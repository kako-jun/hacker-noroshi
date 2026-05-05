/// <reference types="@cloudflare/workers-types" />

declare global {
	namespace App {
		interface Locals {
			user: {
				id: number;
				username: string;
				karma: number;
				delay: number;
				noprocrast: number;
				maxvisit: number;
				minaway: number;
				showdead: number;
				last_visit: string | null;
				is_admin: number;
			} | null;
		}
		interface Platform {
			env: {
				DB: D1Database;
				// Cloudflare Turnstile（#91 セルフ unban）。
				// SITE_KEY は public（フロントに渡す）、SECRET_KEY は server side のみ。
				// 未設定時は widget を出さない（dev 環境フェイルセーフ）。
				TURNSTILE_SITE_KEY?: string;
				TURNSTILE_SECRET_KEY?: string;
			};
		}
	}
}

export {};
