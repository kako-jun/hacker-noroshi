import type { LayoutServerLoad } from './$types';
import { normalizeLocale } from '$lib/i18n';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	// is_admin も client に渡るが、UI 制御のための公開情報と扱う。秘匿情報を入れないこと。
	return {
		user: locals.user,
		locale: normalizeLocale(cookies.get('locale'))
	};
};
