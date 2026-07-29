<script>
	import { enhance } from '$app/forms';
	import { pbFileUrl } from '$lib/pbUtils.js';

	let { data } = $props();
	let { applications, role, debtPartners, licensees } = $derived.by(() => data);

	const CLIENT_LEGAL_ENTITIES = [
		{ value: '', label: '— Not set —' },
		{ value: 'Limited Company', label: 'Limited Company' },
		{ value: 'Partnership', label: 'Partnership' },
		{ value: 'LLP', label: 'LLP' },
		{ value: 'Sole Trader', label: 'Sole Trader' },
		{ value: 'Other', label: 'Other' },
		{ value: 'Insolvency Partner', label: 'Insolvency Partner' },
		{ value: 'Unknown', label: 'Unknown' },
	];

	// Approve modal Insight-2 fields (pre-filled from membership type defaults)
	let approveClientLegalEntity = $state('');
	let approveDebtPartners1Id = $state('3');
	let approveDebtPartners2Id = $state('3');
	let approveLicenseeId = $state('');

	function openApproveWithDefaults(e, app) {
		e.stopPropagation();
		const mt = app.expand?.membership_type_id;
		approveClientLegalEntity = mt?.client_legal_entity || '';
		approveDebtPartners1Id = mt?.insight_debt_partners_id || '3';
		approveDebtPartners2Id = '3';
		approveLicenseeId = String(app.expand?.licensee_id?.insight_licensee_id || '');
		modal = { type: 'approve', app };
	}

	const TABS = ['pending', 'accepted', 'declined', 'closed', 'deleted'];
	let activeTab = $state('pending');
	let search = $state('');

	let filtered = $derived.by(() => {
		let list = applications.filter(a => a.status === activeTab);
		if (search.trim()) {
			const q = search.toLowerCase();
			list = list.filter(a =>
				a.company_name?.toLowerCase().includes(q) ||
				a.contact_name?.toLowerCase().includes(q) ||
				a.company_reg_no?.toLowerCase().includes(q)
			);
		}
		return list;
	});

	function fmtDate(d) {
		if (!d) return '—';
		const dt = new Date(d);
		const date = dt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
		const time = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
		return `${date} ${time}`;
	}

	let modal = $state(null); // { type: 'approve'|'decline'|'delete', app }
	let declineReason = $state('');
	let actionLoading = $state(false);

	// --- Stats ---
	let stats = $derived.by(() => {
		const total = applications.length;
		const pending = applications.filter(a => a.status === 'pending').length;
		const accepted = applications.filter(a => a.status === 'accepted').length;
		const declined = applications.filter(a => a.status === 'declined').length;
		const returned = applications.filter(a => a.tc_accepted_at).length;
		const awaitingResponse = applications.filter(a => a.status === 'pending' && !a.tc_accepted_at).length;
		const conversionRate = total > 0 ? Math.round((accepted / total) * 100) : 0;
		const returnRate = total > 0 ? Math.round((returned / total) * 100) : 0;
		const approvalRate = returned > 0 ? Math.round((accepted / returned) * 100) : 0;

		// Per-licensee breakdown (admin only)
		const byLicensee = {};
		for (const a of applications) {
			const name = a.expand?.licensee_id?.name || a.expand?.licensee_id?.email || 'Unknown';
			if (!byLicensee[name]) byLicensee[name] = { total: 0, accepted: 0, pending: 0, declined: 0 };
			byLicensee[name].total++;
			if (a.status === 'accepted') byLicensee[name].accepted++;
			if (a.status === 'pending') byLicensee[name].pending++;
			if (a.status === 'declined') byLicensee[name].declined++;
		}
		const licenseeList = Object.entries(byLicensee)
			.map(([name, d]) => ({ name, ...d }))
			.sort((a, b) => b.total - a.total)
			.slice(0, 5);

		// Top membership types
		const byType = {};
		for (const a of applications) {
			const name = a.expand?.membership_type_id?.name || 'Unknown';
			if (!byType[name]) byType[name] = 0;
			byType[name]++;
		}
		const topTypes = Object.entries(byType)
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 4);

		return { total, pending, accepted, declined, returned, awaitingResponse, conversionRate, returnRate, approvalRate, licenseeList, topTypes };
	});

	function openApprove(e, app) { openApproveWithDefaults(e, app); }
	function openDecline(e, app) { e.stopPropagation(); modal = { type: 'decline', app }; declineReason = ''; }
	function openDelete(e, app) { e.stopPropagation(); modal = { type: 'delete', app }; }
	function openChase(app) { modal = { type: 'chase', app }; }
	function closeModal() { modal = null; }

	function submitEnhance(redirectTab) {
		return () => {
			actionLoading = true;
			return async ({ update, result }) => {
				await update();
				actionLoading = false;
				if (result.type === 'success') {
					closeModal();
					if (redirectTab) activeTab = redirectTab;
				}
			};
		};
	}
</script>

<div class="max-w-7xl mx-auto">
	<div class="flex items-center justify-between mb-6">
		<div>
			<h1 class="nunito-sans-700 text-2xl text-slate-900">Applications</h1>
			<p class="text-sm text-slate-500 mt-0.5">{role === 'admin' ? 'All membership applications' : 'Your customer applications'}</p>
		</div>
		<a href="/new" class="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[#1e3a8a] hover:bg-[#1e40af] text-white text-sm font-semibold shadow-sm transition-colors">
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
			Invite New Customer
		</a>
	</div>

	<!-- Stats Section -->
	<div class="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
		<!-- Total Sent -->
		<div class="col-span-2 sm:col-span-2 lg:col-span-2 bg-[#0f1a3d] rounded-xl p-4 text-white flex flex-col justify-between min-h-22.5">
			<p class="text-[11px] font-semibold uppercase tracking-widest text-blue-200/70">Total Sent</p>
			<p class="text-4xl font-bold mt-1">{stats.total}</p>
			<p class="text-[11px] text-blue-200/60 mt-1">All time invitations</p>
		</div>
		<!-- Accepted -->
		<div class="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex flex-col justify-between min-h-22.5">
			<p class="text-[11px] font-semibold uppercase tracking-widest text-emerald-600/70">Accepted</p>
			<p class="text-3xl font-bold text-emerald-700 mt-1">{stats.accepted}</p>
			<p class="text-[11px] text-emerald-500 mt-1">{stats.conversionRate}% of total</p>
		</div>
		<!-- Pending -->
		<div class="bg-amber-50 border border-amber-100 rounded-xl p-4 flex flex-col justify-between min-h-22.5">
			<p class="text-[11px] font-semibold uppercase tracking-widest text-amber-600/70">Pending</p>
			<p class="text-3xl font-bold text-amber-700 mt-1">{stats.pending}</p>
			<p class="text-[11px] text-amber-500 mt-1">{stats.awaitingResponse} awaiting form</p>
		</div>
		<!-- Declined -->
		<div class="bg-red-50 border border-red-100 rounded-xl p-4 flex flex-col justify-between min-h-22.5">
			<p class="text-[11px] font-semibold uppercase tracking-widest text-red-500/70">Declined</p>
			<p class="text-3xl font-bold text-red-600 mt-1">{stats.declined}</p>
			<p class="text-[11px] text-red-400 mt-1">{stats.total > 0 ? Math.round((stats.declined / stats.total) * 100) : 0}% of total</p>
		</div>
		<!-- Form Return Rate -->
		<div class="bg-violet-50 border border-violet-100 rounded-xl p-4 flex flex-col justify-between min-h-22.5">
			<p class="text-[11px] font-semibold uppercase tracking-widest text-violet-600/70">Return Rate</p>
			<p class="text-3xl font-bold text-violet-700 mt-1">{stats.returnRate}%</p>
			<p class="text-[11px] text-violet-400 mt-1">{stats.returned} forms back</p>
		</div>
		<!-- Approval Rate -->
		<div class="bg-sky-50 border border-sky-100 rounded-xl p-4 flex flex-col justify-between min-h-22.5">
			<p class="text-[11px] font-semibold uppercase tracking-widest text-sky-600/70">Approval Rate</p>
			<p class="text-3xl font-bold text-sky-700 mt-1">{stats.approvalRate}%</p>
			<p class="text-[11px] text-sky-400 mt-1">Of returned forms</p>
		</div>
	</div>

	<!-- Licensee + Type breakdown (admin only) -->
	{#if role === 'admin' && stats.total > 0}
		<div class="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
			<!-- Per Licensee -->
			<div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
				<h3 class="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">Applications by Licensee</h3>
				<div class="space-y-2">
					{#each stats.licenseeList as lic}
						{@const pct = stats.total > 0 ? Math.round((lic.total / stats.total) * 100) : 0}
						<div>
							<div class="flex items-center justify-between mb-0.5">
								<span class="text-xs font-semibold text-slate-700 truncate max-w-[60%]">{lic.name}</span>
								<div class="flex items-center gap-2 text-[10px]">
									<span class="text-slate-500">{lic.total} sent</span>
									<span class="text-emerald-600 font-semibold">{lic.accepted} ✓</span>
									{#if lic.pending > 0}<span class="text-amber-500">{lic.pending} ⏳</span>{/if}
									{#if lic.declined > 0}<span class="text-red-400">{lic.declined} ✗</span>{/if}
								</div>
							</div>
							<div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
								<div class="h-full rounded-full bg-[#1e3a8a] transition-all" style="width:{pct}%"></div>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Top Membership Types -->
			<div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
				<h3 class="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">Top Membership Types</h3>
				<div class="space-y-2">
					{#each stats.topTypes as t, i}
						{@const pct = stats.total > 0 ? Math.round((t.count / stats.total) * 100) : 0}
						{@const colours = ['bg-[#1e3a8a]', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-400']}
						<div>
							<div class="flex items-center justify-between mb-0.5">
								<span class="text-xs font-semibold text-slate-700 truncate max-w-[70%]">{t.name}</span>
								<span class="text-[10px] text-slate-500">{t.count} ({pct}%)</span>
							</div>
							<div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
								<div class="h-full rounded-full {colours[i]} transition-all" style="width:{pct}%"></div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
		<!-- Tabs -->
		<div class="border-b border-slate-200 px-4 flex items-center gap-1 overflow-x-auto">
			{#each TABS as tab}
				{@const count = applications.filter(a => a.status === tab).length}
				<button onclick={() => activeTab = tab}
					class="px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors capitalize whitespace-nowrap {activeTab === tab ? 'border-[#1e3a8a] text-[#1e3a8a]' : 'border-transparent text-slate-500 hover:text-slate-800'}">
					{tab} {#if count > 0}<span class="ml-1 px-1.5 py-0.5 text-[10px] rounded-full {activeTab === tab ? 'bg-[#1e3a8a] text-white' : 'bg-slate-100 text-slate-500'}">{count}</span>{/if}
				</button>
			{/each}
		</div>

		<!-- Search bar -->
		<div class="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center gap-3">
			<div class="relative flex-1 max-w-xs">
				<svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
				<input bind:value={search} type="text" placeholder="Filter results…"
					class="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a]" />
			</div>
			<span class="text-xs text-slate-400">{filtered.length} result{filtered.length === 1 ? '' : 's'}</span>
		</div>

		<!-- Table -->
		<div class="overflow-x-auto">
			<table class="min-w-full text-sm">
				<thead>
					<tr class="bg-[#0f1a3d] text-white text-[11px] font-semibold uppercase tracking-wide">
						<th class="px-4 py-3.5 text-left">Despatch Date</th>
						{#if role === 'admin'}<th class="px-4 py-3.5 text-left">Licensee</th>{/if}
						<th class="px-4 py-3.5 text-left">Company Type</th>
						<th class="px-4 py-3.5 text-left">Membership Type</th>
						<th class="px-4 py-3.5 text-left">Name of Company</th>
						<th class="px-4 py-3.5 text-left">Trading Address</th>
						<th class="px-4 py-3.5 text-left">Reg No</th>
						<th class="px-4 py-3.5 text-left">Contact Person</th>
						<th class="px-4 py-3.5 text-left">Country</th>
						<th class="px-4 py-3.5 text-center">View Log</th>
						<th class="px-4 py-3.5 text-center">Client Info</th>
						<th class="px-4 py-3.5 text-center">Chase</th>
						<th class="px-4 py-3.5 text-left">Actions</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#if filtered.length === 0}
						<tr>
							<td colspan="10" class="px-5 py-16 text-center text-slate-500">
								<div class="flex flex-col items-center gap-2">
									<div class="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
										<svg class="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
									</div>
									<p class="text-sm font-semibold text-slate-600">No {activeTab} applications</p>
								</div>
							</td>
						</tr>
					{:else}
						{#each filtered as app, i}
							<tr class="cursor-pointer transition-colors {i % 2 === 0 ? 'bg-white hover:bg-blue-50/30' : 'bg-slate-50/40 hover:bg-blue-50/30'}"
								onclick={() => window.location.href = `/applications/${app.id}`}>
								<td class="px-4 py-3.5 text-xs text-slate-600">{fmtDate(app.dispatch_date)}</td>
								{#if role === 'admin'}
									<td class="px-4 py-3.5">
										<span class="text-xs font-medium text-slate-700">{app.expand?.licensee_id?.name || app.expand?.licensee_id?.email || '—'}</span>
									</td>
								{/if}
								<td class="px-4 py-3.5">
									<span class="text-xs font-medium text-slate-700 capitalize">{app.company_type?.replace('_', ' ') || '—'}</span>
								</td>
								<td class="px-4 py-3.5">
									<div class="flex items-center gap-1.5">
										{#if app.expand?.membership_type_id?.logo}
											<img src={pbFileUrl('ma_membership_types', app.expand.membership_type_id.id, app.expand.membership_type_id.logo)} alt="" class="w-5 h-5 rounded object-contain shrink-0" />
										{/if}
										<span class="text-xs font-medium text-slate-700">{app.expand?.membership_type_id?.name || '—'}</span>
									</div>
								</td>
								<td class="px-4 py-3.5">
									<span class="font-semibold text-slate-800">{app.company_name || '—'}</span>
									{#if app.trading_name && app.trading_name !== app.company_name}
										<p class="text-[11px] text-slate-400">t/a {app.trading_name}</p>
									{/if}
									{#if app.invite_token}
										<div class="mt-1.5 space-y-0.5">
											{#if app.invite_sent_at}
												<p class="text-[10px] text-slate-400">Invited: {fmtDate(app.invite_sent_at)}</p>
											{/if}
											{#if app.tc_accepted_at}
												<p class="text-[10px] text-emerald-600">Returned: {fmtDate(app.tc_accepted_at)}</p>
											{/if}
											<button onclick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`${location.origin}/apply/${app.invite_token}`); }}
												class="inline-flex items-center gap-1 text-[10px] text-[#1e3a8a] hover:underline">
												<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
												Copy invite link
											</button>
											<a href="/apply/{app.invite_token}" target="_blank" rel="noopener" onclick={(e) => e.stopPropagation()}
												class="inline-flex items-center gap-1 text-[10px] text-[#1e3a8a] hover:underline">
												<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
												Open link
											</a>
										</div>
									{/if}
								</td>
								<td class="px-4 py-3.5 max-w-40">
									<span class="text-xs text-slate-600 line-clamp-2">{app.trading_address || '—'}</span>
								</td>
								<td class="px-4 py-3.5 text-xs font-mono text-slate-600">{app.company_reg_no || '—'}</td>
								<td class="px-4 py-3.5 text-xs text-slate-600">{app.contact_name || '—'}</td>
								<td class="px-4 py-3.5 text-xs uppercase text-slate-500">{app.country || 'uk'}</td>

								<!-- View Log -->
								<td class="px-4 py-3.5 text-center">
									<a href="/applications/{app.id}" onclick={(e) => e.stopPropagation()}
										title="View application log"
										class="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-[#1e3a8a] transition-colors">
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
									</a>
								</td>

								<!-- Client Info / returned form -->
								<td class="px-4 py-3.5 text-center">
									{#if app.tc_accepted_at}
										<span title="Client submitted form {fmtDate(app.tc_accepted_at)}"
											class="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600">
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
										</span>
									{:else}
										<span title="Awaiting client to complete form" class="blink inline-flex items-center justify-center w-7 h-7 rounded-lg bg-red-100 text-red-600">
											<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
										</span>
									{/if}
								</td>

								<!-- Chase -->
								<td class="px-4 py-3.5 text-center">
									{#if !app.tc_accepted_at}
										<button onclick={(e) => { e.stopPropagation(); openChase(app); }}
											title="Send a chase email to customer"
											class="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-600 transition-colors">
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
										</button>
									{/if}
								</td>

								<td class="px-4 py-3.5">
									<div class="flex flex-col gap-1">
										<a href="/applications/{app.id}" onclick={(e) => e.stopPropagation()}
											class="inline-flex items-center justify-center px-2.5 py-1 text-[11px] font-semibold text-[#1e3a8a] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
											View
										</a>
										{#if app.status === 'pending' && role === 'admin'}
											<button onclick={(e) => openApprove(e, app)}
												disabled={!app.tc_accepted_at}
												title={!app.tc_accepted_at ? 'Customer has not submitted their form yet' : ''}
												class="inline-flex items-center justify-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors {app.tc_accepted_at ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100' : 'text-slate-400 bg-slate-100 cursor-not-allowed'}">
												✓ Approve
											</button>
											<button onclick={(e) => openDecline(e, app)}
												class="inline-flex items-center justify-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
												✕ Decline
											</button>
										{/if}
										{#if app.status !== 'deleted'}
											<button onclick={(e) => openDelete(e, app)}
												class="inline-flex items-center justify-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
												🗑 Delete
											</button>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</div>
</div>

{#if modal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
		role="presentation" onclick={closeModal} onkeydown={(e) => e.key === 'Escape' && closeModal()}>
		<div class="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden"
			role="dialog" aria-modal="true" tabindex="-1"
			onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>

			<div class="h-1 {modal.type === 'approve' ? 'bg-emerald-500' : modal.type === 'delete' ? 'bg-slate-500' : 'bg-red-500'}"></div>

			<div class="p-6">
				{#if modal.type === 'approve'}
					<h2 class="nunito-sans-700 text-lg text-slate-900 mb-1">Approve Application</h2>
					<p class="text-sm text-slate-500 mb-4">Confirm details below before creating the Insight-2 record and sending the acceptance email.</p>

					<!-- Client summary -->
					<div class="bg-slate-50 rounded-lg border border-slate-200 p-4 mb-4 text-sm space-y-1.5">
						<div class="flex justify-between">
							<span class="text-slate-500 text-xs font-semibold uppercase tracking-wide">Company</span>
							<span class="font-semibold text-slate-800">{modal.app.company_name}</span>
						</div>
						{#if modal.app.company_reg_no}
						<div class="flex justify-between">
							<span class="text-slate-500 text-xs font-semibold uppercase tracking-wide">Reg No</span>
							<span class="text-slate-700">{modal.app.company_reg_no}</span>
						</div>
						{/if}
						<div class="flex justify-between">
							<span class="text-slate-500 text-xs font-semibold uppercase tracking-wide">Contact</span>
							<span class="text-slate-700">{modal.app.contact_name || '—'}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-slate-500 text-xs font-semibold uppercase tracking-wide">Email</span>
							<span class="text-slate-700">{modal.app.email || '—'}</span>
						</div>
						{#if modal.app.telephone}
						<div class="flex justify-between">
							<span class="text-slate-500 text-xs font-semibold uppercase tracking-wide">Tel</span>
							<span class="text-slate-700">{modal.app.telephone}</span>
						</div>
						{/if}
						{#if modal.app.expand?.membership_type_id?.name}
						<div class="flex justify-between">
							<span class="text-slate-500 text-xs font-semibold uppercase tracking-wide">Membership</span>
							<span class="text-slate-700">{modal.app.expand.membership_type_id.name}</span>
						</div>
						{/if}
					</div>

					<!-- Insight-2 fields -->
					<form method="POST" action="?/approve" use:enhance={submitEnhance('accepted')}>
						<input type="hidden" name="id" value={modal.app.id} />

						<div class="space-y-3 mb-5">
							<!-- Licensee from Insight-2 -->
							<div>
								<label for="approve-licensee" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Licensee / Area</label>
								<select id="approve-licensee" name="insight_licensee_id" bind:value={approveLicenseeId}
									class="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] bg-white">
									<option value="">— Unassigned —</option>
									{#each (licensees ?? []) as l}
										<option value={l.id}>{l.label}{l.area ? ` — ${l.area}` : ''}</option>
									{/each}
								</select>
								{#if !licensees?.length}
									<p class="text-[11px] text-amber-500 mt-0.5">Insight-2 unavailable — licensees not loaded.</p>
								{/if}
							</div>

							<div class="flex items-center gap-2">
								<div class="w-1.5 h-1.5 rounded-full bg-violet-500"></div>
								<span class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Insight-2 Record Fields</span>
							</div>

							<div>
								<label for="approve-legal-entity" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Client Legal Entity</label>
								<select id="approve-legal-entity" name="client_legal_entity" bind:value={approveClientLegalEntity}
									class="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-white">
									{#each CLIENT_LEGAL_ENTITIES as e}
										<option value={e.value}>{e.label}</option>
									{/each}
								</select>
							</div>

							<div class="grid grid-cols-2 gap-3">
								<div>
									<label for="approve-dp1" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Debt Partner 1</label>
									<select id="approve-dp1" name="debt_partners1_id" bind:value={approveDebtPartners1Id}
										class="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-white">
										<option value="3">— None —</option>
										{#each (debtPartners ?? []) as dp}
											<option value={String(dp.id)}>{dp.name}</option>
										{/each}
									</select>
								</div>
								<div>
									<label for="approve-dp2" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Debt Partner 2</label>
									<select id="approve-dp2" name="debt_partners2_id" bind:value={approveDebtPartners2Id}
										class="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-white">
										<option value="3">— None —</option>
										{#each (debtPartners ?? []) as dp}
											<option value={String(dp.id)}>{dp.name}</option>
										{/each}
									</select>
								</div>
							</div>
							{#if !debtPartners?.length}
								<p class="text-[11px] text-amber-500">Insight-2 unavailable — debt partners not loaded.</p>
							{/if}
						</div>

						<div class="flex gap-3 justify-end">
							<button type="button" onclick={closeModal} class="h-9 px-4 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">Cancel</button>
							<button type="submit" disabled={actionLoading}
								class="h-9 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-60">
								{actionLoading ? 'Approving…' : 'Confirm Approval'}
							</button>
						</div>
					</form>

				{:else if modal.type === 'decline'}
					<h2 class="nunito-sans-700 text-lg text-slate-900 mb-1">Decline Application</h2>
					<p class="text-sm text-slate-500 mb-4">Declining <strong>{modal.app.company_name}</strong> will notify the applicant by email.</p>
					<form method="POST" action="?/decline" use:enhance={submitEnhance('declined')}>
						<input type="hidden" name="id" value={modal.app.id} />
						<div class="mb-4">
							<label for="decline-reason" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Reason (optional)</label>
							<textarea id="decline-reason" name="reason" bind:value={declineReason} rows="3"
								placeholder="Provide a reason for declining…"
								class="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 resize-none"></textarea>
						</div>
						<div class="flex gap-3 justify-end">
							<button type="button" onclick={closeModal} class="h-9 px-4 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">Cancel</button>
							<button type="submit" disabled={actionLoading}
								class="h-9 px-5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-60">
								{actionLoading ? 'Declining…' : 'Confirm Decline'}
							</button>
						</div>
					</form>

				{:else if modal.type === 'delete'}
					<h2 class="nunito-sans-700 text-lg text-slate-900 mb-1">Delete Application</h2>
					<p class="text-sm text-slate-500 mb-5">Mark <strong>{modal.app.company_name}</strong> as deleted. It will be visible in the Deleted tab.</p>
					<form method="POST" action="?/delete" use:enhance={submitEnhance(null)}>
						<input type="hidden" name="id" value={modal.app.id} />
						<div class="flex gap-3 justify-end">
							<button type="button" onclick={closeModal} class="h-9 px-4 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">Cancel</button>
							<button type="submit" disabled={actionLoading}
								class="h-9 px-5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold transition-colors disabled:opacity-60">
								{actionLoading ? 'Deleting…' : 'Confirm Delete'}
							</button>
						</div>
					</form>

				{:else if modal.type === 'chase'}
					<h2 class="nunito-sans-700 text-lg text-slate-900 mb-1">Chase Customer</h2>
					<p class="text-sm text-slate-500 mb-5">Send a reminder email to <strong>{modal.app.contact_name}</strong> at <strong>{modal.app.email}</strong> asking them to complete their application.</p>
					<div class="flex gap-3 justify-end">
						<button type="button" onclick={closeModal} class="h-9 px-4 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">Cancel</button>
						<button type="button" disabled={actionLoading}
							onclick={async () => {
								actionLoading = true;
								try {
									await fetch('/api/applications/chase', {
										method: 'POST',
										headers: { 'Content-Type': 'application/json' },
										body: JSON.stringify({ id: modal.app.id })
									});
								} finally {
									actionLoading = false;
									closeModal();
								}
							}}
							class="h-9 px-5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors disabled:opacity-60">
							{actionLoading ? 'Sending…' : 'Send Chase Email'}
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
	:global(.blink) { animation: blink 1.2s ease-in-out infinite; }
</style>
