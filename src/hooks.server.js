import PocketBase from 'pocketbase';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import { redirect } from '@sveltejs/kit';

const PUBLIC_ROUTES = ['/', '/signin', '/apply', '/signout'];

export async function handle({ event, resolve }) {
	const pb = new PocketBase(PUBLIC_POCKETBASE_URL);
	pb.autoCancellation(false);
	event.locals.pb = pb;

	const cookie = event.request.headers.get('cookie') ?? '';
	pb.authStore.loadFromCookie(cookie);

	let authValid = false;

	try {
		if (pb.authStore.isValid) {
			await pb.collection('users').authRefresh();
			const user = pb.authStore.record;
			event.locals.user = user;
			event.locals.role = user.role ?? 'licensee';
			authValid = true;
		}
	} catch {
		pb.authStore.clear();
		event.locals.user = null;
		event.locals.role = null;
	}

	const path = event.url.pathname;
	const isPublic = PUBLIC_ROUTES.some(r => path === r || path.startsWith('/apply/')) || path.startsWith('/api/creditsafe') || path === '/privacy';

	if (!isPublic && !event.locals.user) {
		throw redirect(303, '/signin');
	}

	const response = await resolve(event);

	if (authValid && pb.authStore.token && path !== '/signout') {
		response.headers.append(
			'set-cookie',
			pb.authStore.exportToCookie({ httpOnly: true, secure: true, sameSite: 'Lax', maxAge: 60 * 60 * 24 * 30 })
		);
	}

	return response;
}
