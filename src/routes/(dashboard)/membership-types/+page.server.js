import { withRetry } from '$lib/pocketbase.js';
import { redirect } from '@sveltejs/kit';

export async function load({ locals }) {
	if (locals.role !== 'admin') throw redirect(303, '/applications');
	let types = [];
	try {
		types = await withRetry(() =>
			locals.pb.collection('ma_membership_types').getFullList({ sort: 'name' })
		);
	} catch { /* collection may not exist yet */ }
	return { types };
}

export const actions = {
	create: async ({ request, locals }) => {
		const data = await request.formData();
		const name = data.get('name')?.toString().trim();
		if (!name) return { error: 'Name required' };
		await locals.pb.collection('ma_membership_types').create({ name, active: true });
	},
	delete: async ({ request, locals }) => {
		const data = await request.formData();
		const id = data.get('id')?.toString();
		if (id) await locals.pb.collection('ma_membership_types').delete(id);
	},
	toggle: async ({ request, locals }) => {
		const data = await request.formData();
		const id = data.get('id')?.toString();
		const active = data.get('active') === 'true';
		if (id) await locals.pb.collection('ma_membership_types').update(id, { active: !active });
	}
};
