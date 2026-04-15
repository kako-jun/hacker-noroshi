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
			} | null;
		}
		interface Platform {
			env: {
				DB: D1Database;
			};
		}
	}
}

export {};
