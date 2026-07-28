import { redirect } from '@sveltejs/kit';

export function GET({ cookies, locals }) {
	cookies.delete('pb_auth', { path: '/' });
	if (locals.pb) {
		locals.pb.authStore.clear();
	}
	locals.user = null;
	locals.role = null;
	throw redirect(303, '/signin');
}
