import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
	kit: {
		adapter: adapter()
	},

	vitePlugin: {
		inspector: {
			toggleKeyCombo: 'alt',
			showToggleButton: 'always',
			toggleButtonPos: 'bottom-right',
			openKey: 'alt',
			launchEditor: 'code'
		}
	},

	preprocess: [vitePreprocess()]
};

export default config;
