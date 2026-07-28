<script>
	import { page } from '$app/stores';

	let { data, children } = $props();
	let user = $derived(data.user);
	let role = $derived(data.role);

	const adminNav = [
		{ href: '/applications', label: 'Applications' },
		{ href: '/licensees', label: 'Licensees' },
		{ href: '/membership-types', label: 'Membership Types' },
	];

	const licenseeNav = [
		{ href: '/applications', label: 'My Applications' },
		{ href: '/new', label: 'Invite New Customer' },
	];

	let nav = $derived(role === 'admin' ? adminNav : licenseeNav);
</script>

<div class="min-h-screen bg-slate-50 flex flex-col">
	<!-- Top brand bar -->
	<header class="bg-[#0f1a3d] shadow-sm">
		<div class="h-1 bg-gradient-to-r from-blue-800 via-blue-600 to-purple-500"></div>
		<div class="px-6 py-3 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<div class="flex items-baseline gap-1">
					<span class="nunito-sans-700 text-lg text-white tracking-tight">MEMBERSHIP</span>
					<span class="nunito-sans-700 text-lg bg-[#c0392b] text-white px-2 py-0.5 rounded tracking-wide">ASSYST</span>
				</div>
			</div>
			<nav class="hidden md:flex items-center gap-1">
				{#each nav as item}
					<a href={item.href}
						class="px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors {$page.url.pathname.startsWith(item.href) ? 'bg-white/15 text-white' : 'text-blue-200/70 hover:text-white hover:bg-white/10'}">
						{item.label}
					</a>
				{/each}
			</nav>
			<div class="flex items-center gap-3">
				<span class="text-[11px] text-blue-200/60 hidden md:block">
					{user?.name || user?.email} &middot; <span class="capitalize">{role}</span>
				</span>
				<a href="/signout" data-sveltekit-reload class="text-[11px] font-semibold text-blue-200/70 hover:text-white transition-colors">Sign out</a>
			</div>
		</div>
	</header>

	<!-- Sub-nav tabs for mobile -->
	<div class="md:hidden bg-[#1e3a8a] px-4">
		<div class="flex gap-1 overflow-x-auto py-1">
			{#each nav as item}
				<a href={item.href}
					class="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors {$page.url.pathname.startsWith(item.href) ? 'bg-white/20 text-white' : 'text-blue-200/70 hover:text-white'}">
					{item.label}
				</a>
			{/each}
		</div>
	</div>

	<main class="flex-1 px-4 md:px-6 py-6">
		{@render children()}
	</main>

	<footer class="px-6 py-4 border-t border-slate-200 bg-white">
		<p class="text-xs text-slate-400 text-center">Direct Route Collections Limited &copy; {new Date().getFullYear()} &middot; Membership Assyst</p>
	</footer>
</div>
