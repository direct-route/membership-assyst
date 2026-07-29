import PocketBase from 'pocketbase';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import { redirect, fail } from '@sveltejs/kit';

export async function load({ locals }) {
	if (locals.user) throw redirect(303, '/applications');
}

export const actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const email = data.get('email')?.toString().trim();
		const password = data.get('password')?.toString();

		if (!email || !password) return fail(400, { error: 'Email and password required.' });

		const pb = new PocketBase(PUBLIC_POCKETBASE_URL);
		try {
			await pb.collection('users').authWithPassword(email, password);
			const cookieValue = JSON.stringify({ token: pb.authStore.token, record: pb.authStore.record });
			cookies.set('pb_auth', cookieValue, { path: '/', httpOnly: true, secure: true, sameSite: 'Lax', maxAge: 60 * 60 * 24 * 30 });
		} catch {
			return fail(401, { error: 'Invalid email or password.' });
		}

		throw redirect(303, '/applications');
	}
};
