import type { PageServerLoad } from './$types';
import { getDB, getActiveBan } from '$lib/server/db';

// 自分の IP に active な ban があるか確認するページ。
// hooks の ban チェックは /ipban を除外しているため、ban の有無に関わらず到達できる。
// ban されていれば情報を表示、無ければ「ban されていません」と表示する。
// 履歴表示は将来要件。現状は active のみ。
export const load: PageServerLoad = async (event) => {
	const ip =
		event.request.headers.get('CF-Connecting-IP') ?? event.getClientAddress();
	let ban = null;
	try {
		const db = getDB(event.platform);
		ban = await getActiveBan(db, ip);
	} catch {
		// DB 未バインド時は ban=null として「banされていません」を表示する。
	}
	return { ip, ban };
};
