import { createReadStream } from 'node:fs';
import { createRequire } from 'node:module';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const require = createRequire(import.meta.url);
const quickJsReleaseAsyncWasm = require.resolve('@jitl/quickjs-wasmfile-release-asyncify/wasm');

export default defineConfig({
  assetsInclude: ['**/*.wasm'],
  plugins: [quickJsWasmDevServer(), react(), tailwindcss()],
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
