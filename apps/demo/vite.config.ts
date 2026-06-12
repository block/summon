import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        // Multi-page app — every nav target needs to be a build input or
        // production won't ship its bundle. Dev mode picks them up implicitly.
        main: resolve(__dirname, 'index.html'),
        generate: resolve(__dirname, 'generate.html'),
        fragmentCompare: resolve(__dirname, 'fragment-compare.html'),
        adversarial: resolve(__dirname, 'adversarial.html'),
        batch: resolve(__dirname, 'batch.html'),
        strict: resolve(__dirname, 'strict.html'),
        fatal: resolve(__dirname, 'fatal.html'),
      },
    },
  },
});
