import { withRetry, getAdminPb } from '$lib/pocketbase.js';
import { insightQuery } from '$lib/db/mysql.js';
import { redirect, fail } from '@sveltejs/kit';

export async function load({ locals }) {
	if (locals.role !== 'admin') throw redirect(303, '/applications');
	const adminPb = await getAdminPb();

	let licensees = [];
	let applications = [];

	let insightLicensees = [];
	try {
		[licensees, applications] = await Promise.all([
			withRetry(() => adminPb.collection('users').getFullList({ filter: 'role="licensee"', sort: 'name' })),
			withRetry(() => adminPb.collection('ma_applications').getFullList({ fields: 'licensee_id,status,tc_accepted_at,created' }))
		]);
		const result = await insightQuery('SELECT id, name, licensee_name, email, area_name FROM licensees WHERE active = 1 ORDER BY licensee_name, name');
		insightLicensees = result.data ?? [];
	} catch (e) { console.error('List licensees error:', e?.message); }

	// Compute per-licensee stats
	const statsMap = {};
	for (const a of applications) {
		const id = a.licensee_id;
		if (!id) continue;
		if (!statsMap[id]) statsMap[id] = { total: 0, accepted: 0, pending: 0, declined: 0, returned: 0, lastActivity: null };
		const s = statsMap[id];
		s.total++;
		if (a.status === 'accepted') s.accepted++;
		if (a.status === 'pending') s.pending++;
		if (a.status === 'declined') s.declined++;
		if (a.tc_accepted_at) s.returned++;
		if (!s.lastActivity || a.created > s.lastActivity) s.lastActivity = a.created;
	}

	return { licensees, statsMap, insightLicensees };
}

export const actions = {
	linkInsight: async ({ request, locals }) => {
		if (locals.role !== 'admin') return fail(403, { error: 'Unauthorised' });
		const data = await request.formData();
		const userId = data.get('user_id')?.toString();
		const insightId = data.get('insight_licensee_id')?.toString() || null;
		if (!userId) return fail(400, { error: 'Missing user_id' });
		try {
			const adminPb = await getAdminPb();
			await adminPb.collection('users').update(userId, { insight_licensee_id: insightId });
		} catch (e) {
			return fail(400, { error: e?.message ?? 'Update failed' });
		}
	},

	create: async ({ request, locals }) => {
		const data = await request.formData();
		const name = data.get('name')?.toString().trim();
		const email = data.get('email')?.toString().trim();
		const password = data.get('password')?.toString();
		const licensee_name = data.get('licensee_name')?.toString().trim();

		if (!name || !email || !password) return fail(400, { error: 'Name, email and password required' });

		try {
			const adminPb = await getAdminPb();
			await adminPb.collection('users').create({
				name,
				email,
				password,
				passwordConfirm: password,
				role: 'licensee',
				licensee_name,
				active: true
			});
		} catch (e) {
			console.error('Create licensee error:', JSON.stringify(e, Object.getOwnPropertyNames(e)));
			return fail(400, { error: JSON.stringify(e?.response ?? e?.data ?? e?.message ?? e) });
		}
	}
};
