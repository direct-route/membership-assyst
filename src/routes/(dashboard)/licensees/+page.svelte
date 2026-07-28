<script>
	import { enhance } from '$app/forms';
	let { data, form } = $props();
	let licensees = $derived(data.licensees);
	let statsMap = $derived(data.statsMap);
	let insightLicensees = $derived(data.insightLicensees ?? []);
	let showAdd = $state(false);

	function fmtDate(d) {
		if (!d) return '—';
		return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
	}
</script>

<div class="max-w-5xl mx-auto">
	<div class="flex items-center justify-between mb-6">
		<div>
			<h1 class="nunito-sans-700 text-2xl text-slate-900">Licensees</h1>
			<p class="text-sm text-slate-500 mt-0.5">Manage affiliate licensee accounts</p>
		</div>
		<button onclick={() => showAdd = !showAdd}
			class="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[#1e3a8a] hover:bg-[#1e40af] text-white text-sm font-semibold transition-colors">
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
			Add Licensee
		</button>
	</div>

	{#if showAdd}
		<div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-5">
			<h3 class="nunito-sans-700 text-sm font-bold text-slate-800 mb-4">New Licensee Account</h3>
			{#if form?.error}
				<div class="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{form.error}</div>
			{/if}
			<form method="POST" action="?/create" use:enhance={() => {
				return async ({ update }) => { await update(); showAdd = false; };
			}}>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<label class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Contact Name *</label>
						<input name="name" type="text" required class="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a]" />
					</div>
					<div>
						<label class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Company Name</label>
						<input name="licensee_name" type="text" class="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a]" />
					</div>
					<div>
						<label class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Email *</label>
						<input name="email" type="email" required class="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a]" />
					</div>
					<div>
						<label class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Password *</label>
						<input name="password" type="password" required minlength="8" class="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a]" />
					</div>
				</div>
				<div class="flex items-center gap-3 mt-4">
					<button type="submit" class="h-9 px-4 rounded-lg bg-[#1e3a8a] hover:bg-[#1e40af] text-white text-sm font-semibold transition-colors">Create Licensee</button>
					<button type="button" onclick={() => showAdd = false} class="h-9 px-4 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold transition-colors">Cancel</button>
				</div>
			</form>
		</div>
	{/if}

	<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
		<div class="overflow-x-auto">
			<table class="min-w-full text-sm">
				<thead>
					<tr class="bg-[#0f1a3d] text-white text-[11px] font-semibold uppercase tracking-wide">
						<th class="px-5 py-3.5 text-left">Date Added</th>
						<th class="px-5 py-3.5 text-left">Company Name</th>
						<th class="px-5 py-3.5 text-left">Contact Name</th>
						<th class="px-5 py-3.5 text-left">Email</th>
						<th class="px-5 py-3.5 text-left">Insight Licensee</th>
						<th class="px-5 py-3.5 text-center">Sent</th>
						<th class="px-5 py-3.5 text-center">Returned</th>
						<th class="px-5 py-3.5 text-center">Accepted</th>
						<th class="px-5 py-3.5 text-center">Pending</th>
						<th class="px-5 py-3.5 text-center">Declined</th>
						<th class="px-5 py-3.5 text-center">Conv. %</th>
						<th class="px-5 py-3.5 text-left">Last Activity</th>
						<th class="px-5 py-3.5 text-left">Cases</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#if licensees.length === 0}
						<tr>
							<td colspan="13" class="px-5 py-12 text-center text-sm text-slate-400">No licensees yet.</td>
						</tr>
					{:else}
						{#each licensees as l, i}
							{@const s = statsMap[l.id] ?? { total: 0, accepted: 0, pending: 0, declined: 0, returned: 0, lastActivity: null }}
							{@const conv = s.total > 0 ? Math.round((s.accepted / s.total) * 100) : null}
							<tr class="{i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}">
								<td class="px-5 py-3.5 text-slate-500 text-xs">{fmtDate(l.created)}</td>
								<td class="px-5 py-3.5 font-medium text-slate-800">{l.licensee_name || '—'}</td>
								<td class="px-5 py-3.5 text-slate-700">{l.name || '—'}</td>
								<td class="px-5 py-3.5 text-slate-500 text-xs">{l.email}</td>

								<!-- Insight Licensee link -->
								<td class="px-5 py-3.5">
									{#if insightLicensees.length > 0}
										<form method="POST" action="?/linkInsight" use:enhance={() => ({ async update(r) { await r.update(); } })}>
											<input type="hidden" name="user_id" value={l.id} />
											<select name="insight_licensee_id"
												onchange={(e) => e.currentTarget.form.requestSubmit()}
												class="text-xs px-2 py-1 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] max-w-45">
												<option value="">— Not linked —</option>
												{#each insightLicensees as il}
													<option value={il.id} selected={l.insight_licensee_id == il.id}>
														{il.licensee_name || il.name}{il.area_name ? ` — ${il.area_name}` : ''}
													</option>
												{/each}
											</select>
										</form>
										{#if l.insight_licensee_id}
											<p class="text-[10px] text-slate-400 mt-0.5">ID: {l.insight_licensee_id}</p>
										{/if}
									{:else}
										<span class="text-[11px] text-slate-300">DB unavailable</span>
									{/if}
								</td>

								<!-- Sent -->
								<td class="px-5 py-3.5 text-center">
									<span class="text-sm font-bold text-slate-800">{s.total}</span>
								</td>
								<!-- Returned -->
								<td class="px-5 py-3.5 text-center">
									<span class="text-sm font-semibold {s.returned > 0 ? 'text-violet-600' : 'text-slate-300'}">{s.returned}</span>
								</td>
								<!-- Accepted -->
								<td class="px-5 py-3.5 text-center">
									{#if s.accepted > 0}
										<span class="inline-flex items-center justify-center min-w-6 px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700">{s.accepted}</span>
									{:else}
										<span class="text-slate-300 text-xs">—</span>
									{/if}
								</td>
								<!-- Pending -->
								<td class="px-5 py-3.5 text-center">
									{#if s.pending > 0}
										<span class="inline-flex items-center justify-center min-w-6 px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700">{s.pending}</span>
									{:else}
										<span class="text-slate-300 text-xs">—</span>
									{/if}
								</td>
								<!-- Declined -->
								<td class="px-5 py-3.5 text-center">
									{#if s.declined > 0}
										<span class="inline-flex items-center justify-center min-w-6 px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-600">{s.declined}</span>
									{:else}
										<span class="text-slate-300 text-xs">—</span>
									{/if}
								</td>
								<!-- Conversion -->
								<td class="px-5 py-3.5 text-center">
									{#if conv !== null}
										<span class="text-xs font-bold {conv >= 50 ? 'text-emerald-600' : conv >= 25 ? 'text-amber-600' : 'text-red-500'}">{conv}%</span>
									{:else}
										<span class="text-slate-300 text-xs">—</span>
									{/if}
								</td>
								<!-- Last Activity -->
								<td class="px-5 py-3.5 text-xs text-slate-500">{s.lastActivity ? fmtDate(s.lastActivity) : '—'}</td>
								<!-- View Cases -->
								<td class="px-5 py-3.5">
									<a href="/applications?licensee={l.id}"
										class="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#1e3a8a] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
										View
									</a>
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</div>
</div>
