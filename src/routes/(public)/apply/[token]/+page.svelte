<script>
	import { enhance } from '$app/forms';
	import { pbFileUrl } from '$lib/pbUtils.js';
	let { data } = $props();
	let app = $derived(data.application);
	let membershipType = $derived(app.expand?.membership_type_id);
	let insightLicensee = $derived(data.insightLicensee);
	let licensee = $derived(app.expand?.licensee_id);

	let step = $state(1);
	let loading = $state(false);

	// Company search modal
	let showSearchModal = $state(false);
	let companySearch = $state('');
	let searchResults = $state([]);
	let searching = $state(false);

	const COMPANY_TYPES = [
		{ value: 'limited', label: 'Limited Company' },
		{ value: 'sole_trader', label: 'Sole Trader' },
		{ value: 'partnership', label: 'Partnership' },
		{ value: 'llp', label: 'Limited Liability Partnership' },
		{ value: 'plc', label: 'Public Limited Company' },
		{ value: 'charity', label: 'Charity' },
		{ value: 'other', label: 'Other' },
	];

	// Form data — pre-populated from application
	let form = $state({
		company_type: app.company_type || 'limited',
		company_name: app.company_name || '',
		trading_name: app.trading_name || '',
		company_reg_no: app.company_reg_no || '',
		vat_reg_no: app.vat_reg_no || '',
		years_trading: app.years_trading || '',
		trading_address: app.trading_address || '',
		registered_address: app.registered_address || '',
		country: app.country || 'uk',
		telephone: app.telephone || '',
		fax: app.fax || '',
		email: app.email || '',
		accounts_contact_name: app.accounts_contact_name || '',
		accounts_address: app.accounts_address || '',
		accounts_phone: app.accounts_phone || '',
		accounts_fax: app.accounts_fax || '',
		accounts_email: app.accounts_email || '',
		bank_name: app.bank_name || '',
		bank_address: app.bank_address || '',
		bank_how_long: app.bank_how_long || '',
		sort_code: app.sort_code || '',
		account_number: app.account_number || '',
		payment_terms: app.terms_payment || '30 Days Strict',
		who_recommended: app.who_recommended || '',
		contact_name: app.contact_name || '',
		contact_position: app.contact_position || '',
		tc_accepted: false,
		privacy_accepted: false,
	});

	async function searchCompanies() {
		if (!companySearch.trim()) return;
		searching = true;
		try {
			const res = await fetch('/api/creditsafe/search', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ companyName: companySearch })
			});
			const data = await res.json();
			searchResults = data.companies ?? [];
		} catch { searchResults = []; }
		searching = false;
	}

	function selectCompany(c) {
		form.company_name = c.name;
		form.company_reg_no = c.regNo ?? '';
		form.registered_address = c.address ?? '';
		showSearchModal = false;
		companySearch = '';
		searchResults = [];
	}

	function copyAddressToAccounts() {
		form.accounts_address = form.trading_address;
		form.accounts_phone = form.telephone;
		form.accounts_email = form.email;
	}

	// Validation — only show errors after user has touched the field
	let touched = $state({});
	function touch(field) { touched[field] = true; }

	const REQUIRED = [
		'company_name','company_reg_no','years_trading',
		'trading_address','registered_address','country','telephone','email',
		'accounts_contact_name','accounts_address','accounts_phone','accounts_email',
		'bank_name','bank_how_long','bank_address','sort_code','account_number','payment_terms'
	];

	function val(field) { return String(form[field] ?? '').trim(); }

	function isInvalid(field) {
		if (!touched[field]) return false;
		if (field === 'email' || field === 'accounts_email') {
			return !val(field) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val(field));
		}
		if (field === 'telephone' || field === 'accounts_phone') {
			return !val(field) || !/^[\d\s\+\-\(\)]{7,}$/.test(val(field));
		}
		if (field === 'sort_code') {
			return !val(field) || !/^\d{2}-?\d{2}-?\d{2}$/.test(val(field));
		}
		if (field === 'account_number') {
			return !val(field) || !/^\d{6,8}$/.test(val(field));
		}
		return REQUIRED.includes(field) && !val(field);
	}

	function errMsg(field) {
		if (!isInvalid(field)) return '';
		if (field === 'email' || field === 'accounts_email') return 'Valid email required';
		if (field === 'telephone' || field === 'accounts_phone') return 'Valid phone required';
		if (field === 'sort_code') return 'Format: 00-00-00';
		if (field === 'account_number') return '6–8 digits required';
		return 'This field is required';
	}

	let step1Valid = $derived(
		REQUIRED.filter(f => ['contact_name','contact_position'].includes(f) === false)
			.every(f => !isInvalid(f) && val(f))
	);

	function touchAll() {
		for (const f of REQUIRED) touched[f] = true;
	}

	function tryStep2() {
		touchAll();
		if (step1Valid) step = 2;
	}

	const STEPS = [
		{ n: 1, label: 'Your Details' },
		{ n: 2, label: 'Terms & Conditions' },
		{ n: 3, label: 'Review & Submit' },
	];

	const inputCls = 'w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a]';
	function fieldCls(field) {
		return inputCls + (isInvalid(field) ? ' border-red-400 bg-red-50/40' : ' border-slate-200');
	}
</script>

<div class="min-h-screen bg-slate-50">
<div class="max-w-3xl mx-auto px-4 py-8">
		<!-- Dual logo header -->
		<div class="flex items-center justify-between mb-6">
			<img src="/logo.gif" alt="Membership Assyst" class="h-14 w-auto object-contain" />
			<div class="text-right">
				<img src="https://www.directroute.co.uk/img/logo.svg" alt="Direct Route" class="h-14 w-auto object-contain ml-auto" />
			<!-- 	<p class="text-[11px] text-slate-400 mt-1">For queries relating to this process please call</p>
				<a href="tel:01274223190" class="text-sm font-bold text-[#1e3a8a] hover:underline">01274 223190</a>
			--></div> 
		</div>

		<!-- Membership type invite banner -->
		{#if membershipType}
			<div class="mb-6 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
				<div class="h-1 bg-linear-to-r from-blue-800 via-blue-600 to-purple-500"></div>
				<div class="px-5 py-4 flex items-center gap-4">
					{#if membershipType.logo}
						<img
							src={pbFileUrl('ma_membership_types', membershipType.id, membershipType.logo)}
							alt={membershipType.name}
							class="w-28 h-28 rounded-lg object-contain border border-slate-100 bg-slate-50 shrink-0"
						/>
					{:else}
						<div class="w-28 h-28 rounded-lg bg-[#0f1a3d] flex items-center justify-center shrink-0">
							<span class="text-white text-[10px] font-bold tracking-wide text-center leading-tight px-1">MEMBERSHIP<br/>ASSYST</span>
						</div>
					{/if}
					<div class="min-w-0 flex-1">
						<p class="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">You've been invited to apply for</p>
						<p class="nunito-sans-700 text-lg text-slate-900 leading-tight">{membershipType.name}</p>
						{#if membershipType.description}
							<p class="text-xs text-slate-500 mt-0.5">{membershipType.description}</p>
						{/if}
					</div>
					<div class="shrink-0 text-right hidden sm:block">
						<div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100">
							<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
							<span class="text-[11px] font-semibold text-[#1e3a8a]">Invite Active</span>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Invited by contact card -->
		{#if insightLicensee}
			<div class="mb-6 bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4 flex items-center gap-4">
				<div class="w-11 h-11 rounded-full bg-[#1e3a8a] flex items-center justify-center shrink-0">
					<span class="text-white text-sm font-bold">{(insightLicensee.name || '?')[0].toUpperCase()}</span>
				</div>
				<div class="min-w-0 flex-1">
					<p class="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">You were invited by</p>
					{#if insightLicensee.licensee_name}
						<p class="text-xs text-slate-500">{insightLicensee.licensee_name}</p>
					{/if}
					{#if insightLicensee.email}
						<a href="mailto:{insightLicensee.email}" class="text-xs text-[#1e3a8a] hover:underline">{insightLicensee.email}</a>
					{/if}
				</div>
				<div class="shrink-0 text-right hidden sm:block border-l border-slate-100 pl-4">
					<p class="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">For queries</p>
					<a href="tel:01274223190" class="text-sm font-bold text-[#1e3a8a] hover:underline">01274 223190</a>
				</div>
			</div>
		{/if}

		<!-- Step indicator -->
		<div class="flex items-center mb-8">
			{#each STEPS as s, i}
				<div class="flex items-center {i < STEPS.length - 1 ? 'flex-1' : ''}">
					<div class="flex items-center gap-2">
						<div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
							{step > s.n ? 'bg-emerald-500 text-white' : step === s.n ? 'bg-[#1e3a8a] text-white' : 'bg-slate-200 text-slate-500'}">
							{step > s.n ? '✓' : s.n}
						</div>
						<span class="text-xs font-semibold hidden sm:block {step === s.n ? 'text-[#1e3a8a]' : 'text-slate-400'}">{s.label}</span>
					</div>
					{#if i < STEPS.length - 1}
						<div class="flex-1 h-px mx-3 {step > s.n ? 'bg-emerald-300' : 'bg-slate-200'}"></div>
					{/if}
				</div>
			{/each}
		</div>

		<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
			<div class="h-1 bg-gradient-to-r from-blue-800 via-blue-600 to-purple-500"></div>

			<!-- Step 1: Details -->
			{#if step === 1}
				<div class="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
					<span class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Step 1 of 3</span>
					<h2 class="nunito-sans-700 text-xl text-slate-900 mt-0.5">Complete Your Application</h2>
					<p class="text-sm text-slate-500 mt-1">Please complete in full. Fields marked * are required.</p>
				</div>
				<div class="p-6 space-y-6">

					<!-- Company Type + Search -->
					<div>
						<div class="flex items-center gap-2 mb-3">
							<span class="w-1 h-4 rounded-full bg-[#1e3a8a]"></span>
							<h3 class="nunito-sans-700 text-sm font-bold text-slate-800">Company Type &amp; Details</h3>
						</div>
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<!-- Company Type dropdown -->
							<div>
								<label for="apply-company-type" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Company Type *</label>
								<select id="apply-company-type" bind:value={form.company_type} class={fieldCls('company_type')}>
									{#each COMPANY_TYPES as ct}
										<option value={ct.value}>{ct.label}</option>
									{/each}
								</select>
							</div>
							<!-- Company Name + search trigger -->
							<div class="md:col-span-2">
								<label for="apply-company-name" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Company Name *</label>
								<div class="flex gap-2">
									<input id="apply-company-name" bind:value={form.company_name} type="text" onblur={() => touch('company_name')} class="{fieldCls('company_name')} flex-1" />
									{#if form.company_type === 'limited' || form.company_type === 'plc' || form.company_type === 'llp'}
										<button type="button" onclick={() => { showSearchModal = true; companySearch = form.company_name; searchCompanies(); }}
											class="shrink-0 h-[38px] px-3 rounded-lg border border-[#1e3a8a] text-[#1e3a8a] hover:bg-[#1e3a8a] hover:text-white text-xs font-semibold transition-colors">
											Search
										</button>
									{/if}
								</div>
								{#if isInvalid('company_name')}<p class="text-[11px] text-red-500 mt-1">{errMsg('company_name')}</p>{/if}
							</div>
							<div>
								<label for="apply-trading-name" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Trading Name (if different)</label>
								<input id="apply-trading-name" bind:value={form.trading_name} type="text" class={fieldCls('trading_name')} />
							</div>
							<div>
								<label for="apply-company-reg-no" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Company Registration No *</label>
								<input id="apply-company-reg-no" bind:value={form.company_reg_no} type="text" onblur={() => touch('company_reg_no')} class={fieldCls('company_reg_no')} />
								{#if isInvalid('company_reg_no')}<p class="text-[11px] text-red-500 mt-1">{errMsg('company_reg_no')}</p>{/if}
							</div>
							<div>
								<label for="apply-vat-reg-no" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">VAT Reg No</label>
								<input id="apply-vat-reg-no" bind:value={form.vat_reg_no} type="text" class={fieldCls('vat_reg_no')} />
							</div>
							<div>
								<label for="apply-years-trading" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Number of Years Trading *</label>
								<input id="apply-years-trading" bind:value={form.years_trading} type="number" min="0" max="200" placeholder="e.g. 10" onblur={() => touch('years_trading')} class={fieldCls('years_trading')} />
								{#if isInvalid('years_trading')}<p class="text-[11px] text-red-500 mt-1">{errMsg('years_trading')}</p>{/if}
							</div>
						</div>
					</div>

					<!-- Addresses -->
					<div>
						<div class="flex items-center gap-2 mb-3">
							<span class="w-1 h-4 rounded-full bg-[#1e3a8a]"></span>
							<h3 class="nunito-sans-700 text-sm font-bold text-slate-800">Addresses</h3>
						</div>
						<div class="space-y-3">
							<div>
								<label for="apply-trading-address" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Trading Address *</label>
								<textarea id="apply-trading-address" bind:value={form.trading_address} rows="2" onblur={() => touch('trading_address')} class="{fieldCls('trading_address')} resize-none"></textarea>
								{#if isInvalid('trading_address')}<p class="text-[11px] text-red-500 mt-1">{errMsg('trading_address')}</p>{/if}
							</div>
							<div>
								<label for="apply-registered-address" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Registered Office Address *</label>
								<textarea id="apply-registered-address" bind:value={form.registered_address} rows="2" onblur={() => touch('registered_address')} class="{fieldCls('registered_address')} resize-none"></textarea>
								{#if isInvalid('registered_address')}<p class="text-[11px] text-red-500 mt-1">{errMsg('registered_address')}</p>{/if}
							</div>
							<div class="grid grid-cols-2 gap-3">
								<div>
									<label for="apply-country" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Country *</label>
									<input id="apply-country" bind:value={form.country} type="text" onblur={() => touch('country')} class={fieldCls('country')} />
									{#if isInvalid('country')}<p class="text-[11px] text-red-500 mt-1">{errMsg('country')}</p>{/if}
								</div>
								<div>
									<label for="apply-telephone" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Telephone No. *</label>
									<input id="apply-telephone" bind:value={form.telephone} type="tel" onblur={() => touch('telephone')} class={fieldCls('telephone')} />
									{#if isInvalid('telephone')}<p class="text-[11px] text-red-500 mt-1">{errMsg('telephone')}</p>{/if}
								</div>
							</div>
							<div class="grid grid-cols-2 gap-3">
								<div>
									<label for="apply-fax" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Fax</label>
									<input id="apply-fax" bind:value={form.fax} type="text" class={fieldCls('fax')} />
								</div>
								<div>
									<label for="apply-email" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Email *</label>
									<input id="apply-email" bind:value={form.email} type="email" onblur={() => touch('email')} class={fieldCls('email')} />
									{#if isInvalid('email')}<p class="text-[11px] text-red-500 mt-1">{errMsg('email')}</p>{/if}
								</div>
							</div>
						</div>
					</div>

					<!-- Accounts Contact -->
					<div>
						<div class="flex items-center justify-between mb-3">
							<div class="flex items-center gap-2">
								<span class="w-1 h-4 rounded-full bg-[#1e3a8a]"></span>
								<h3 class="nunito-sans-700 text-sm font-bold text-slate-800">Accounts Contact</h3>
							</div>
							<button type="button" onclick={copyAddressToAccounts}
								class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#1e3a8a] hover:text-[#1e40af] border border-[#1e3a8a]/30 hover:border-[#1e3a8a] px-2.5 py-1 rounded-lg transition-colors">
								<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
								Copy from trading address
							</button>
						</div>
						<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
							<div class="md:col-span-2">
								<label for="apply-accounts-contact-name" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Accounts Contact Name *</label>
								<input id="apply-accounts-contact-name" bind:value={form.accounts_contact_name} type="text" onblur={() => touch('accounts_contact_name')} class={fieldCls('accounts_contact_name')} />
								{#if isInvalid('accounts_contact_name')}<p class="text-[11px] text-red-500 mt-1">{errMsg('accounts_contact_name')}</p>{/if}
							</div>
							<div class="md:col-span-2">
								<label for="apply-accounts-address" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Accounts Address *</label>
								<textarea id="apply-accounts-address" bind:value={form.accounts_address} rows="2" onblur={() => touch('accounts_address')} class="{fieldCls('accounts_address')} resize-none"></textarea>
								{#if isInvalid('accounts_address')}<p class="text-[11px] text-red-500 mt-1">{errMsg('accounts_address')}</p>{/if}
							</div>
							<div>
								<label for="apply-accounts-phone" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Accounts Phone Number *</label>
								<input id="apply-accounts-phone" bind:value={form.accounts_phone} type="tel" onblur={() => touch('accounts_phone')} class={fieldCls('accounts_phone')} />
								{#if isInvalid('accounts_phone')}<p class="text-[11px] text-red-500 mt-1">{errMsg('accounts_phone')}</p>{/if}
							</div>
							<div>
								<label for="apply-accounts-fax" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Accounts Fax Number</label>
								<input id="apply-accounts-fax" bind:value={form.accounts_fax} type="text" class={fieldCls('accounts_fax')} />
							</div>
							<div class="md:col-span-2">
								<label for="apply-accounts-email" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Accounts Email Address *</label>
								<input id="apply-accounts-email" bind:value={form.accounts_email} type="email" onblur={() => touch('accounts_email')} class={fieldCls('accounts_email')} />
								{#if isInvalid('accounts_email')}<p class="text-[11px] text-red-500 mt-1">{errMsg('accounts_email')}</p>{/if}
							</div>
						</div>
					</div>

					<!-- Banking -->
					<div>
						<div class="flex items-center gap-2 mb-3">
							<span class="w-1 h-4 rounded-full bg-[#1e3a8a]"></span>
							<h3 class="nunito-sans-700 text-sm font-bold text-slate-800">Business Banking</h3>
						</div>
						<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
							<div>
								<label for="apply-bank-name" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Business Bankers *</label>
								<input id="apply-bank-name" bind:value={form.bank_name} type="text" onblur={() => touch('bank_name')} class={fieldCls('bank_name')} />
								{#if isInvalid('bank_name')}<p class="text-[11px] text-red-500 mt-1">{errMsg('bank_name')}</p>{/if}
							</div>
							<div>
								<label for="apply-bank-how-long" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">How Long Banked With *</label>
								<input id="apply-bank-how-long" bind:value={form.bank_how_long} type="text" placeholder="e.g. 5 Years" onblur={() => touch('bank_how_long')} class={fieldCls('bank_how_long')} />
								{#if isInvalid('bank_how_long')}<p class="text-[11px] text-red-500 mt-1">{errMsg('bank_how_long')}</p>{/if}
							</div>
							<div class="md:col-span-2">
								<label for="apply-bank-address" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Bank Address *</label>
								<textarea id="apply-bank-address" bind:value={form.bank_address} rows="2" onblur={() => touch('bank_address')} class="{fieldCls('bank_address')} resize-none"></textarea>
								{#if isInvalid('bank_address')}<p class="text-[11px] text-red-500 mt-1">{errMsg('bank_address')}</p>{/if}
							</div>
							<div>
								<label for="apply-sort-code" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Sort Code *</label>
								<input id="apply-sort-code" bind:value={form.sort_code} type="text" placeholder="00-00-00" onblur={() => touch('sort_code')} class={fieldCls('sort_code')} />
								{#if isInvalid('sort_code')}<p class="text-[11px] text-red-500 mt-1">{errMsg('sort_code')}</p>{/if}
							</div>
							<div>
								<label for="apply-account-number" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Account Number *</label>
								<input id="apply-account-number" bind:value={form.account_number} type="text" onblur={() => touch('account_number')} class={fieldCls('account_number')} />
								{#if isInvalid('account_number')}<p class="text-[11px] text-red-500 mt-1">{errMsg('account_number')}</p>{/if}
							</div>
						</div>
					</div>

					<!-- Payment Terms -->
					<div>
						<div class="flex items-center gap-2 mb-3">
							<span class="w-1 h-4 rounded-full bg-[#1e3a8a]"></span>
							<h3 class="nunito-sans-700 text-sm font-bold text-slate-800">Payment Terms</h3>
						</div>
						<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
							<div>
								<label for="apply-payment-terms" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Your Payment Terms *</label>
								<input id="apply-payment-terms" bind:value={form.payment_terms} type="text" placeholder="e.g. 30 Days Strict" onblur={() => touch('payment_terms')} class={fieldCls('payment_terms')} />
								{#if isInvalid('payment_terms')}<p class="text-[11px] text-red-500 mt-1">{errMsg('payment_terms')}</p>{/if}
							</div>
							<div>
								<label for="apply-who-recommended" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Who Recommended Direct Route To You?</label>
								<input id="apply-who-recommended" bind:value={form.who_recommended} type="text" class={fieldCls('who_recommended')} />
							</div>
						</div>
					</div>

					<div class="flex justify-end pt-2">
						<button onclick={tryStep2}
							class="h-10 px-6 rounded-lg bg-[#1e3a8a] hover:bg-[#1e40af] text-white text-sm font-semibold transition-colors">
							Continue →
						</button>
					</div>
				</div>

			<!-- Step 2: Terms -->
			{:else if step === 2}
				<div class="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
					<span class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Step 2 of 3</span>
					<h2 class="nunito-sans-700 text-xl text-slate-900 mt-0.5">Terms &amp; Conditions</h2>
				</div>
				<div class="p-6 space-y-5">
					<iframe
						src="https://www.membershipassyst.co.uk/terms.pdf"
						title="Terms & Conditions"
						class="w-full rounded-lg border border-slate-200"
						style="height: 420px;"
					></iframe>

					<div class="space-y-3">
						<label class="flex items-start gap-3 cursor-pointer">
							<input type="checkbox" bind:checked={form.tc_accepted} class="mt-1 w-4 h-4 rounded border-slate-300 text-[#1e3a8a]" />
							<span class="text-sm text-slate-700">I have read and accept the above and the Supplier's <a href="/terms.pdf" target="_blank" rel="noopener" class="text-[#1e3a8a] font-semibold underline">Terms &amp; Conditions</a></span>
						</label>
						<label class="flex items-start gap-3 cursor-pointer">
							<input type="checkbox" bind:checked={form.privacy_accepted} class="mt-1 w-4 h-4 rounded border-slate-300 text-[#1e3a8a]" />
							<span class="text-sm text-slate-700">I have read and accept the contents of the <a href="/privacy" target="_blank" rel="noopener" class="text-[#1e3a8a] font-semibold underline">Privacy Statement</a></span>
						</label>
					</div>

					<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
						<div>
							<label for="apply-contact-name" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Contact Name *</label>
							<input id="apply-contact-name" bind:value={form.contact_name} type="text" class={inputCls} />
						</div>
						<div>
							<label for="apply-contact-position" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Contact Position / Title *</label>
							<input id="apply-contact-position" bind:value={form.contact_position} type="text" placeholder="e.g. Director" class={inputCls} />
						</div>
					</div>

					<div class="flex items-center justify-between pt-2">
						<button onclick={() => step = 1} class="h-9 px-4 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 text-sm font-semibold transition-colors">← Back</button>
						<button onclick={() => step = 3} disabled={!form.tc_accepted || !form.privacy_accepted}
							class="h-10 px-6 rounded-lg bg-[#1e3a8a] hover:bg-[#1e40af] text-white text-sm font-semibold transition-colors disabled:opacity-40">
							Review Application →
						</button>
					</div>
				</div>

			<!-- Step 3: Review & Submit -->
			{:else if step === 3}
				<div class="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
					<span class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Step 3 of 3</span>
					<h2 class="nunito-sans-700 text-xl text-slate-900 mt-0.5">Review &amp; Submit</h2>
					<p class="text-sm text-slate-500 mt-1">Please review your application before submitting.</p>
				</div>
				<form method="POST" action="?/submit" use:enhance={() => {
					loading = true;
					return async ({ update }) => { await update(); loading = false; };
				}}>
					{#each Object.entries(form) as [key, val]}
						<input type="hidden" name={key} value={typeof val === 'boolean' ? (val ? 'on' : '') : val} />
					{/each}

					<div class="p-6 space-y-5">
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
							<div>
								<p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">Company Type</p>
								<p class="font-semibold text-slate-800">{form.company_type}</p>
							</div>
							<div>
								<p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">Company</p>
								<p class="font-semibold text-slate-800">{form.company_name}</p>
								{#if form.trading_name}<p class="text-slate-500">t/a {form.trading_name}</p>{/if}
							</div>
							<div>
								<p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">Registration</p>
								<p class="font-semibold text-slate-800">{form.company_reg_no || '—'}</p>
							</div>
							<div>
								<p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">Years Trading</p>
								<p class="text-slate-700">{form.years_trading || '—'}</p>
							</div>
							<div class="md:col-span-2">
								<p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">Trading Address</p>
								<p class="text-slate-700">{form.trading_address || '—'}</p>
							</div>
							<div>
								<p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">Contact</p>
								<p class="font-semibold text-slate-800">{form.contact_name} — {form.contact_position}</p>
								<p class="text-slate-500">{form.email}</p>
							</div>
							<div>
								<p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">Banking</p>
								<p class="text-slate-700">{form.bank_name || '—'}</p>
								<p class="font-mono text-slate-600">{form.sort_code} / {form.account_number}</p>
							</div>
						</div>

						<div class="border-t border-slate-100 pt-4">
							<div class="flex items-center gap-2 text-emerald-700 text-sm font-semibold">
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
								Terms &amp; Conditions accepted
							</div>
						</div>

						<div class="flex items-center justify-between pt-2">
							<button type="button" onclick={() => step = 2} class="h-9 px-4 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 text-sm font-semibold transition-colors">← Back</button>
							<button type="submit" disabled={loading}
								class="h-10 px-6 rounded-lg bg-[#1e3a8a] hover:bg-[#1e40af] text-white text-sm font-semibold transition-colors disabled:opacity-60">
								{loading ? 'Submitting…' : 'Submit Application'}
							</button>
						</div>
					</div>
				</form>
			{/if}
		</div>
	</div>
</div>

<!-- Company Search Modal (Limited Company only) -->
{#if showSearchModal}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
		onclick={(e) => { if (e.target === e.currentTarget) showSearchModal = false; }}>
		<div class="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
			<div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
				<h3 class="nunito-sans-700 text-base text-slate-900">Search Company Register</h3>
				<button onclick={() => showSearchModal = false} class="text-slate-400 hover:text-slate-700">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
				</button>
			</div>
			<div class="p-5 space-y-4">
				<div class="flex gap-2">
					<input bind:value={companySearch} type="text" placeholder="Company name…"
						onkeydown={(e) => e.key === 'Enter' && searchCompanies()}
						class="flex-1 px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a]" />
					<button onclick={searchCompanies} disabled={searching}
						class="h-10 px-4 rounded-lg bg-[#1e3a8a] hover:bg-[#1e40af] text-white text-sm font-semibold transition-colors disabled:opacity-60">
						{searching ? '…' : 'Search'}
					</button>
				</div>

				{#if searchResults.length > 0}
					<div class="border border-slate-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
						{#each searchResults as c}
							<button onclick={() => selectCompany(c)}
								class="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-blue-50/60 transition-colors border-b border-slate-100 last:border-0">
								<div class="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
									<svg class="w-4 h-4 text-[#1e3a8a]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
								</div>
								<div class="min-w-0 flex-1">
									<p class="text-sm font-semibold text-slate-800">{c.name}</p>
									<p class="text-[11px] text-slate-500">{c.regNo ? `Reg: ${c.regNo}` : ''} {c.type ? `· ${c.type}` : ''}</p>
									{#if c.address}<p class="text-[11px] text-slate-400 truncate">{c.address}</p>{/if}
								</div>
								<span class="text-[11px] font-semibold text-[#1e3a8a] shrink-0">Select →</span>
							</button>
						{/each}
					</div>
				{:else if !searching && companySearch}
					<p class="text-sm text-slate-400 text-center py-4">No results. Try a different name.</p>
				{/if}
			</div>
		</div>
	</div>
{/if}
