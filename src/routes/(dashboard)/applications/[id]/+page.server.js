import { error } from '@sveltejs/kit';
import { withRetry } from '$lib/pocketbase.js';

export async function load({ params, locals }) {
	const pb = locals.pb;
	const { id } = params;

	let app;
	try {
		app = await withRetry(() =>
			pb.collection('ma_applications').getOne(id, { expand: 'licensee_id,membership_type_id' })
		);
	} catch {
		throw error(404, 'Application not found');
	}

	return { application: app, role: locals.role };
}
