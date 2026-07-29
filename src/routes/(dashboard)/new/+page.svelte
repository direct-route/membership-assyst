<script>
	import { onMount, onDestroy } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import Link from '@tiptap/extension-link';
	import { untrack } from 'svelte';

	let { data } = $props();
	let { membershipTypes } = $derived.by(() => data);

	// ── Company search ──────────────────────────────────────────────
	let companySearch = $state('');
	let searchResults = $state([]);
	let searching = $state(false);
	let selectedCompany = $state(null);

	async function searchCompanies() {
		if (!companySearch.trim()) return;
		searching = true;
		searchResults = [];
		try {
			const res = await fetch('/api/creditsafe/search', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ companyName: companySearch })
			});
			const json = await res.json();
			searchResults = json.companies ?? [];
		} catch { searchResults = []; }
		searching = false;
	}

	const CREDITSAFE_TYPE_MAP = {
		'Ltd': 'limited',
		'PLC': 'plc',
		'LLP': 'llp',
		'NonLtd': 'sole_trader',
		'Partnership': 'partnership',
	};

	function selectCompany(c) {
		selectedCompany = c;
		form.company_name = c.name;
		form.company_reg_no = c.regNo ?? '';
		form.trading_address = c.address ?? '';
		if (c.type && CREDITSAFE_TYPE_MAP[c.type]) {
			form.company_type = CREDITSAFE_TYPE_MAP[c.type];
		}
		searchResults = [];
		companySearch = c.name;
	}

	// ── Form ────────────────────────────────────────────────────────
	const COMPANY_TYPES = [
		{ value: 'limited', label: 'Limited Company' },
		{ value: 'sole_trader', label: 'Sole Trader' },
		{ value: 'partnership', label: 'Partnership' },
		{ value: 'llp', label: 'Limited Liability Partnership' },
		{ value: 'plc', label: 'Public Limited Company' },
		{ value: 'charity', label: 'Charity' },
		{ value: 'other', label: 'Other' },
	];
	const TERMS = ['30 Days Strict', 'COD', '7 Days', '14 Days', '30 Days', '60 Days', '90 Days'];

	let form = $state({
		contact_name: '',
		email: '',
		telephone: '',
		company_type: 'limited',
		membership_type_id: '',
		terms_payment: '30 Days Strict',
		company_name: '',
		company_reg_no: '',
		trading_address: '',
		email_subject: 'Membership Invitation - Direct Route - {{licensee_name}}'
	});

	// ── Selected membership type ────────────────────────────────────
	let selectedType = $derived(
		membershipTypes.find(mt => mt.id === form.membership_type_id) ?? null
	);

	// When membership type changes, update subject + editor content
	$effect(() => {
		const mt = selectedType;
		if (!mt) return;
		untrack(() => {
			if (mt.invite_email_subject) form.email_subject = mt.invite_email_subject;
			if (mt.invite_email_body) {
				editorHtml = mt.invite_email_body;
				if (editor) editor.commands.setContent(mt.invite_email_body);
			}
		});
	});

	// ── Tiptap editor ───────────────────────────────────────────────
	let editorEl = $state(null);
	let editor = $state(null);

	const DEFAULT_EMAIL_HTML = `<p>Dear {{contact_name}},</p><p>You have been invited to apply for membership with Direct Route Collections Limited. Please click the link below to begin your application:</p><p><a href="{{apply_url}}">Begin Application</a></p><p>Kindly note that all debt instructions submitted are subject to our <a href="/terms.pdf">Terms &amp; Conditions</a>.</p><p>We very much look forward to hearing from you.</p>`;

	$effect(() => {
		const el = editorEl;
		if (!el) return;
		// Pick up subject from type when editor first mounts (if not already overridden)
		untrack(() => {
			const mt = selectedType;
			if (mt?.invite_email_subject && form.email_subject === 'Membership Invitation - Direct Route - {{licensee_name}}') {
				form.email_subject = mt.invite_email_subject;
			}
		});
		const savedContent = untrack(() => {
			if (editor) return editor.getHTML();
			const mt = selectedType;
			return (mt?.invite_email_body) || DEFAULT_EMAIL_HTML;
		});
		untrack(() => editor?.destroy());
		const e = new Editor({
			element: el,
			extensions: [
				StarterKit.configure({ link: false }),
				Link.configure({ openOnClick: false })
			],
			content: savedContent,
			editorProps: {
				attributes: {
					class: 'tiptap-editor min-h-64 p-4 focus:outline-none text-slate-700 text-sm leading-relaxed'
				}
			},
			onUpdate({ editor: ed }) {
				editorHtml = ed.getHTML();
			},
			onCreate({ editor: ed }) {
				editorHtml = ed.getHTML();
			}
		});
		untrack(() => { editor = e; });
		return () => { e.destroy(); untrack(() => { editor = null; }); };
	});

	onDestroy(() => editor?.destroy());

	// ── Email view toggle ───────────────────────────────────────────
	let emailView = $state('edit'); // 'edit' | 'preview'

	let editorHtml = $state(DEFAULT_EMAIL_HTML);

	function substitutePreview(text) {
		const previewCompany = (form.company_type === 'sole_trader' && !form.company_name)
			? (form.contact_name || '<em>{{company_name}}</em>')
			: (form.company_name || '<em>{{company_name}}</em>');
		return (text || '')
			.replace(/\{\{contact_name\}\}/g, form.contact_name || '<em>{{contact_name}}</em>')
			.replace(/\{\{company_name\}\}/g, previewCompany)
			.replace(/\{\{licensee_name\}\}/g, 'Direct Route')
			.replace(/\{\{apply_url\}\}/g, '<a href="#" style="color:#1e3a8a;text-decoration:underline">application link</a>');
	}

	let previewSubject = $derived(substitutePreview(form.email_subject));
	let previewBody = $derived(substitutePreview(editorHtml));

	// ── T&C preview tab ─────────────────────────────────────────────
	let activeTab = $state('details'); // 'details' | 'email' | 'tc'

	// ── Submit ──────────────────────────────────────────────────────
	let loading = $state(false);
	let error = $state('');
	let success = $state(false);

	async function submit() {
		error = '';
		if (!form.contact_name || !form.email) { error = 'Contact name and email are required.'; return; }
		if (!form.membership_type_id) { error = 'Please select a membership type.'; return; }
		loading = true;
		const effectiveCompanyName = (form.company_type === 'sole_trader' && !form.company_name)
			? form.contact_name
			: form.company_name;
		try {
			const res = await fetch('/api/applications/invite', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...form,
					company_name: effectiveCompanyName,
					email_body: editorHtml || editor?.getHTML() || DEFAULT_EMAIL_HTML
				})
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error);
			success = true;
		} catch (e) {
			error = e.message;
		} finally {
			loading = false;
		}
	}

	function reset() {
		success = false;
		form = { contact_name:'', email:'', telephone:'', company_type:'limited', membership_type_id:'', terms_payment:'30 Days Strict', company_name:'', company_reg_no:'', trading_address:'', email_subject:'Membership Invitation - Direct Route - {{licensee_name}}' };
		selectedCompany = null;
		companySearch = '';
		editor?.commands.setContent(DEFAULT_EMAIL_HTML);
		editor = null; // allow $effect to reinit next time email tab opens
		activeTab = 'details';
	}
</script>

<div class="max-w-3xl mx-auto">
	<div class="mb-6">
		<h1 class="nunito-sans-700 text-2xl text-slate-900">Invite New Customer</h1>
		<p class="text-sm text-slate-500 mt-0.5">Search for a company, fill in contact details, customise the email, then send.</p>
	</div>

	{#if success}
		<div class="bg-white rounded-xl border border-emerald-200 shadow-sm p-8 text-center">
			<div class="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
				<svg class="w-7 h-7 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
			</div>
			<h2 class="nunito-sans-700 text-xl text-slate-900 mb-2">Invitation Sent</h2>
			<p class="text-sm text-slate-500 mb-6">An email has been sent to <strong>{form.email}</strong> with a link to complete their application.</p>
			<div class="flex items-center justify-center gap-3">
				<button onclick={reset} class="h-9 px-4 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 text-sm font-semibold transition-colors">
					Send Another
				</button>
				<a href="/applications" class="h-9 px-4 rounded-lg bg-[#1e3a8a] hover:bg-[#1e40af] text-white text-sm font-semibold transition-colors inline-flex items-center">
					View Applications
				</a>
			</div>
		</div>
	{:else}
		<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
			<div class="h-1 bg-gradient-to-r from-blue-800 via-blue-600 to-purple-500"></div>

			<!-- Tabs -->
			<div class="border-b border-slate-200 px-4 flex gap-1">
				{#each [['details','Details'],['email','Email Preview'],['tc','Terms & Conditions']] as [key, label]}
					<button onclick={() => activeTab = key}
						class="px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors {activeTab === key ? 'border-[#1e3a8a] text-[#1e3a8a]' : 'border-transparent text-slate-500 hover:text-slate-800'}">
						{label}
					</button>
				{/each}
			</div>

			<!-- Details tab -->
			{#if activeTab === 'details'}
				<div class="p-6 space-y-5">
					{#if error}
						<div class="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
					{/if}

					<!-- Company Type (first) -->
					<div>
						<label for="company-type-top" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Company Type *</label>
						<select id="company-type-top" bind:value={form.company_type}
							class="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] bg-white">
							{#each COMPANY_TYPES as ct}
								<option value={ct.value}>{ct.label}</option>
							{/each}
						</select>
					</div>

					<!-- Company search -->
					<div>
						<label for="company-search" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Company Search</label>
						<div class="flex gap-2">
							<input id="company-search" bind:value={companySearch} type="text" placeholder="Start typing company name…"
								onkeydown={(e) => e.key === 'Enter' && searchCompanies()}
								class="flex-1 px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a]" />
							<button onclick={searchCompanies} disabled={searching}
								class="h-10 px-4 rounded-lg bg-[#1e3a8a] hover:bg-[#1e40af] text-white text-sm font-semibold transition-colors disabled:opacity-60 shrink-0">
								{searching ? '…' : 'Search'}
							</button>
						</div>

						{#if searchResults.length > 0}
							<div class="mt-2 border border-slate-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
								{#each searchResults as c}
									<button onclick={() => selectCompany(c)}
										class="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-blue-50/60 border-b border-slate-100 last:border-0 transition-colors">
										<div class="min-w-0 flex-1">
											<p class="text-sm font-semibold text-slate-800">{c.name}</p>
											<p class="text-[11px] text-slate-500">{c.regNo ? `Reg: ${c.regNo}` : ''}{c.type ? ` · ${c.type}` : ''}</p>
											{#if c.address}<p class="text-[11px] text-slate-400 truncate">{c.address}</p>{/if}
										</div>
										<span class="text-[11px] font-semibold text-[#1e3a8a] shrink-0 mt-0.5">Select</span>
									</button>
								{/each}
							</div>
						{/if}

						{#if selectedCompany}
							<div class="mt-2 px-4 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-sm">
								<svg class="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
								<span class="font-semibold text-emerald-800">{selectedCompany.name}</span>
								{#if selectedCompany.regNo}<span class="text-emerald-600 text-[11px]">· {selectedCompany.regNo}</span>{/if}
								<button onclick={() => { selectedCompany = null; companySearch = ''; form.company_name = ''; form.company_reg_no = ''; form.trading_address = ''; }}
									class="ml-auto text-emerald-600 hover:text-emerald-800 text-[11px] font-semibold">Clear</button>
							</div>
						{/if}
					</div>

					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label for="contact-name" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Contact Name *</label>
							<input id="contact-name" bind:value={form.contact_name} type="text" placeholder="e.g. John Smith"
								class="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a]" />
						</div>
						<div>
							<label for="customer-email" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Customer Email *</label>
							<input id="customer-email" bind:value={form.email} type="email" placeholder="customer@example.com"
								class="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a]" />
						</div>
						<div>
							<label for="telephone" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Telephone</label>
							<input id="telephone" bind:value={form.telephone} type="tel" placeholder="e.g. 01274 223190"
								class="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a]" />
						</div>
						<div>
							<label for="membership-type" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Membership Type *</label>
							<select id="membership-type" bind:value={form.membership_type_id}
								class="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] bg-white">
								<option value="">— Select —</option>
								{#each membershipTypes as mt}
									<option value={mt.id}>{mt.name}</option>
								{/each}
							</select>
						</div>
						<div>
							<label for="payment-terms" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Payment Terms</label>
							<select id="payment-terms" bind:value={form.terms_payment}
								class="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] bg-white">
								{#each TERMS as t}
									<option value={t}>{t}</option>
								{/each}
							</select>
						</div>
					</div>

					<div class="pt-2 flex justify-end">
						<button onclick={() => activeTab = 'email'}
							class="h-10 px-6 rounded-lg bg-[#1e3a8a] hover:bg-[#1e40af] text-white text-sm font-semibold transition-colors">
							Next: Edit Email →
						</button>
					</div>
				</div>

			<!-- Email tab -->
			{:else if activeTab === 'email'}
				<div class="p-6 space-y-4">
					<div class="flex items-center justify-between">
						<p class="text-sm text-slate-500">Customise the invitation email. Use <code class="bg-slate-100 px-1 rounded text-xs">&#123;&#123;contact_name&#125;&#125;</code>, <code class="bg-slate-100 px-1 rounded text-xs">&#123;&#123;company_name&#125;&#125;</code>, <code class="bg-slate-100 px-1 rounded text-xs">&#123;&#123;apply_url&#125;&#125;</code> as placeholders.</p>
						<div class="flex shrink-0 ml-3 rounded-lg border border-slate-200 overflow-hidden text-xs font-semibold">
							<button onclick={() => emailView = 'edit'}
								class="px-3 py-1.5 transition-colors {emailView === 'edit' ? 'bg-[#1e3a8a] text-white' : 'text-slate-500 hover:bg-slate-50'}">Edit</button>
							<button onclick={() => emailView = 'preview'}
								class="px-3 py-1.5 transition-colors {emailView === 'preview' ? 'bg-[#1e3a8a] text-white' : 'text-slate-500 hover:bg-slate-50'}">Preview</button>
						</div>
					</div>

					{#if emailView === 'edit'}
						<div>
							<label for="email-subject" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Email Subject</label>
							<input id="email-subject" bind:value={form.email_subject} type="text"
								class="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a]" />
						</div>

						<div>
							<p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Email Body</p>
							<div class="border border-slate-200 rounded-lg overflow-hidden">
								{#if editor}
									<div class="flex items-center gap-1 px-2 py-1.5 border-b border-slate-200 bg-slate-50 flex-wrap">
										<button type="button"
											onclick={() => editor.chain().focus().toggleBold().run()}
											class="px-2 py-1 text-xs font-bold rounded hover:bg-slate-200 transition-colors {editor.isActive('bold') ? 'bg-slate-200' : ''}">B</button>
										<button type="button"
											onclick={() => editor.chain().focus().toggleItalic().run()}
											class="px-2 py-1 text-xs italic rounded hover:bg-slate-200 transition-colors {editor.isActive('italic') ? 'bg-slate-200' : ''}">I</button>
										<button type="button"
											onclick={() => editor.chain().focus().toggleBulletList().run()}
											class="px-2 py-1 text-xs rounded hover:bg-slate-200 transition-colors {editor.isActive('bulletList') ? 'bg-slate-200' : ''}">• List</button>
										<div class="w-px h-4 bg-slate-300 mx-1"></div>
										<button type="button"
											onclick={() => { const url = prompt('URL:'); if (url) editor.chain().focus().setLink({ href: url }).run(); }}
											class="px-2 py-1 text-xs rounded hover:bg-slate-200 transition-colors {editor.isActive('link') ? 'bg-slate-200' : ''}">Link</button>
										<button type="button"
											onclick={() => editor.chain().focus().unsetLink().run()}
											class="px-2 py-1 text-xs rounded hover:bg-slate-200 transition-colors text-red-500">Unlink</button>
										<div class="w-px h-4 bg-slate-300 mx-1"></div>
										<button type="button"
											onclick={() => editor.commands.setContent(DEFAULT_EMAIL_HTML)}
											class="px-2 py-1 text-xs rounded hover:bg-slate-200 transition-colors text-slate-400">Reset</button>
									</div>
								{/if}
								<div bind:this={editorEl} class="bg-white"></div>
							</div>
						</div>
					{:else}
						<!-- Rendered preview with values substituted -->
						<div class="rounded-lg border border-slate-200 overflow-hidden">
							<div class="px-4 py-3 bg-slate-50 border-b border-slate-200 space-y-1">
								<p class="text-[11px] text-slate-400 uppercase tracking-wide font-semibold">Subject</p>
								<p class="text-sm font-medium text-slate-800">{previewSubject}</p>
							</div>
							<div class="px-5 py-4 bg-white text-sm text-slate-700 leading-relaxed preview-body">
								{@html previewBody}
							</div>
						</div>
					{/if}

					<div class="flex items-center justify-between pt-2">
						<button onclick={() => activeTab = 'details'} class="h-9 px-4 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">← Back</button>
						<button onclick={() => activeTab = 'tc'} class="h-10 px-6 rounded-lg bg-[#1e3a8a] hover:bg-[#1e40af] text-white text-sm font-semibold transition-colors">Next: Terms →</button>
					</div>
				</div>

			<!-- T&C tab -->
			{:else if activeTab === 'tc'}
				<div class="p-6 space-y-4">
					<p class="text-sm text-slate-500">Terms & conditions that will be shown to the customer on their application form.</p>
					<iframe src="/terms.pdf" class="w-full rounded-lg border border-slate-200" style="height: 420px;" title="Terms and Conditions"></iframe>

					{#if error}
						<div class="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
					{/if}

					<div class="flex items-center justify-between pt-2">
						<button onclick={() => activeTab = 'email'} class="h-9 px-4 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">← Back</button>
						<button onclick={submit} disabled={loading}
							class="h-10 px-6 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-60">
							{loading ? 'Sending…' : '✓ Send Invitation Email'}
						</button>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	:global(.tiptap-editor p) { margin-bottom: 0.75rem; }
	:global(.tiptap-editor p:last-child) { margin-bottom: 0; }
	:global(.tiptap-editor a) { color: #1e3a8a; text-decoration: underline; }
	:global(.tiptap-editor strong) { font-weight: 600; }
	:global(.tiptap-editor ul) { list-style: disc; padding-left: 1.25rem; margin-bottom: 0.75rem; }
	:global(.tiptap-editor .ProseMirror-focused) { outline: none; }
	:global(.preview-body p) { margin-bottom: 0.75rem; }
	:global(.preview-body p:last-child) { margin-bottom: 0; }
	:global(.preview-body a) { color: #1e3a8a; text-decoration: underline; }
	:global(.preview-body strong) { font-weight: 600; }
	:global(.preview-body ul) { list-style: disc; padding-left: 1.25rem; margin-bottom: 0.75rem; }
	:global(.preview-body ol) { list-style: decimal; padding-left: 1.25rem; margin-bottom: 0.75rem; }
</style>
