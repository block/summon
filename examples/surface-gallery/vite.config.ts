import { defineConfig } from 'vite';

const port = Number(process.env.SUMMON_GALLERY_PORT ?? 5174);

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
