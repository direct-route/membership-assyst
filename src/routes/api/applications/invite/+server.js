import { json } from '@sveltejs/kit';
import { withRetry, getAdminPb } from '$lib/pocketbase.js';
import { POSTMARK_API_KEY, POSTMARK_FROM, APP_URL } from '$env/static/private';
import * as postmark from 'postmark';
import { emailWrapper } from '$lib/emailService.js';

export async function POST({ request, locals }) {
	const user = locals.user;
	if (!user) return json({ error: 'Unauthorised' }, { status: 401 });

	const body = await request.json();
	const {
		contact_name, email, telephone, company_type, membership_type_id, terms_payment,
		company_name, company_reg_no, trading_address, registered_address,
		email_subject, email_body
	} = body;

	if (!email || !contact_name) return json({ error: 'Missing required fields' }, { status: 400 });

	const token = crypto.randomUUID();
	const adminPb = await getAdminPb();

	let app;
	try {
		app = await withRetry(() =>
			adminPb.collection('ma_applications').create({
				licensee_id: user.id,
				status: 'pending',
				contact_name,
				email,
				telephone: telephone || '',
				company_type,
				membership_type_id,
				terms_payment: terms_payment || '30 Days Strict',
				company_name: company_name || '',
				company_reg_no: company_reg_no || '',
				trading_address: trading_address || '',
				registered_address: registered_address || '',
				invite_token: token,
				invite_sent_at: new Date().toISOString()
			})
		);
	} catch (e) {
		return json({ error: e.message }, { status: 500 });
	}

	const applyUrl = `${APP_URL}/apply/${token}`;
	const licenseeName = user.licensee_name || user.name || user.email;

	const resolvedBody = (email_body || `<p>Dear {{contact_name}},</p><p>You have been invited to apply for membership. Please click the button below to begin:</p><p style="text-align:center;margin:24px 0"><a href="{{apply_url}}" style="display:inline-block;background:#1e3a8a;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">Begin Application →</a></p><p style="color:#64748b;font-size:13px">If the button doesn't work, copy and paste this link:<br><a href="{{apply_url}}" style="color:#1e3a8a;word-break:break-all">{{apply_url}}</a></p>`)
		.replace(/href="\/terms\.pdf"/g, 'href="https://www.membershipassyst.co.uk/terms.pdf"')
		.replace(/href="https:\/\/www\.aadrc\.co\.uk\/terms\.pdf"/g, 'href="https://www.membershipassyst.co.uk/terms.pdf"')
		.replace(/\{\{apply_url\}\}/g, applyUrl)
		.replace(/\{\{contact_name\}\}/g, contact_name)
		.replace(/\{\{licensee_name\}\}/g, licenseeName)
		.replace(/\{\{company_name\}\}/g, company_name || '');

	const finalHtml = emailWrapper({
		title: 'Membership Invitation',
		subtitle: 'You have been invited to apply for membership',
		accentColor: '#1e3a8a',
		body: resolvedBody
	});

	const subject = (email_subject || "Membership Invitation - Direct Route - {{licensee_name}}")
		.replace(/\{\{licensee_name\}\}/g, licenseeName)
		.replace(/\{\{contact_name\}\}/g, contact_name);

	let emailStatus = 'sent';
	let emailError = '';

	try {
		const client = new postmark.ServerClient(POSTMARK_API_KEY);
		await client.sendEmail({
			From: POSTMARK_FROM,
			To: email,
			Subject: subject,
			HtmlBody: finalHtml,
			TextBody: `Dear ${contact_name},\n\nPlease visit the following link to complete your application:\n${applyUrl}\n\nThis link expires in 30 days.`
		});
	} catch (e) {
		console.error('Email send failed:', e.message);
		emailStatus = 'failed';
		emailError = e.message;
	}

	try {
		await adminPb.collection('ma_email_logs').create({
			application_id: app.id,
			user_id: user.id,
			to_email: email,
			subject,
			template_code: 'invite',
			status: emailStatus,
			error_message: emailError,
			provider: 'postmark'
		});
	} catch (e) {
		console.error('Email log failed:', e.message);
	}

	return json({ success: true, id: app.id, token });
}
