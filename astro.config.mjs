// @ts-check
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://manytool.net',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    // The AVIF encoder loads its .wasm via import.meta.url, which pre-bundling breaks.
    optimizeDeps: { exclude: ['@jsquash/avif'] },
    // Its multithreaded build also ships a worker that needs ES-module output.
    worker: { format: 'es' },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    }
  }
});
