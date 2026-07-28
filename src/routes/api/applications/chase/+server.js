import { json } from '@sveltejs/kit';
import { withRetry, getAdminPb } from '$lib/pocketbase.js';
import { POSTMARK_API_KEY, POSTMARK_FROM, APP_URL } from '$env/static/private';
import * as postmark from 'postmark';
import { emailWrapper } from '$lib/emailService.js';

export async function POST({ request, locals }) {
	if (!locals.user) return json({ error: 'Unauthorised' }, { status: 401 });

	const { id } = await request.json();
	if (!id) return json({ error: 'Missing id' }, { status: 400 });

	const adminPb = await getAdminPb();
	let app;
	try {
		app = await withRetry(() => adminPb.collection('ma_applications').getOne(id, { expand: 'membership_type_id' }));
	} catch {
		return json({ error: 'Application not found' }, { status: 404 });
	}

	if (!app.email) return json({ error: 'No email on record' }, { status: 400 });

	const applyUrl = `${APP_URL}/apply/${app.invite_token}`;
	const subject = `Reminder: Please complete your membership application`;
	const html = emailWrapper({
		title: 'Complete Your Application',
		subtitle: 'Membership Application Reminder',
		accentColor: '#f59e0b',
		body: `
			<p style="margin:0 0 16px">Dear <strong>${app.contact_name || 'Customer'}</strong>,</p>
			<p style="margin:0 0 16px">We noticed that your membership application for <strong>${app.company_name || 'your company'}</strong> has not yet been completed.</p>
			<p style="margin:0 0 24px">Please click the button below to continue where you left off:</p>
			<p style="margin:0 0 24px;text-align:center">
				<a href="${applyUrl}" style="display:inline-block;background:#1e3a8a;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.2px">Complete Application →</a>
			</p>
			<p style="margin:0 0 8px;color:#64748b;font-size:13px">If the button doesn't work, copy and paste this link:</p>
			<p style="margin:0 0 24px"><a href="${applyUrl}" style="color:#1e3a8a;font-size:13px;word-break:break-all">${applyUrl}</a></p>
			<p style="margin:24px 0 0;color:#64748b;font-size:13px">Kind regards,<br><strong>Direct Route Collections Limited</strong></p>
		`
	});

	let status = 'sent', errorMsg = '';
	try {
		const client = new postmark.ServerClient(POSTMARK_API_KEY);
		await client.sendEmail({
			From: POSTMARK_FROM,
			To: app.email,
			Subject: subject,
			HtmlBody: html,
			TextBody: `Dear ${app.contact_name},\n\nPlease complete your membership application:\n${applyUrl}\n\nDirect Route Collections Limited`
		});
	} catch (e) {
		console.error('Chase email failed:', e.message);
		status = 'failed'; errorMsg = e.message;
	}

	try {
		await adminPb.collection('ma_email_logs').create({
			application_id: id,
			user_id: locals.user.id,
			to_email: app.email,
			subject,
			template_code: 'chase',
			status,
			error_message: errorMsg,
			provider: 'postmark'
		});
	} catch (e) { console.error('Email log failed:', e.message); }

	return json({ success: true });
}
