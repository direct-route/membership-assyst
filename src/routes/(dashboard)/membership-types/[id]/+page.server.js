import { getAdminPb, withRetry } from '$lib/pocketbase.js';
import { insightQuery } from '$lib/db/mysql.js';
import { redirect, fail, error } from '@sveltejs/kit';

export async function load({ locals, params }) {
	if (locals.role !== 'admin') throw redirect(303, '/applications');
	const adminPb = await getAdminPb();

	let type;
	try {
		type = await withRetry(() => adminPb.collection('ma_membership_types').getOne(params.id));
	} catch {
		throw error(404, 'Membership type not found');
	}

	let debtPartners = [];
	try {
		const result = await insightQuery('SELECT id, name FROM debt_partners ORDER BY name');
		debtPartners = result.data ?? [];
	} catch { /* non-fatal */ }

	return { type, debtPartners };
}

export const actions = {
	save: async ({ request, locals, params }) => {
		if (locals.role !== 'admin') return fail(403, { error: 'Unauthorised' });
		const data = await request.formData();
		const adminPb = await getAdminPb();
		try {
			await withRetry(() => adminPb.collection('ma_membership_types').update(params.id, {
				name: data.get('name')?.toString().trim(),
				description: data.get('description')?.toString() || '',
				invite_email_subject: data.get('invite_email_subject')?.toString() || '',
				invite_email_body: data.get('invite_email_body')?.toString() || '',
				acceptance_email_subject: data.get('acceptance_email_subject')?.toString() || '',
				acceptance_email_body: data.get('acceptance_email_body')?.toString() || '',
				active: data.get('active') === 'on',
				insight_debt_partners_id: data.get('insight_debt_partners_id')?.toString() || '',
				client_legal_entity: data.get('client_legal_entity')?.toString() || ''
			}));
		} catch (e) {
			return fail(400, { error: e.message });
		}
		return { success: true };
	}
};
