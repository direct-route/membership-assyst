/**
 * Membership Assyst — PocketBase Setup Script
 *
 * Creates all required collections and fields on the PocketBase instance.
 * Run once after pointing PUBLIC_POCKETBASE_URL at a fresh PocketBase server.
 *
 * Usage:
 *   node scripts/setup-pocketbase.js
 *
 * Requires the .env values:
 *   PUBLIC_POCKETBASE_URL   — PocketBase server URL
 *   PB_ADMIN_EMAIL          — superadmin email
 *   PB_ADMIN_PASSWORD       — superadmin password
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Load .env manually (no external deps needed)
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env');
const env = {};
try {
	readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) return;
		const idx = trimmed.indexOf('=');
		if (idx === -1) return;
		env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
	});
} catch {
	console.error('Could not read .env — make sure it exists at the project root.');
	process.exit(1);
}

const PB_URL   = env.PUBLIC_POCKETBASE_URL;
const PB_EMAIL = env.PB_ADMIN_EMAIL;
const PB_PASS  = env.PB_ADMIN_PASSWORD;

if (!PB_URL || !PB_EMAIL || !PB_PASS) {
	console.error('Missing PUBLIC_POCKETBASE_URL, PB_ADMIN_EMAIL or PB_ADMIN_PASSWORD in .env');
	process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let adminToken = null;

async function pbFetch(path, method = 'GET', body) {
	const headers = { 'Content-Type': 'application/json' };
	if (adminToken) headers['Authorization'] = adminToken;
	const res = await fetch(`${PB_URL}/api/${path}`, {
		method,
		headers,
		body: body ? JSON.stringify(body) : undefined
	});
	const text = await res.text();
	try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
	catch { return { ok: res.ok, status: res.status, data: text }; }
}

async function authenticate() {
	console.log(`\nAuthenticating with ${PB_URL} …`);
	// PocketBase 0.23+ uses _superusers
	let r = await pbFetch('collections/_superusers/auth-with-password', 'POST', { identity: PB_EMAIL, password: PB_PASS });
	if (!r.ok) {
		// Fallback: older PB admins endpoint
		r = await pbFetch('admins/auth-with-password', 'POST', { email: PB_EMAIL, password: PB_PASS });
	}
	if (!r.ok || !r.data?.token) {
		console.error('Auth failed:', JSON.stringify(r.data));
		process.exit(1);
	}
	adminToken = r.data.token;
	console.log('  ✓ Authenticated');
}

async function getCollections() {
	const r = await pbFetch('collections?perPage=200');
	return r.data?.items ?? [];
}

async function getCollectionId(name) {
	const cols = await getCollections();
	return cols.find(c => c.name === name)?.id ?? null;
}

async function collectionExists(name, existing) {
	return existing.some(c => c.name === name);
}

async function createCollection(schema, existing) {
	if (await collectionExists(schema.name, existing)) {
		console.log(`  – ${schema.name} already exists, skipping`);
		return;
	}
	const r = await pbFetch('collections', 'POST', schema);
	if (r.ok) {
		console.log(`  ✓ Created collection: ${schema.name}`);
	} else {
		console.error(`  ✗ Failed to create ${schema.name}:`, JSON.stringify(r.data));
	}
}

// PocketBase 0.23+ flat field format helpers
function textField(name, opts = {}) {
	return { name, type: 'text', required: false, hidden: false, presentable: false, autogeneratePattern: '', min: 0, max: 0, pattern: '', ...opts };
}
function emailField(name, opts = {}) {
	return { name, type: 'email', required: false, hidden: false, presentable: false, exceptDomains: null, onlyDomains: null, ...opts };
}
function boolField(name, opts = {}) {
	return { name, type: 'bool', required: false, hidden: false, presentable: false, ...opts };
}
function numberField(name, opts = {}) {
	return { name, type: 'number', required: false, hidden: false, presentable: false, min: null, max: null, onlyInt: false, ...opts };
}
function selectField(name, values, opts = {}) {
	return { name, type: 'select', required: false, hidden: false, presentable: false, maxSelect: 1, values, ...opts };
}
function dateField(name, opts = {}) {
	return { name, type: 'date', required: false, hidden: false, presentable: false, min: '', max: '', ...opts };
}
function relationField(name, collectionId, opts = {}) {
	return { name, type: 'relation', required: false, hidden: false, presentable: false, collectionId, cascadeDelete: false, minSelect: null, maxSelect: 1, ...opts };
}
function jsonField(name, opts = {}) {
	return { name, type: 'json', required: false, hidden: false, presentable: false, maxSize: 0, ...opts };
}

async function addFieldsToUsers(existing) {
	const usersCol = existing.find(c => c.name === 'users');
	if (!usersCol) { console.log('  – users collection not found, skipping'); return; }

	const existingFieldNames = (usersCol.fields ?? []).map(f => f.name);
	const toAdd = [];

	if (!existingFieldNames.includes('role')) {
		toAdd.push(selectField('role', ['admin', 'licensee']));
	}
	if (!existingFieldNames.includes('licensee_name')) {
		toAdd.push(textField('licensee_name'));
	}
	if (!existingFieldNames.includes('active')) {
		toAdd.push(boolField('active'));
	}
	if (!existingFieldNames.includes('insight_licensee_id')) {
		toAdd.push(textField('insight_licensee_id'));
	}

	if (toAdd.length === 0) {
		console.log('  – users fields already exist, skipping');
		return;
	}

	const updatedFields = [...(usersCol.fields ?? []), ...toAdd];
	const payload = { ...usersCol, fields: updatedFields };

	const r = await pbFetch(`collections/${usersCol.id}`, 'PATCH', payload);
	if (r.ok) {
		console.log(`  ✓ Added fields to users: ${toAdd.map(f => f.name).join(', ')}`);
	} else {
		console.error('  ✗ Failed to patch users:', JSON.stringify(r.data));
	}
}

// ---------------------------------------------------------------------------
// Collection definitions (PocketBase 0.23+ flat field format)
// ---------------------------------------------------------------------------

function buildSchemas(usersColId, membershipTypesColId, applicationsColId) {
	return [
		{
			name: 'ma_membership_types',
			type: 'base',
			fields: [
				textField('name', { required: true }),
				numberField('units_cost'),
				boolField('active'),
			],
			listRule:   '',
			viewRule:   '',
			createRule: "@request.auth.id != ''",
			updateRule: "@request.auth.id != ''",
			deleteRule: "@request.auth.id != ''",
			indexes: []
		},
		{
			name: 'ma_applications',
			type: 'base',
			fields: [
				relationField('licensee_id', usersColId),
				relationField('membership_type_id', membershipTypesColId),
				selectField('status', ['pending', 'accepted', 'declined', 'closed', 'deleted'], { required: true }),
				textField('invite_token'),
				dateField('invite_sent_at'),
				dateField('dispatch_date'),
				selectField('company_type', ['limited', 'sole_trader', 'partnership', 'llp', 'plc', 'charity', 'other']),
				textField('creditsafe_id'),
				textField('company_name'),
				textField('trading_name'),
				textField('company_reg_no'),
				textField('vat_reg_no'),
				textField('years_trading'),
				textField('trading_address'),
				textField('registered_address'),
				textField('country'),
				textField('telephone'),
				textField('fax'),
				emailField('email'),
				textField('accounts_contact_name'),
				textField('accounts_address'),
				textField('accounts_phone'),
				textField('accounts_fax'),
				emailField('accounts_email'),
				textField('bank_name'),
				textField('bank_address'),
				textField('bank_how_long'),
				textField('sort_code'),
				textField('account_number'),
				textField('payment_terms'),
				textField('terms_payment'),
				textField('who_recommended'),
				textField('contact_name'),
				textField('contact_position'),
				boolField('tc_accepted'),
				boolField('privacy_accepted'),
				dateField('tc_accepted_at'),
				textField('insight2_customer_id'),
				textField('admin_notes'),
				jsonField('submission_meta'),
			],
			listRule:   "@request.auth.id != ''",
			viewRule:   "@request.auth.id != ''",
			createRule: null,
			updateRule: null,
			deleteRule: null,
			indexes: ['CREATE INDEX idx_ma_applications_token ON ma_applications (invite_token)']
		},
		{
			name: 'ma_rosi_searches',
			type: 'base',
			fields: [
				relationField('application_id', applicationsColId, { required: true, cascadeDelete: true }),
				boolField('rosi_matched'),
				jsonField('rosi_data'),
			],
			listRule:   "@request.auth.id != ''",
			viewRule:   "@request.auth.id != ''",
			createRule: null,
			updateRule: null,
			deleteRule: null,
			indexes: []
		},
		{
			name: 'ma_email_logs',
			type: 'base',
			fields: [
				relationField('application_id', applicationsColId),
				emailField('to_email'),
				textField('subject'),
				textField('template_code'),
				selectField('status', ['sent', 'failed', 'bounced']),
				textField('error_message'),
				textField('provider'),
			],
			listRule:   "@request.auth.id != ''",
			viewRule:   "@request.auth.id != ''",
			createRule: null,
			updateRule: null,
			deleteRule: null,
			indexes: []
		}
	];
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------
const SEED_MEMBERSHIP_TYPES = [
	'Platinum Club Monthly',
	'Platinum Club Annual',
	'Fairway Gold Comp',
	'Fairway Gold 200',
	'Fairway Silver Comp',
	'Fairway Silver 200',
	'Clean Up System',
	'Sameday Courier Network',
	'Fairway Gold Trial',
	'Fairway Gold Trial (DMM)',
	'Bronze 10%',
];

async function seedMembershipTypes() {
	console.log('\nSeeding membership types …');
	// Check existing to avoid duplicates
	const existing = await pbFetch('collections/ma_membership_types/records?perPage=200');
	const existingNames = new Set((existing.data?.items ?? []).map(r => r.name));

	for (const name of SEED_MEMBERSHIP_TYPES) {
		if (existingNames.has(name)) {
			console.log(`  – ${name} (already exists)`);
			continue;
		}
		const r = await pbFetch('collections/ma_membership_types/records', 'POST', { name, active: true });
		if (r.ok) {
			console.log(`  ✓ ${name}`);
		} else {
			console.log(`  ✗ ${name}: ${JSON.stringify(r.data)}`);
		}
	}
}

async function seedAdminUser() {
	console.log('\nChecking for admin user …');
	const r = await pbFetch(`collections/users/records?filter=(email='${PB_EMAIL}')&perPage=1`);
	if (r.ok && r.data?.items?.length > 0) {
		const existing = r.data.items[0];
		if (!existing.role) {
			await pbFetch(`collections/users/records/${existing.id}`, 'PATCH', { role: 'admin', active: true });
			console.log(`  ✓ Patched ${PB_EMAIL} → role: admin`);
		} else {
			console.log(`  – Admin user already exists (role: ${existing.role})`);
		}
		return;
	}
	const create = await pbFetch('collections/users/records', 'POST', {
		email: PB_EMAIL,
		password: PB_PASS,
		passwordConfirm: PB_PASS,
		name: 'Admin',
		role: 'admin',
		active: true,
		emailVisibility: true
	});
	if (create.ok) {
		console.log(`  ✓ Created admin user: ${PB_EMAIL}`);
	} else {
		console.log(`  – Could not create admin user:`, JSON.stringify(create.data));
	}
}

async function addFieldsToApplications(existing) {
	const col = existing.find(c => c.name === 'ma_applications');
	if (!col) { console.log('  – ma_applications not found, skipping'); return; }

	const existingFieldNames = (col.fields ?? []).map(f => f.name);
	const toAdd = [];
	if (!existingFieldNames.includes('submission_meta')) toAdd.push(jsonField('submission_meta'));

	if (toAdd.length === 0) { console.log('  – ma_applications fields already up to date'); return; }

	const r = await pbFetch(`collections/${col.id}`, 'PATCH', { ...col, fields: [...(col.fields ?? []), ...toAdd] });
	if (r.ok) {
		console.log(`  ✓ Added fields to ma_applications: ${toAdd.map(f => f.name).join(', ')}`);
	} else {
		console.error('  ✗ Failed to patch ma_applications:', JSON.stringify(r.data));
	}
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
	console.log('=== Membership Assyst — PocketBase Setup ===');
	console.log(`Target: ${PB_URL}`);

	await authenticate();

	let existing = await getCollections();
	console.log(`\nFound ${existing.length} existing collections`);

	console.log('\nPatching users collection …');
	await addFieldsToUsers(existing);

	// Resolve collection IDs
	const usersColId = '_pb_users_auth_';
	let membershipTypesColId = existing.find(c => c.name === 'ma_membership_types')?.id;

	// Create ma_membership_types first
	if (!membershipTypesColId) {
		const mtSchema = {
			name: 'ma_membership_types',
			type: 'base',
			fields: [
				textField('name', { required: true }),
				numberField('units_cost'),
				boolField('active'),
			],
			listRule:   '',
			viewRule:   '',
			createRule: "@request.auth.id != ''",
			updateRule: "@request.auth.id != ''",
			deleteRule: "@request.auth.id != ''",
			indexes: []
		};
		const r = await pbFetch('collections', 'POST', mtSchema);
		if (r.ok) {
			membershipTypesColId = r.data.id;
			console.log(`\n  ✓ Created collection: ma_membership_types (id: ${membershipTypesColId})`);
		} else {
			console.error('  ✗ Failed to create ma_membership_types:', JSON.stringify(r.data));
			process.exit(1);
		}
	} else {
		console.log(`\n  – ma_membership_types already exists (id: ${membershipTypesColId})`);
	}

	// Refresh existing list
	existing = await getCollections();

	// Create ma_applications
	let applicationsColId = existing.find(c => c.name === 'ma_applications')?.id;
	if (!applicationsColId) {
		const appSchema = buildSchemas(usersColId, membershipTypesColId, null)[1]; // index 1 = ma_applications
		const r = await pbFetch('collections', 'POST', appSchema);
		if (r.ok) {
			applicationsColId = r.data.id;
			console.log(`  ✓ Created collection: ma_applications (id: ${applicationsColId})`);
		} else {
			console.error('  ✗ Failed to create ma_applications:', JSON.stringify(r.data));
		}
	} else {
		console.log(`  – ma_applications already exists (id: ${applicationsColId})`);
	}

	// Refresh existing list
	existing = await getCollections();

	// Create remaining collections with resolved IDs
	const remainingSchemas = buildSchemas(usersColId, membershipTypesColId, applicationsColId).slice(2);
	console.log('\nCreating remaining collections …');
	for (const schema of remainingSchemas) {
		await createCollection(schema, existing);
		existing = await getCollections();
	}

	// Patch ma_applications with new fields
	existing = await getCollections();
	await addFieldsToApplications(existing);

	await seedAdminUser();
	await seedMembershipTypes();

	console.log('\n=== Setup complete ===');
	console.log(`\nNext steps:`);
	console.log(`  1. Open ${PB_URL}/_/ and verify the collections`);
	console.log(`  2. Sign in with ${PB_EMAIL}`);
	console.log(`  3. Start the dev server: npm run dev`);
}

main().catch(err => { console.error(err); process.exit(1); });
