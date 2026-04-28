import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	// is_admin も client に渡るが、UI 制御のための公開情報と扱う。秘匿情報を入れないこと。
	return {
		user: locals.user
	};
};
