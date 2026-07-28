import { json } from '@sveltejs/kit';
import { CREDITSAFE_EMAIL, CREDITSAFE_PASSWORD, CREDITSAFE_API_URL } from '$env/static/private';

async function getToken() {
	const res = await fetch(`${CREDITSAFE_API_URL}/v1/authenticate`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username: CREDITSAFE_EMAIL, password: CREDITSAFE_PASSWORD })
	});
	const data = await res.json();
	return data.token;
}

export async function POST({ request }) {
	const { companyName, country = 'GB' } = await request.json();
	if (!companyName?.trim()) return json({ companies: [] });

	try {
		const token = await getToken();
		const params = new URLSearchParams({ countries: country, name: companyName, pageSize: '20' });
		const res = await fetch(`${CREDITSAFE_API_URL}/v1/companies?${params}`, {
			headers: { Authorization: `Bearer ${token}` }
		});
		const data = await res.json();

		const companies = (data.companies ?? []).map(c => ({
			id: c.id,
			name: c.name,
			regNo: c.regNo,
			safeNo: c.safeNo,
			type: c.type,
			status: c.status,
			address: [c.address?.street, c.address?.city, c.address?.postCode].filter(Boolean).join(', ')
		}));

		return json({ companies });
	} catch (e) {
		return json({ companies: [], error: e.message }, { status: 500 });
	}
}
