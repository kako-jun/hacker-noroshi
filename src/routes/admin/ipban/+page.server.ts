import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getDB, listActiveBans, createIpBan, removeIpBan } from '$lib/server/db';
import { isValidIpAddress } from '$lib/format';
import { requireAdmin } from '$lib/server/admin';

// reason 入力の上限。HTML5 maxlength と揃える。
const REASON_MAX_LENGTH = 1024;

export const load: PageServerLoad = async ({ platform }) => {
	const db = getDB(platform);
	const bans = await listActiveBans(db);
	return { bans };
};

export const actions: Actions = {
	// ban: 新規 ban を作成する。
	// expiresIn は時間単位。空欄 or 0 のときは無期限 ban (expires_at = NULL)。
	ban: async ({ request, locals, platform }) => {
		requireAdmin(locals);
		const data = await request.formData();
		const ip = String(data.get('ip') ?? '').trim();
		const reason = String(data.get('reason') ?? '').trim();
		const expiresInRaw = String(data.get('expiresIn') ?? '').trim();

		if (!ip) {
			return fail(400, { banError: 'IP を入力してください', ip, reason, expiresInRaw });
		}
		if (!isValidIpAddress(ip)) {
			return fail(400, {
				banError: 'Invalid IP address format',
				ip,
				reason,
				expiresInRaw
			});
		}
		if (reason.length > REASON_MAX_LENGTH) {
			return fail(400, {
				banError: `理由は ${REASON_MAX_LENGTH} 文字以内で入力してください`,
				ip,
				reason,
				expiresInRaw
			});
		}

		let expiresAt: string | null = null;
		if (expiresInRaw) {
			const hours = Number(expiresInRaw);
			if (!Number.isFinite(hours) || hours <= 0) {
				return fail(400, {
					banError: '有効期限は正の数値（時間単位）で指定してください',
					ip,
					reason,
					expiresInRaw
				});
			}
			expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000)
				.toISOString()
				.replace(/\.\d{3}Z$/, 'Z');
		}
		const db = getDB(platform);
		await createIpBan(db, { ip, reason, expiresAt, bannedBy: locals.user.id });
		return { success: true };
	},

	// unban: 物理削除。履歴は将来要件のため今は残さない。
	unban: async ({ request, locals, platform }) => {
		requireAdmin(locals);
		const data = await request.formData();
		const idRaw = String(data.get('id') ?? '');
		const id = Number(idRaw);
		if (!Number.isFinite(id) || id <= 0) {
			return fail(400, { error: 'id が不正です' });
		}
		const db = getDB(platform);
		await removeIpBan(db, id);
		return { success: true };
	}
};
