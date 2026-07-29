<script>
	import { invalidateAll } from '$app/navigation';
	let { data } = $props();
	let app = $derived(data.application);
	let role = $derived(data.role);

	let actionLoading = $state('');
	let declineReason = $state('');
	let showDeclineModal = $state(false);
	let actionResult = $state(null);

	function fmtDate(d) {
		if (!d) return '—';
		return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
	}

	function statusPill(s) {
		const map = {
			pending: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
			accepted: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
			declined: 'bg-red-50 text-red-700 ring-1 ring-red-200',
			closed: 'bg-slate-100 text-slate-600',
			deleted: 'bg-slate-100 text-slate-400'
		};
		return map[s] ?? 'bg-slate-100 text-slate-500';
	}

	async function approve() {
		actionLoading = 'approve';
		actionResult = null;
		try {
			const res = await fetch(`/api/applications/${app.id}/approve`, { method: 'POST' });
			const d = await res.json();
			if (!res.ok) throw new Error(d.error);
			actionResult = { type: 'success', message: 'Application approved. Customer notified.' };
			await invalidateAll();
		} catch (e) {
			actionResult = { type: 'error', message: e.message };
		} finally {
			actionLoading = '';
		}
	}

	async function decline() {
		actionLoading = 'decline';
		actionResult = null;
		try {
			const res = await fetch(`/api/applications/${app.id}/decline`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ reason: declineReason })
			});
			const d = await res.json();
			if (!res.ok) throw new Error(d.error);
			actionResult = { type: 'success', message: 'Application declined. Customer notified.' };
			showDeclineModal = false;
			await invalidateAll();
		} catch (e) {
			actionResult = { type: 'error', message: e.message };
		} finally {
			actionLoading = '';
		}
	}

	function row(label, value) {
		return { label, value: value || '—' };
	}
</script>

<div class="max-w-5xl mx-auto">
	<!-- Breadcrumb -->
	<div class="flex items-center gap-2 text-sm text-slate-500 mb-5">
		<a href="/applications" class="hover:text-[#1e3a8a]">Applications</a>
		<span>/</span>
		<span class="text-slate-700 font-medium">{app.company_name || 'Application'}</span>
	</div>

	<!-- Header card -->
	<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-5">
		<div class="h-1 bg-gradient-to-r from-blue-800 via-blue-600 to-purple-500"></div>
		<div class="px-6 py-5 flex items-start justify-between">
			<div>
				<h1 class="nunito-sans-700 text-2xl text-slate-900">{app.company_name || 'Unnamed Application'}</h1>
				{#if app.trading_name && app.trading_name !== app.company_name}
					<p class="text-sm text-slate-500 mt-0.5">t/a {app.trading_name}</p>
				{/if}
				<div class="flex items-center gap-3 mt-2">
					<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize {statusPill(app.status)}">{app.status}</span>
					{#if app.dispatch_date}
						<span class="text-xs text-slate-400">Dispatched {fmtDate(app.dispatch_date)}</span>
					{/if}
					{#if app.insight2_customer_id}
						<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
							Insight-2 ID: {app.insight2_customer_id}
						</span>
					{/if}
				</div>
			</div>

			{#if role === 'admin' && (app.status === 'pending')}
				<div class="flex items-center gap-2 shrink-0 ml-4">
					<button onclick={() => showDeclineModal = true} disabled={!!actionLoading}
						class="h-9 px-4 rounded-lg border border-red-200 text-red-600 hover:bg-red-600 hover:text-white text-sm font-semibold transition-all disabled:opacity-50">
						Decline
					</button>
					<button onclick={approve} disabled={!!actionLoading}
						class="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
						{actionLoading === 'approve' ? 'Processing…' : 'Approve'}
					</button>
				</div>
			{/if}
		</div>

		{#if actionResult}
			<div class="mx-6 mb-4 px-4 py-2.5 rounded-lg text-sm font-medium {actionResult.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}">
				{actionResult.message}
			</div>
		{/if}
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
		<!-- Main form view -->
		<div class="lg:col-span-2 space-y-4">
			<!-- Company Details -->
			<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
				<div class="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
					<span class="w-1 h-4 rounded-full bg-[#1e3a8a]"></span>
					<h2 class="nunito-sans-700 text-sm font-bold text-slate-800">Company Details</h2>
				</div>
				<div class="p-5">
					<table class="w-full text-sm">
						<tbody>
							{#each [
								row('Company Type', app.company_type?.replace('_', ' ')),
								row('Type of Membership', app.expand?.membership_type_id?.name),
								row('Company Name', app.company_name),
								row('Trading Name', app.trading_name),
								row('Company Registration No', app.company_reg_no),
								row('VAT Reg No', app.vat_reg_no),
								row('Number of Years Trading', app.years_trading),
							] as r}
								<tr class="border-b border-slate-50 last:border-0">
									<td class="py-2 pr-4 text-[11px] font-semibold uppercase tracking-wide text-slate-400 w-48">{r.label}</td>
									<td class="py-2 font-medium text-slate-700">{r.value}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<!-- Addresses & Contact -->
			<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
				<div class="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
					<span class="w-1 h-4 rounded-full bg-[#1e3a8a]"></span>
					<h2 class="nunito-sans-700 text-sm font-bold text-slate-800">Address & Contact</h2>
				</div>
				<div class="p-5">
					<table class="w-full text-sm">
						<tbody>
							{#each [
								row('Trading Address', app.trading_address),
								row('Registered Office Address', app.registered_address),
								row('Country', app.country),
								row('Telephone No.', app.telephone),
								row('Fax', app.fax),
								row('Email', app.email),
							] as r}
								<tr class="border-b border-slate-50 last:border-0">
									<td class="py-2 pr-4 text-[11px] font-semibold uppercase tracking-wide text-slate-400 w-48">{r.label}</td>
									<td class="py-2 font-medium text-slate-700">{r.value}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<!-- Accounts Contact -->
			<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
				<div class="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
					<span class="w-1 h-4 rounded-full bg-[#1e3a8a]"></span>
					<h2 class="nunito-sans-700 text-sm font-bold text-slate-800">Accounts Contact</h2>
				</div>
				<div class="p-5">
					<table class="w-full text-sm">
						<tbody>
							{#each [
								row('Accounts Contact Name', app.accounts_contact_name),
								row('Accounts Address', app.accounts_address),
								row('Accounts Phone Number', app.accounts_phone),
								row('Accounts Fax Number', app.accounts_fax),
								row('Accounts Email Address', app.accounts_email),
							] as r}
								<tr class="border-b border-slate-50 last:border-0">
									<td class="py-2 pr-4 text-[11px] font-semibold uppercase tracking-wide text-slate-400 w-48">{r.label}</td>
									<td class="py-2 font-medium text-slate-700">{r.value}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<!-- Banking -->
			<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
				<div class="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
					<span class="w-1 h-4 rounded-full bg-[#1e3a8a]"></span>
					<h2 class="nunito-sans-700 text-sm font-bold text-slate-800">Business Banking</h2>
				</div>
				<div class="p-5">
					<table class="w-full text-sm">
						<tbody>
							{#each [
								row('Business Bankers', app.bank_name),
								row('Address', app.bank_address),
								row('How Long Banked With', app.bank_how_long),
								row('Sort Code', app.sort_code),
								row('Account Number', app.account_number),
							] as r}
								<tr class="border-b border-slate-50 last:border-0">
									<td class="py-2 pr-4 text-[11px] font-semibold uppercase tracking-wide text-slate-400 w-48">{r.label}</td>
									<td class="py-2 font-mono font-medium text-slate-700">{r.value}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<!-- Terms -->
			<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
				<div class="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
					<span class="w-1 h-4 rounded-full bg-[#1e3a8a]"></span>
					<h2 class="nunito-sans-700 text-sm font-bold text-slate-800">Terms & Declaration</h2>
				</div>
				<div class="p-5">
					<table class="w-full text-sm">
						<tbody>
							{#each [
								row('Your Payment Terms', app.payment_terms),
								row('Who Recommended Direct Route', app.who_recommended),
								row('Terms', app.terms_payment),
							] as r}
								<tr class="border-b border-slate-50 last:border-0">
									<td class="py-2 pr-4 text-[11px] font-semibold uppercase tracking-wide text-slate-400 w-48">{r.label}</td>
									<td class="py-2 font-medium text-slate-700">{r.value}</td>
								</tr>
							{/each}
							<tr class="border-b border-slate-50">
								<td class="py-2 pr-4 text-[11px] font-semibold uppercase tracking-wide text-slate-400 w-48">T&C Accepted</td>
								<td class="py-2">
									{#if app.tc_accepted}
										<span class="inline-flex items-center gap-1 text-emerald-700 font-semibold text-xs">
											<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
											Yes — {fmtDate(app.tc_accepted_at)}
										</span>
									{:else}
										<span class="text-slate-400 text-xs">Not yet accepted</span>
									{/if}
								</td>
							</tr>
							<tr class="last:border-0">
								<td class="py-2 pr-4 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Contact Name</td>
								<td class="py-2 font-medium text-slate-700">{app.contact_name || '—'} — {app.contact_position || '—'}</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</div>

		<!-- Sidebar -->
		<div class="space-y-4">
			<!-- Licensee info -->
			<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
				<div class="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
					<span class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Submitted by</span>
				</div>
				<div class="p-4 text-sm">
					<p class="font-semibold text-slate-800">{app.expand?.licensee_id?.name || '—'}</p>
					<p class="text-slate-500 text-xs mt-0.5">{app.expand?.licensee_id?.email || ''}</p>
					<p class="text-slate-400 text-xs mt-2">{app.expand?.licensee_id?.licensee_name || ''}</p>
				</div>
			</div>

			<!-- Admin notes -->
			{#if role === 'admin'}
				<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
					<div class="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
						<span class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Admin Notes</span>
					</div>
					<div class="p-4">
						{#if app.admin_notes}
							<p class="text-sm text-slate-600">{app.admin_notes}</p>
						{:else}
							<p class="text-xs text-slate-400 italic">No notes</p>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Application meta -->
			<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
				<div class="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
					<span class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Application Info</span>
				</div>
				<div class="p-4 space-y-2 text-xs">
					<div class="flex justify-between">
						<span class="text-slate-400">Created</span>
						<span class="font-medium text-slate-700">{fmtDate(app.created)}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-slate-400">Invite sent</span>
						<span class="font-medium text-slate-700">{fmtDate(app.invite_sent_at)}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-slate-400">Status</span>
						<span class="font-semibold capitalize {app.status === 'accepted' ? 'text-emerald-600' : app.status === 'declined' ? 'text-red-600' : 'text-amber-600'}">{app.status}</span>
					</div>
					{#if app.company_reg_no}
						<div class="flex justify-between">
							<span class="text-slate-400">Reg No</span>
							<span class="font-mono font-medium text-slate-700">{app.company_reg_no}</span>
						</div>
					{/if}
				</div>
			</div>

			<!-- Submission device info -->
			{#if app.submission_meta}
				{@const meta = typeof app.submission_meta === 'string' ? JSON.parse(app.submission_meta) : app.submission_meta}
				<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
					<div class="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
						<svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
						<span class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Submission Device</span>
					</div>
					<div class="p-4 space-y-2.5 text-xs">
						{#if meta.submitted_at}
							<div>
								<p class="text-slate-400 mb-0.5">Submitted</p>
								<p class="font-medium text-slate-700">{new Date(meta.submitted_at).toLocaleString('en-GB')}</p>
							</div>
						{/if}
						{#if meta.ip}
							<div>
								<p class="text-slate-400 mb-0.5">IP Address</p>
								<p class="font-mono font-medium text-slate-700">{meta.ip}</p>
							</div>
						{/if}
						{#if meta.language}
							<div>
								<p class="text-slate-400 mb-0.5">Language</p>
								<p class="font-medium text-slate-700">{meta.language}</p>
							</div>
						{/if}
						{#if meta.user_agent}
							<div>
								<p class="text-slate-400 mb-0.5">User Agent</p>
								<p class="text-slate-600 break-all leading-relaxed">{meta.user_agent}</p>
							</div>
						{/if}
						{#if meta.referrer}
							<div>
								<p class="text-slate-400 mb-0.5">Referrer</p>
								<p class="text-slate-600 break-all">{meta.referrer}</p>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Decline Modal -->
{#if showDeclineModal}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
		<div class="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
			<div class="h-1 bg-red-500"></div>
			<div class="p-6">
				<h3 class="nunito-sans-700 text-lg text-slate-900 mb-1">Decline Application</h3>
				<p class="text-sm text-slate-500 mb-4">This will notify the customer by email that their application has been declined.</p>
				<label for="decline-reason" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Reason (optional)</label>
				<textarea id="decline-reason" bind:value={declineReason} rows="3" placeholder="Reason for declining…"
					class="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 resize-none"></textarea>
				<div class="flex items-center justify-end gap-3 mt-4">
					<button onclick={() => showDeclineModal = false}
						class="h-9 px-4 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold transition-colors hover:border-slate-300">
						Cancel
					</button>
					<button onclick={decline} disabled={!!actionLoading}
						class="h-9 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
						{actionLoading === 'decline' ? 'Declining…' : 'Confirm Decline'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
