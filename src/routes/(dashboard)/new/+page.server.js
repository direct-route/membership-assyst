import { getAdminPb, withRetry } from '$lib/pocketbase.js';

export async function load() {
	const adminPb = await getAdminPb();
	let membershipTypes = [];
	try {
		membershipTypes = await withRetry(() =>
			adminPb.collection('ma_membership_types').getFullList({ sort: 'name' })
		);
	} catch { /* collection may not exist yet */ }
	return { membershipTypes };
}
