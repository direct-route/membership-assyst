import { POSTMARK_API_KEY, POSTMARK_FROM } from '$env/static/private';
import * as postmark from 'postmark';

export function emailWrapper({ title, subtitle, accentColor = '#1e3a8a', body, footerName = 'Direct Route Collections Limited' }) {
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

  <!-- Header -->
  <tr>
    <td style="background:#0f1a3d;padding:28px 32px;border-radius:12px 12px 0 0">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <span style="color:white;font-size:22px;font-weight:800;letter-spacing:-0.5px">MEMBERSHIP</span>
            <span style="background:#c0392b;color:white;font-size:22px;font-weight:800;padding:2px 10px;border-radius:5px;margin-left:6px">ASSYST</span>
          </td>
          <td align="right">
            <span style="color:#94a3b8;font-size:12px">${footerName}</span>
          </td>
        </tr>
      </table>
      ${subtitle ? `<p style="color:#94a3b8;font-size:13px;margin:10px 0 0">${subtitle}</p>` : ''}
    </td>
  </tr>

  <!-- Accent bar -->
  <tr><td style="background:${accentColor};height:4px"></td></tr>

  <!-- Body -->
  <tr>
    <td style="background:white;padding:36px 32px;border:1px solid #e2e8f0;border-top:none">
      <div style="color:#1e293b;font-size:15px;line-height:1.7">
        ${body}
      </div>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:#f8fafc;padding:20px 32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#94a3b8;font-size:12px">&copy; ${new Date().getFullYear()} ${footerName}. All rights reserved.</td>
          <td align="right" style="color:#94a3b8;font-size:12px">This is an automated message. Please do not reply.</td>
        </tr>
      </table>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

export async function sendEmail({ to, subject, html, text }) {
	const client = new postmark.ServerClient(POSTMARK_API_KEY);
	return client.sendEmail({
		From: POSTMARK_FROM,
		To: to,
		Subject: subject,
		HtmlBody: html,
		TextBody: text || ''
	});
}
