<script>
	import { enhance } from '$app/forms';
	let { data } = $props();
	let types = $derived(data.types);
	let active = $derived(types.filter(t => t.active !== false));
	let inactive = $derived(types.filter(t => t.active === false));
	let accountAssystCount = $derived(types.filter(t => (t.invite_email_body || '').includes('accountassyst.com')).length);
	let showAdd = $state(false);
	let newName = $state('');
</script>

<div class="max-w-2xl mx-auto">
	<div class="flex items-center justify-between mb-6">
		<div>
			<h1 class="nunito-sans-700 text-2xl text-slate-900">Membership Types</h1>
			<p class="text-sm text-slate-500 mt-0.5">Manage available membership packages</p>
		</div>
		<button onclick={() => showAdd = !showAdd}
			class="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[#1e3a8a] hover:bg-[#1e40af] text-white text-sm font-semibold transition-colors">
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
			New Membership Type
		</button>
	</div>

	{#if accountAssystCount > 0}
		<div class="mb-5 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-3 text-sm">
			<svg class="w-5 h-5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
			<span class="text-amber-800"><strong>{accountAssystCount} template{accountAssystCount !== 1 ? 's' : ''}</strong> contain an <code class="font-mono text-xs bg-amber-100 px-1 py-0.5 rounded">accountassyst.com</code> link in the invite email body. Review and update these templates.</span>
		</div>
	{/if}

	{#if showAdd}
		<div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-4">
			<form method="POST" action="?/create" use:enhance={() => {
				return async ({ update }) => { await update(); showAdd = false; newName = ''; };
			}} class="flex gap-3">
				<input name="name" bind:value={newName} type="text" placeholder="Membership type name…" required
					class="flex-1 px-3.5 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a]" />
				<button type="submit" class="h-9 px-4 rounded-lg bg-[#1e3a8a] hover:bg-[#1e40af] text-white text-sm font-semibold transition-colors">Add</button>
				<button type="button" onclick={() => showAdd = false} class="h-9 px-4 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold transition-colors hover:border-slate-300">Cancel</button>
			</form>
		</div>
	{/if}

	<!-- Active types -->
	<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-5">
		<div class="px-5 py-3 border-b border-slate-100 bg-slate-50/60">
			<span class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Active ({active.length})</span>
		</div>
		{#if active.length === 0}
			<div class="px-5 py-10 text-center text-slate-400 text-sm">No active types.</div>
		{:else}
			<table class="w-full text-sm">
				<thead>
					<tr class="bg-[#0f1a3d] text-white text-[11px] font-semibold uppercase tracking-wide">
						<th class="px-5 py-3.5 text-left">Name</th>
						<th class="px-5 py-3.5 text-center">Insight ID</th>
						<th class="px-5 py-3.5 text-center">Active</th>
						<th class="px-5 py-3.5 text-right">Actions</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each active as t, i}
						{@const hasAccountAssyst = (t.invite_email_body || '').includes('accountassyst.com')}
						<tr class="{hasAccountAssyst ? 'bg-amber-50' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}">
							<td class="px-5 py-3.5 font-medium text-slate-800">
								{t.name}
								{#if hasAccountAssyst}
									<span class="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
										<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
										accountassyst.com link
									</span>
								{/if}
							</td>
							<td class="px-5 py-3.5 text-center">
								{#if t.insight_debt_partners_id}
									<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-violet-50 text-violet-700 border border-violet-100">DP:{t.insight_debt_partners_id}</span>
								{:else}
									<span class="text-slate-300 text-xs">—</span>
								{/if}
							</td>
							<td class="px-5 py-3.5 text-center">
								<form method="POST" action="?/toggle" use:enhance class="inline">
									<input type="hidden" name="id" value={t.id} />
									<input type="hidden" name="active" value={t.active} />
									<button type="submit" title="Click to deactivate"
										class="relative inline-flex h-5 w-9 items-center rounded-full bg-emerald-500 transition-colors focus:outline-none">
										<span class="inline-block h-3.5 w-3.5 translate-x-4 rounded-full bg-white shadow transition-transform"></span>
									</button>
								</form>
							</td>
							<td class="px-5 py-3.5 text-right">
								<div class="inline-flex items-center gap-4">
									<a href="/membership-types/{t.id}" class="text-xs font-semibold text-[#1e3a8a] hover:text-[#1e40af] transition-colors">Edit</a>
									<form method="POST" action="?/delete" use:enhance class="inline">
										<input type="hidden" name="id" value={t.id} />
										<button type="submit" class="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors"
											onclick={(e) => { if (!confirm('Delete this membership type?')) e.preventDefault(); }}>
											Delete
										</button>
									</form>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>

	<!-- Inactive types -->
	{#if inactive.length > 0}
		<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden opacity-75">
			<div class="px-5 py-3 border-b border-slate-100 bg-slate-50/60">
				<span class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Inactive ({inactive.length})</span>
			</div>
			<table class="w-full text-sm">
				<thead>
					<tr class="bg-slate-600 text-white text-[11px] font-semibold uppercase tracking-wide">
						<th class="px-5 py-3.5 text-left">Name</th>
						<th class="px-5 py-3.5 text-center">Insight ID</th>
						<th class="px-5 py-3.5 text-center">Active</th>
						<th class="px-5 py-3.5 text-right">Actions</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each inactive as t, i}
						{@const hasAccountAssyst = (t.invite_email_body || '').includes('accountassyst.com')}
						<tr class="{hasAccountAssyst ? 'bg-amber-50' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}">
							<td class="px-5 py-3.5 font-medium text-slate-400 line-through">
								{t.name}
								{#if hasAccountAssyst}
									<span class="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
										<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
										accountassyst.com link
									</span>
								{/if}
							</td>
							<td class="px-5 py-3.5 text-center">
								{#if t.insight_debt_partners_id}
									<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-slate-100 text-slate-500 border border-slate-200">DP:{t.insight_debt_partners_id}</span>
								{:else}
									<span class="text-slate-300 text-xs">—</span>
								{/if}
							</td>
							<td class="px-5 py-3.5 text-center">
								<form method="POST" action="?/toggle" use:enhance class="inline">
									<input type="hidden" name="id" value={t.id} />
									<input type="hidden" name="active" value={t.active} />
									<button type="submit" title="Click to activate"
										class="relative inline-flex h-5 w-9 items-center rounded-full bg-slate-300 transition-colors focus:outline-none">
										<span class="inline-block h-3.5 w-3.5 translate-x-1 rounded-full bg-white shadow transition-transform"></span>
									</button>
								</form>
							</td>
							<td class="px-5 py-3.5 text-right">
								<div class="inline-flex items-center gap-4">
									<a href="/membership-types/{t.id}" class="text-xs font-semibold text-[#1e3a8a] hover:text-[#1e40af] transition-colors">Edit</a>
									<form method="POST" action="?/delete" use:enhance class="inline">
										<input type="hidden" name="id" value={t.id} />
										<button type="submit" class="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors"
											onclick={(e) => { if (!confirm('Delete this membership type?')) e.preventDefault(); }}>
											Delete
										</button>
									</form>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
