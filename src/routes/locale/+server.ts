import type { RequestHandler } from './$types';
import { normalizeLocale } from '$lib/i18n';
import { safeNext } from '$lib/safe-next';
import { redirect } from '@sveltejs/kit';

export const GET: RequestHandler = ({ url, cookies }) => {
	const locale = normalizeLocale(url.searchParams.get('lang'));
	const next = safeNext(url.searchParams.get('next'));

	cookies.set('locale', locale, {
		path: '/',
		httpOnly: false,
		sameSite: 'lax',
		secure: false,
		maxAge: 365 * 24 * 60 * 60
	});

	throw redirect(302, next);
};
