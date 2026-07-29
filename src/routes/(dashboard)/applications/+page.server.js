import { withRetry, getAdminPb } from '$lib/pocketbase.js';
import { insightQuery } from '$lib/db/mysql.js';
import { POSTMARK_API_KEY, POSTMARK_FROM } from '$env/static/private';
import { fail } from '@sveltejs/kit';
import * as postmark from 'postmark';
import { emailWrapper } from '$lib/emailService.js';

export async function load({ locals }) {
	const user = locals.user;
	const role = locals.role;
	const adminPb = await getAdminPb();

	let filter = '';
	if (role !== 'admin') filter = `licensee_id="${user.id}"`;

	let applications = [];
	try {
		applications = await withRetry(() =>
			adminPb.collection('ma_applications').getFullList({
				filter: filter || undefined,
				sort: '-created',
				expand: 'licensee_id,membership_type_id'
			})
		);
	} catch (e) {
		console.error('Failed to load applications:', e.message);
	}

	let membershipTypes = [];
	try {
		membershipTypes = await withRetry(() =>
			adminPb.collection('ma_membership_types').getFullList({ sort: 'name' })
		);
	} catch { /* collection may not exist yet */ }

	let debtPartners = [];
	let licensees = [];
	if (role === 'admin') {
		const [dpResult, licResult] = await Promise.all([
			insightQuery('SELECT id, name FROM debt_partners ORDER BY name').catch(() => ({ data: [] })),
			insightQuery('SELECT id, name, licensee_name, area_name FROM licensees ORDER BY licensee_name, name').catch(() => ({ data: [] }))
		]);
		debtPartners = dpResult.data ?? [];
		licensees = (licResult.data ?? []).map(l => ({
			id: String(l.id),
			label: l.licensee_name || l.name,
			area: l.area_name || ''
		}));
	}

	return { applications, membershipTypes, debtPartners, licensees, role };
}

export const actions = {
	approve: async ({ request, locals }) => {
		if (!locals.user || locals.role !== 'admin') return fail(403, { error: 'Unauthorised' });

		const data = await request.formData();
		const id = data.get('id')?.toString();
		if (!id) return fail(400, { error: 'Missing id' });

		const clientLegalEntity = data.get('client_legal_entity')?.toString() || '';
		const debtPartners1Id = data.get('debt_partners1_id')?.toString() || '3';
		const debtPartners2Id = data.get('debt_partners2_id')?.toString() || '3';
		const insightLicenseeId = data.get('insight_licensee_id')?.toString() || null;
		const debtPlanId = data.get('debt_plan_id')?.toString() || null;

		const adminPb = await getAdminPb();

		let app;
		try {
			app = await withRetry(() => adminPb.collection('ma_applications').getOne(id, { expand: 'membership_type_id,licensee_id' }));
		} catch {
			return fail(404, { error: 'Application not found' });
		}

		let insight2Id = null;
		try {
			const result = await insightQuery(
				`INSERT INTO customers (company, name, email_address, telephone, address, company_reg_no, membership_type, terms, client_legal_entity, debt_partners_id, debt_partners2_id, licensee_id, debt_plan_id, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
				[
					app.company_name || '',
					app.contact_name || '',
					app.email || '',
					app.telephone || '',
					app.trading_address || '',
					app.company_reg_no || '',
					app.expand?.membership_type_id?.name || '',
					app.terms_payment || '30 Days Strict',
					clientLegalEntity,
					debtPartners1Id || '3',
					debtPartners2Id || '3',
					insightLicenseeId || null,
					debtPlanId || null
				]
			);
			insight2Id = result?.data?.insertId?.toString() ?? null;
		} catch (e) {
			console.error('Insight-2 insert failed:', e.message);
		}

		await withRetry(() =>
			adminPb.collection('ma_applications').update(id, {
				status: 'accepted',
				dispatch_date: new Date().toISOString().split('T')[0],
				insight2_customer_id: insight2Id
			})
		);

		if (app.email) {
			const approvalSubject = 'Your credit membership application has been approved';
			const approvalHtml = emailWrapper({
				title: 'Application Approved',
				subtitle: 'Membership Application Decision',
				accentColor: '#16a34a',
				body: `
					<p style="margin:0 0 16px">Dear <strong>${app.contact_name || 'Customer'}</strong>,</p>
					<p style="margin:0 0 16px">We are pleased to confirm that your application for credit membership with <strong>Direct Route Collections Limited</strong> has been <strong style="color:#16a34a">approved</strong>.</p>
					<p style="margin:0 0 16px">Your company <strong>${app.company_name}</strong> is now a registered member.</p>
					<p style="margin:0 0 16px">If you have any questions, please do not hesitate to contact us.</p>
					<p style="margin:24px 0 0;color:#64748b;font-size:13px">Kind regards,<br><strong>Direct Route Collections Limited</strong></p>
				`
			});
			let approveStatus = 'sent', approveError = '';
			try {
				const client = new postmark.ServerClient(POSTMARK_API_KEY);
				await client.sendEmail({
					From: POSTMARK_FROM, To: app.email, Subject: approvalSubject,
					HtmlBody: approvalHtml,
					TextBody: `Dear ${app.contact_name},\n\nYour application for credit membership has been approved.\n\nCompany: ${app.company_name}\n\nDirect Route Collections Limited`
				});
			} catch (e) {
				console.error('Approval email failed:', e.message);
				approveStatus = 'failed'; approveError = e.message;
			}
			try {
				await adminPb.collection('ma_email_logs').create({
					application_id: id, user_id: locals.user.id, to_email: app.email, subject: approvalSubject,
					template_code: 'approve', status: approveStatus,
					error_message: approveError, provider: 'postmark'
				});
			} catch (e) { console.error('Email log failed:', e.message); }
		}

		return { success: true };
	},

	decline: async ({ request, locals }) => {
		if (!locals.user || locals.role !== 'admin') return fail(403, { error: 'Unauthorised' });

		const data = await request.formData();
		const id = data.get('id')?.toString();
		const reason = data.get('reason')?.toString() || '';
		if (!id) return fail(400, { error: 'Missing id' });

		const adminPb = await getAdminPb();

		let app;
		try {
			app = await withRetry(() => adminPb.collection('ma_applications').getOne(id));
		} catch {
			return fail(404, { error: 'Not found' });
		}

		await withRetry(() =>
			adminPb.collection('ma_applications').update(id, { status: 'declined', admin_notes: reason })
		);

		if (app.email) {
			const declineSubject = 'Update regarding your credit membership application';
			const declineHtml = emailWrapper({
				title: 'Application Update',
				subtitle: 'Membership Application Decision',
				accentColor: '#dc2626',
				body: `
					<p style="margin:0 0 16px">Dear <strong>${app.contact_name || 'Customer'}</strong>,</p>
					<p style="margin:0 0 16px">Thank you for your application for credit membership with Direct Route Collections Limited.</p>
					<p style="margin:0 0 16px">After careful consideration, we are unable to approve your application at this time.</p>
					${reason ? `<div style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;border-radius:0 6px 6px 0;margin:0 0 16px"><strong>Reason:</strong> ${reason}</div>` : ''}
					<p style="margin:0 0 16px">If you have any questions or wish to discuss further, please do not hesitate to contact us.</p>
					<p style="margin:24px 0 0;color:#64748b;font-size:13px">Kind regards,<br><strong>Direct Route Collections Limited</strong></p>
				`
			});
			let declineStatus = 'sent', declineError = '';
			try {
				const client = new postmark.ServerClient(POSTMARK_API_KEY);
				await client.sendEmail({
					From: POSTMARK_FROM, To: app.email, Subject: declineSubject,
					HtmlBody: declineHtml,
					TextBody: `Dear ${app.contact_name},\n\nWe are unable to approve your application at this time.\n\nDirect Route Collections Limited`
				});
			} catch (e) {
				console.error('Decline email failed:', e.message);
				declineStatus = 'failed'; declineError = e.message;
			}
			try {
				await adminPb.collection('ma_email_logs').create({
					application_id: id, user_id: locals.user.id, to_email: app.email, subject: declineSubject,
					template_code: 'decline', status: declineStatus,
					error_message: declineError, provider: 'postmark'
				});
			} catch (e) { console.error('Email log failed:', e.message); }
		}

		return { success: true };
	},

	delete: async ({ request, locals }) => {
		if (!locals.user) return fail(403, { error: 'Unauthorised' });

		const data = await request.formData();
		const id = data.get('id')?.toString();
		if (!id) return fail(400, { error: 'Missing id' });

		const adminPb = await getAdminPb();

		try {
			await withRetry(() =>
				adminPb.collection('ma_applications').update(id, { status: 'deleted' })
			);
		} catch {
			return fail(404, { error: 'Application not found' });
		}

		return { success: true };
	}
};
