import { createReadStream } from 'node:fs';
import { createRequire } from 'node:module';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

const require = createRequire(import.meta.url);
const port = Number(process.env.SUMMON_GALLERY_PORT ?? 5174);
const apiTarget = process.env.SUMMON_GALLERY_API_TARGET ?? 'http://localhost:3001';
const quickJsReleaseAsyncWasm = require.resolve('@jitl/quickjs-wasmfile-release-asyncify/wasm');

export default defineConfig({
  assetsInclude: ['**/*.wasm'],
  plugins: [quickJsWasmDevServer(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port,
    strictPort: true,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
});

function quickJsWasmDevServer() {
  return {
    name: 'summon-quickjs-wasm-dev-server',
    apply: 'serve' as const,
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const pathname = req.url?.split('?', 1)[0];
        if (pathname !== '/node_modules/.vite/deps/emscripten-module.wasm') {
          next();
          return;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/wasm');
        res.setHeader('Cache-Control', 'no-cache');
        createReadStream(quickJsReleaseAsyncWasm).pipe(res);
      });
    },
  };
}
