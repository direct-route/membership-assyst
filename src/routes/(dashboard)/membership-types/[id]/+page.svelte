<script>
	import { onMount, onDestroy } from 'svelte';
	import { enhance } from '$app/forms';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import Link from '@tiptap/extension-link';

	let { data, form } = $props();
	let type = $derived(data.type);
	let debtPartners = $derived(data.debtPartners ?? []);

	let name = $state('');
	let description = $state('');
	let invite_email_subject = $state('');
	let acceptance_email_subject = $state('');
	let active = $state(false);
	let insight_debt_partners_id = $state('');
	let client_legal_entity = $state('');

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

	$effect(() => {
		name = type.name || '';
		description = type.description || '';
		invite_email_subject = type.invite_email_subject || '';
		acceptance_email_subject = type.acceptance_email_subject || '';
		active = type.active ?? false;
		insight_debt_partners_id = type.insight_debt_partners_id || '';
		client_legal_entity = type.client_legal_entity || '';
	});

	const EDITOR_FIELDS = [
		{ key: 'invite_email_body', label: 'Invitation Email Body' },
		{ key: 'acceptance_email_body', label: 'Acceptance Email Body' },
	];

	let editorEls = {};
	let editors = $state({});

	onMount(() => {
		const inited = {};
		for (const f of EDITOR_FIELDS) {
			const el = editorEls[f.key];
			if (!el) continue;
			inited[f.key] = new Editor({
				element: el,
				extensions: [
					StarterKit.configure({ link: false }),
					Link.configure({ openOnClick: false })
				],
				content: type[f.key] || '',
				editorProps: {
					attributes: { class: 'tiptap-editor min-h-48 p-4 focus:outline-none text-slate-700 text-sm leading-relaxed' }
				}
			});
		}
		editors = inited;
	});

	onDestroy(() => {
		for (const e of Object.values(editors)) e?.destroy();
	});

	let saving = $state(false);
	let saved = $state(false);

	function handleSubmit() {
		// Sync editor HTML into hidden inputs before submit
		for (const f of EDITOR_FIELDS) {
			const input = document.querySelector(`input[name="${f.key}"]`);
			if (input && editors[f.key]) input.value = editors[f.key].getHTML();
		}
		saving = true;
		saved = false;
		return async ({ result }) => {
			saving = false;
			if (result.type === 'success') saved = true;
			else if (result.type === 'failure') saved = false;
		};
	}
</script>

<div class="max-w-4xl mx-auto">
	<div class="flex items-center gap-3 mb-6">
		<a href="/membership-types" class="text-slate-400 hover:text-slate-700 transition-colors">
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
		</a>
		<div>
			<h1 class="nunito-sans-700 text-2xl text-slate-900">{type.name}</h1>
			<p class="text-sm text-slate-500 mt-0.5">Edit membership type, email templates and terms</p>
		</div>
	</div>

	{#if form?.error}
		<div class="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{form.error}</div>
	{/if}
	{#if saved}
		<div class="mb-4 px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium">Changes saved.</div>
	{/if}

	<form method="POST" action="?/save" use:enhance={handleSubmit}>
		<!-- Hidden inputs synced from editors on submit -->
		{#each EDITOR_FIELDS as f}
			<input type="hidden" name={f.key} value={type[f.key] || ''} />
		{/each}

		<div class="space-y-5">

			<!-- Basic details -->
			<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
				<div class="h-1 bg-linear-to-r from-blue-800 via-blue-600 to-purple-500"></div>
				<div class="p-6 space-y-4">
					<h2 class="nunito-sans-700 text-base text-slate-800">Basic Details</h2>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label for="name" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Name *</label>
							<input id="name" name="name" type="text" bind:value={name} required autocomplete="off"
								class="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a]" />
						</div>
						<div class="flex items-center gap-3 pt-6">
							<input id="active" name="active" type="checkbox" bind:checked={active}
								class="w-4 h-4 rounded border-slate-300" />
							<label for="active" class="text-sm font-medium text-slate-700">Active</label>
						</div>
					</div>
					<div>
						<label for="description" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Description</label>
						<textarea id="description" name="description" rows="3" bind:value={description}
							class="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] resize-none"></textarea>
					</div>
				</div>
			</div>

			<!-- Invitation email -->
			<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
				<div class="px-6 py-4 border-b border-slate-100 bg-slate-50/60">
					<h2 class="nunito-sans-700 text-base text-slate-800">Invitation Email</h2>
					<p class="text-xs text-slate-400 mt-0.5">Sent when customer is invited to apply. Placeholders: <code class="bg-slate-100 px-1 rounded">&#123;&#123;contact_name&#125;&#125;</code> <code class="bg-slate-100 px-1 rounded">&#123;&#123;company_name&#125;&#125;</code> <code class="bg-slate-100 px-1 rounded">&#123;&#123;apply_url&#125;&#125;</code> <code class="bg-slate-100 px-1 rounded">&#123;&#123;licensee_name&#125;&#125;</code></p>
				</div>
				<div class="p-6 space-y-4">
					<div>
						<label for="invite_email_subject" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Subject</label>
						<input id="invite_email_subject" name="invite_email_subject" type="text" bind:value={invite_email_subject} autocomplete="off"
							class="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a]" />
					</div>
					<div>
						<p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Body</p>
						{@render tiptapEditor('invite_email_body')}
					</div>
				</div>
			</div>

			<!-- Acceptance email -->
			<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
				<div class="px-6 py-4 border-b border-slate-100 bg-slate-50/60">
					<h2 class="nunito-sans-700 text-base text-slate-800">Acceptance Email</h2>
					<p class="text-xs text-slate-400 mt-0.5">Sent when application is approved. Placeholders: <code class="bg-slate-100 px-1 rounded">&#123;&#123;contact_name&#125;&#125;</code> <code class="bg-slate-100 px-1 rounded">&#123;&#123;company_name&#125;&#125;</code> <code class="bg-slate-100 px-1 rounded">&#123;&#123;licensee_name&#125;&#125;</code></p>
				</div>
				<div class="p-6 space-y-4">
					<div>
						<label for="acceptance_email_subject" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Subject</label>
						<input id="acceptance_email_subject" name="acceptance_email_subject" type="text" bind:value={acceptance_email_subject} autocomplete="off"
							class="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a]" />
					</div>
					<div>
						<p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Body</p>
						{@render tiptapEditor('acceptance_email_body')}
					</div>
				</div>
			</div>

			<!-- Insight-2 Defaults -->
			<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
				<div class="px-6 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
					<div class="w-2 h-2 rounded-full bg-violet-500"></div>
					<h2 class="nunito-sans-700 text-base text-slate-800">Insight-2 Defaults</h2>
					<span class="ml-auto text-[11px] text-slate-400">Applied when approving applications of this type</span>
				</div>
				<div class="p-6 space-y-4">
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<!-- Debt Partner -->
						<div>
							<label for="insight_debt_partners_id" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
								Default Debt Partner
							</label>
							{#if debtPartners.length > 0}
								<select id="insight_debt_partners_id" name="insight_debt_partners_id" bind:value={insight_debt_partners_id}
									class="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-white">
									<option value="">— Not set —</option>
									{#each debtPartners as dp}
										<option value={String(dp.id)}>{dp.name}</option>
									{/each}
								</select>
								{#if insight_debt_partners_id}
									<p class="text-[11px] text-slate-400 mt-1">ID: {insight_debt_partners_id}</p>
								{/if}
							{:else}
								<input name="insight_debt_partners_id" type="text" bind:value={insight_debt_partners_id} placeholder="Insight-2 unavailable — enter ID manually"
									class="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500" />
								<p class="text-[11px] text-amber-500 mt-1">Could not load from Insight-2. Enter debt_partners.id manually (3 = None).</p>
							{/if}
						</div>

						<!-- Client Legal Entity -->
						<div>
							<label for="client_legal_entity" class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
								Default Client Legal Entity
							</label>
							<select id="client_legal_entity" name="client_legal_entity" bind:value={client_legal_entity}
								class="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-white">
								{#each CLIENT_LEGAL_ENTITIES as e}
									<option value={e.value}>{e.label}</option>
								{/each}
							</select>
						</div>
					</div>
					<p class="text-[11px] text-slate-400">These values pre-fill the Insight-2 approval form when an application of this membership type is approved. They can be overridden per application.</p>
				</div>
			</div>

			<div class="flex justify-end pb-6">
				<button type="submit" disabled={saving}
					class="h-10 px-6 rounded-lg bg-[#1e3a8a] hover:bg-[#1e40af] text-white text-sm font-semibold transition-colors disabled:opacity-60">
					{saving ? 'Saving…' : 'Save Changes'}
				</button>
			</div>
		</div>
	</form>
</div>

{#snippet tiptapEditor(key)}
	{@const e = editors[key]}
	<div class="border border-slate-200 rounded-lg overflow-hidden">
		{#if e}
			<div class="flex items-center gap-1 px-2 py-1.5 border-b border-slate-200 bg-slate-50 flex-wrap">
				<button type="button" onclick={() => e.chain().focus().toggleBold().run()}
					class="px-2 py-1 text-xs font-bold rounded hover:bg-slate-200 transition-colors {e.isActive('bold') ? 'bg-slate-200' : ''}">B</button>
				<button type="button" onclick={() => e.chain().focus().toggleItalic().run()}
					class="px-2 py-1 text-xs italic rounded hover:bg-slate-200 transition-colors {e.isActive('italic') ? 'bg-slate-200' : ''}">I</button>
				<button type="button" onclick={() => e.chain().focus().toggleBulletList().run()}
					class="px-2 py-1 text-xs rounded hover:bg-slate-200 transition-colors {e.isActive('bulletList') ? 'bg-slate-200' : ''}">• List</button>
				<button type="button" onclick={() => e.chain().focus().toggleOrderedList().run()}
					class="px-2 py-1 text-xs rounded hover:bg-slate-200 transition-colors {e.isActive('orderedList') ? 'bg-slate-200' : ''}">1. List</button>
				<div class="w-px h-4 bg-slate-300 mx-1"></div>
				<button type="button" onclick={() => { const url = prompt('URL:'); if (url) e.chain().focus().setLink({ href: url }).run(); }}
					class="px-2 py-1 text-xs rounded hover:bg-slate-200 transition-colors {e.isActive('link') ? 'bg-slate-200 text-[#1e3a8a]' : ''}">Link</button>
				<button type="button" onclick={() => e.chain().focus().unsetLink().run()}
					class="px-2 py-1 text-xs rounded hover:bg-slate-200 transition-colors text-red-500">Unlink</button>
			</div>
		{/if}
		<div bind:this={editorEls[key]} class="bg-white"></div>
	</div>
{/snippet}

<style>
	:global(.tiptap-editor p) { margin-bottom: 0.75rem; }
	:global(.tiptap-editor p:last-child) { margin-bottom: 0; }
	:global(.tiptap-editor a) { color: #1e3a8a; text-decoration: underline; }
	:global(.tiptap-editor strong) { font-weight: 600; }
	:global(.tiptap-editor em) { font-style: italic; }
	:global(.tiptap-editor ul) { list-style: disc; padding-left: 1.25rem; margin-bottom: 0.75rem; }
	:global(.tiptap-editor ol) { list-style: decimal; padding-left: 1.25rem; margin-bottom: 0.75rem; }
	:global(.tiptap-editor li) { margin-bottom: 0.25rem; }
	:global(.tiptap-editor .ProseMirror-focused) { outline: none; }
</style>
