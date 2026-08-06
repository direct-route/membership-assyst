import { redirect, error } from '@sveltejs/kit';
import { withRetry, getAdminPb } from '$lib/pocketbase.js';
import { insightQuery } from '$lib/db/mysql.js';
import { POSTMARK_API_KEY, POSTMARK_FROM } from '$env/static/private';
import * as postmark from 'postmark';
import { emailWrapper } from '$lib/emailService.js';

export async function load({ params }) {
	const { token } = params;
	const adminPb = await getAdminPb();

	let applications = [];
	try {
		applications = await withRetry(() =>
			adminPb.collection('ma_applications').getFullList({
				filter: `invite_token="${token}"`,
				expand: 'membership_type_id,licensee_id'
			})
		);
	} catch (e) {
		throw error(404, 'Application not found');
	}

	if (!applications.length) throw error(404, 'This invite link is not valid.');

	const app = applications[0];

	// Check expiry (30 days)
	if (app.invite_sent_at) {
		const sent = new Date(app.invite_sent_at);
		const expiry = new Date(sent.getTime() + 30 * 24 * 60 * 60 * 1000);
		if (new Date() > expiry) throw error(410, 'This invite link has expired.');
	}

	if (app.status === 'accepted' || app.status === 'declined') {
		throw error(410, `This application has already been ${app.status}.`);
	}

	// Fetch linked Insight licensee contact card
	let insightLicensee = null;
	const insightId = app.expand?.licensee_id?.insight_licensee_id;
	if (insightId) {
		try {
			const result = await insightQuery(
				'SELECT id, name, licensee_name, email, area_name FROM licensees WHERE id = ? LIMIT 1',
				[insightId]
			);
			insightLicensee = result.data?.[0] ?? null;
		} catch { /* non-fatal */ }
	}

	return {
		application: app,
		token,
		insightLicensee
	};
}

export const actions = {
	submit: async ({ request, params, getClientAddress }) => {
		const { token } = params;
		const data = await request.formData();
		const adminPb = await getAdminPb();

		const applications = await adminPb.collection('ma_applications').getFullList({
			filter: `invite_token="${token}"`,
			expand: 'licensee_id,membership_type_id'
		});
		if (!applications.length) throw error(404, 'Invalid token');
		const app = applications[0];

		const fields = {};
		for (const [key, val] of data.entries()) fields[key] = val;

		const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
			|| request.headers.get('cf-connecting-ip')
			|| (() => { try { return getClientAddress(); } catch { return null; } })();

		const submission_meta = {
			ip,
			user_agent: request.headers.get('user-agent') || null,
			language: request.headers.get('accept-language')?.split(',')[0] || null,
			referrer: request.headers.get('referer') || null,
			submitted_at: new Date().toISOString()
		};

		await withRetry(() =>
			adminPb.collection('ma_applications').update(app.id, {
				...fields,
				tc_accepted: fields.tc_accepted === 'on',
				privacy_accepted: fields.privacy_accepted === 'on',
				tc_accepted_at: new Date().toISOString(),
				status: 'pending',
				submission_meta
			})
		);

		// Notify admin
		try {
			const companyName = fields.company_name || app.company_name;
			const client = new postmark.ServerClient(POSTMARK_API_KEY);
			await client.sendEmail({
				From: POSTMARK_FROM,
				To: 'support@directroute.co.uk',
				Subject: `New membership application: ${companyName}`,
				HtmlBody: emailWrapper({
					title: 'New Application Submitted',
					subtitle: 'Admin Notification',
					accentColor: '#7c3aed',
					body: `
						<p style="margin:0 0 16px">A new membership application has been submitted and requires your review.</p>
						<table style="width:100%;border-collapse:collapse;margin:0 0 24px">
							<tr style="background:#f8fafc">
								<td style="padding:10px 14px;font-size:13px;color:#64748b;font-weight:600;width:140px;border:1px solid #e2e8f0">Company</td>
								<td style="padding:10px 14px;font-size:14px;color:#1e293b;border:1px solid #e2e8f0"><strong>${companyName}</strong></td>
							</tr>
							<tr>
								<td style="padding:10px 14px;font-size:13px;color:#64748b;font-weight:600;border:1px solid #e2e8f0">Contact</td>
								<td style="padding:10px 14px;font-size:14px;color:#1e293b;border:1px solid #e2e8f0">${fields.contact_name || app.contact_name || '—'}</td>
							</tr>
							<tr style="background:#f8fafc">
								<td style="padding:10px 14px;font-size:13px;color:#64748b;font-weight:600;border:1px solid #e2e8f0">Email</td>
								<td style="padding:10px 14px;font-size:14px;color:#1e293b;border:1px solid #e2e8f0">${app.email || '—'}</td>
							</tr>
						</table>
						<p style="margin:0 0 24px;text-align:center">
							<a href="https://www.membershipassyst.co.uk/applications" style="display:inline-block;background:#7c3aed;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">Review Application →</a>
						</p>
					`
				}),
				TextBody: `New application submitted: ${companyName}. Please log in to review.`
			});
		} catch (e) {
			console.error('Admin notification failed:', e.message);
		}

		// Notify the licensee who sent the invite
		const licenseeEmail = app.expand?.licensee_id?.email;
		const licenseeName = app.expand?.licensee_id?.licensee_name || app.expand?.licensee_id?.name || 'Licensee';
		if (licenseeEmail) {
			try {
				const companyName = fields.company_name || app.company_name;
				const client = new postmark.ServerClient(POSTMARK_API_KEY);
				await client.sendEmail({
					From: POSTMARK_FROM,
					To: licenseeEmail,
					Subject: `Application submitted: ${companyName}`,
					HtmlBody: emailWrapper({
						title: 'Application Submitted',
						subtitle: 'Your invited client has completed their application',
						accentColor: '#1e3a8a',
						body: `
							<p style="margin:0 0 16px">Hi <strong>${licenseeName}</strong>,</p>
							<p style="margin:0 0 16px">Great news — a client you invited has completed and submitted their membership application.</p>
							<table style="width:100%;border-collapse:collapse;margin:0 0 24px">
								<tr style="background:#f8fafc">
									<td style="padding:10px 14px;font-size:13px;color:#64748b;font-weight:600;width:140px;border:1px solid #e2e8f0">Company</td>
									<td style="padding:10px 14px;font-size:14px;color:#1e293b;border:1px solid #e2e8f0"><strong>${companyName}</strong></td>
								</tr>
								<tr>
									<td style="padding:10px 14px;font-size:13px;color:#64748b;font-weight:600;border:1px solid #e2e8f0">Contact</td>
									<td style="padding:10px 14px;font-size:14px;color:#1e293b;border:1px solid #e2e8f0">${fields.contact_name || app.contact_name || '—'}</td>
								</tr>
								<tr style="background:#f8fafc">
									<td style="padding:10px 14px;font-size:13px;color:#64748b;font-weight:600;border:1px solid #e2e8f0">Membership</td>
									<td style="padding:10px 14px;font-size:14px;color:#1e293b;border:1px solid #e2e8f0">${app.expand?.membership_type_id?.name || '—'}</td>
								</tr>
							</table>
							<p style="margin:0 0 16px;color:#64748b;font-size:13px">The application is now under review by Direct Route Collections Limited. You will be notified of the outcome.</p>
						`
					}),
					TextBody: `Hi ${licenseeName},\n\n${companyName} has submitted their membership application. It is now under review.\n\nDirect Route Collections Limited`
				});
			} catch (e) {
				console.error('Licensee notification failed:', e.message);
			}
		}

		throw redirect(303, `/apply/${token}/thankyou`);
	}
};
