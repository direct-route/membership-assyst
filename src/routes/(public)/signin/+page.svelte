<script>
	import { enhance } from '$app/forms';
	let { form } = $props();
	let loading = $state(false);
</script>

<div class="min-h-screen bg-slate-50 flex items-center justify-center px-4">
	<div class="w-full max-w-md">
		<!-- Logo / Brand -->
		<div class="text-center mb-8">
			<div class="inline-flex items-center gap-1 mb-2">
				<span class="nunito-sans-700 text-3xl text-[#0f1a3d] tracking-tight">MEMBERSHIP</span>
			</div>
			<div class="inline-block bg-[#c0392b] px-3 py-1 rounded">
				<span class="nunito-sans-700 text-2xl text-white tracking-wide">ASSYST</span>
			</div>
			<p class="text-sm text-slate-500 mt-3">Sign in to your account</p>
		</div>

		<!-- Card -->
		<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
			<div class="h-1 bg-gradient-to-r from-blue-800 via-blue-600 to-purple-500"></div>
			<div class="p-8">
				{#if form?.error}
					<div class="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
						{form.error}
					</div>
				{/if}

				<form method="POST" use:enhance={() => {
					loading = true;
					return async ({ update }) => { await update(); loading = false; };
				}}>
					<div class="space-y-4">
						<div>
							<label class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5" for="email">Email Address</label>
							<input id="email" name="email" type="email" required autocomplete="email"
								class="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 focus:border-[#1e3a8a] transition-colors" />
						</div>
						<div>
							<label class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5" for="password">Password</label>
							<input id="password" name="password" type="password" required autocomplete="current-password"
								class="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 focus:border-[#1e3a8a] transition-colors" />
						</div>
						<button type="submit" disabled={loading}
							class="w-full h-10 rounded-lg bg-[#1e3a8a] hover:bg-[#1e40af] text-white text-sm font-semibold transition-colors disabled:opacity-60 mt-2">
							{loading ? 'Signing in…' : 'Sign In'}
						</button>
					</div>
				</form>
			</div>
		</div>

		<p class="text-center text-xs text-slate-400 mt-6">
			Direct Route Collections Limited &copy; {new Date().getFullYear()}
		</p>
	</div>
</div>
