import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import PocketBase from 'pocketbase';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const PB_URL = 'http://pocketbase-nsrkr77b0kjsd898485bwmif.37.9.62.154.sslip.io';
const PB_EMAIL = 'support@directroute.co.uk';
const PB_PASS = 'Directroute25!';
const LOGO_URL = 'https://www.accountassyst.com/membership/images/logo.gif';
const TERMS_LINK = '<a href="/terms.pdf">Terms &amp; Conditions</a>';

function convertPlaceholders(text) {
  return (text || '')
    .replace(/\[\[ApplicantName\]\]/g, '{{contact_name}}')
    .replace(/\[\[ApplicantCompany\]\]/g, '{{company_name}}')
    .replace(/\[\[MembershipFormLink\]\]/g, '{{apply_url}}')
    .replace(/\[\[TermsConditions\]\]/g, TERMS_LINK)
    .replace(/\[\[CreditTerms\]\]/g, '{{credit_terms}}');
}

function textToHtml(text) {
  if (!text || !text.trim()) return '';
  return text
    .trim()
    .split(/\n\n+/)
    .map(para => {
      const lines = para.trim().split('\n').map(l => l.trim()).join('<br>');
      return `<p>${lines}</p>`;
    })
    .join('\n');
}

function processText(text) {
  return textToHtml(convertPlaceholders(text));
}

// Load all 4 JSON files
const parts = [1, 2, 3, 4].map(n =>
  JSON.parse(readFileSync(join(ROOT, `membership-types-part${n}.json`), 'utf8'))
);
const all = parts.flat();

// Filter out blank records
const records = all.filter(r => r.membershipTypeName && r.membershipTypeName.trim());

console.log(`Found ${records.length} valid membership types to import`);

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);
await pb.admins.authWithPassword(PB_EMAIL, PB_PASS);
console.log('Authenticated with PocketBase');

// Download logo once
console.log('Downloading logo...');
const logoRes = await fetch(LOGO_URL);
if (!logoRes.ok) throw new Error(`Failed to download logo: ${logoRes.status}`);
const logoBuffer = await logoRes.arrayBuffer();
const logoBlob = new Blob([logoBuffer], { type: 'image/gif' });
console.log(`Logo downloaded: ${logoBuffer.byteLength} bytes`);

let imported = 0;
let skipped = 0;
let errors = 0;

for (const r of records) {
  const name = r.membershipTypeName.trim();
  const invite_email_body = processText(r.mailText);
  const acceptance_email_body = processText(r.acceptanceText);
  const description = (r.membershipDescription || '').trim();

  // Default subjects
  const invite_email_subject = `Invitation to become a ${name} Member`;
  const acceptance_email_subject = `Your ${name} Membership Has Been Approved`;

  try {
    // Check if already exists
    let existing = null;
    try {
      const found = await pb.collection('ma_membership_types').getList(1, 1, {
        filter: `name = "${name.replace(/"/g, '\\"')}"`
      });
      if (found.items.length > 0) existing = found.items[0];
    } catch { /* not found */ }

    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);
    formData.append('invite_email_subject', invite_email_subject);
    formData.append('invite_email_body', invite_email_body);
    formData.append('acceptance_email_subject', acceptance_email_subject);
    formData.append('acceptance_email_body', acceptance_email_body);
    formData.append('active', 'true');
    formData.append('logo', logoBlob, 'logo.gif');

    if (existing) {
      await pb.collection('ma_membership_types').update(existing.id, formData);
      console.log(`  Updated: ${name}`);
    } else {
      await pb.collection('ma_membership_types').create(formData);
      console.log(`  Created: ${name}`);
    }
    imported++;
  } catch (e) {
    console.error(`  ERROR [${name}]: ${e.message}`);
    errors++;
  }
}

console.log(`\nDone. Imported/updated: ${imported}, Errors: ${errors}`);
