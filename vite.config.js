import tailwindcss from '@tailwindcss/vite';
import { enhancedImages } from '@sveltejs/enhanced-img';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		enhancedImages(), // must come before the SvelteKit plugin,
		tailwindcss(),
		sveltekit()
	],
	server: {
		host: '0.0.0.0', // Listen on all network interfaces
		port: 5173, // Default Vite port (you can change this)
		strictPort: false // Allow fallback to other ports if 5173 is taken
	}
});
