import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import PocketBase from 'pocketbase';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const STATIC = join(ROOT, 'static');

const PB_URL = 'http://pocketbase-nsrkr77b0kjsd898485bwmif.37.9.62.154.sslip.io';
const PB_EMAIL = 'support@directroute.co.uk';
const PB_PASS = 'Directroute25!';

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);
await pb.admins.authWithPassword(PB_EMAIL, PB_PASS);
console.log('Authenticated');

// Load all JSON parts to get id → name mapping
const parts = [1, 2, 3, 4].map(n =>
  JSON.parse(readFileSync(join(ROOT, `membership-types-part${n}.json`), 'utf8'))
);
const allRecords = parts.flat().filter(r => r.membershipTypeName?.trim());
const idToName = Object.fromEntries(allRecords.map(r => [r.id, r.membershipTypeName.trim()]));

// Find logo files in static
const logoFiles = readdirSync(STATIC).filter(f => f.startsWith('logo-'));
console.log(`Found ${logoFiles.length} logo files\n`);

// Fetch all PB membership types once
const pbTypes = await pb.collection('ma_membership_types').getFullList({ sort: 'name' });
const nameToRecord = Object.fromEntries(pbTypes.map(r => [r.name.trim(), r]));

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.JPG': 'image/jpeg' };

let uploaded = 0;
let skipped = 0;
let errors = 0;

for (const file of logoFiles) {
  const match = file.match(/^logo-(\d+)\./);
  if (!match) continue;
  const jsonId = parseInt(match[1]);
  const name = idToName[jsonId];
  if (!name) { console.log(`  SKIP ${file} — no JSON record for id ${jsonId}`); skipped++; continue; }

  const pbRecord = nameToRecord[name];
  if (!pbRecord) { console.log(`  SKIP ${file} — no PB record found for "${name}"`); skipped++; continue; }

  const filePath = join(STATIC, file);
  const ext = extname(file);
  const mime = MIME[ext] || 'application/octet-stream';
  const fileBuffer = readFileSync(filePath);
  const blob = new Blob([fileBuffer], { type: mime });

  try {
    const formData = new FormData();
    formData.append('logo', blob, file);
    await pb.collection('ma_membership_types').update(pbRecord.id, formData);
    console.log(`  OK  ${file} → "${name}"`);
    uploaded++;
  } catch (e) {
    console.error(`  ERR ${file} → "${name}": ${e.message}`);
    errors++;
  }
}

console.log(`\nDone. Uploaded: ${uploaded}, Skipped: ${skipped}, Errors: ${errors}`);
