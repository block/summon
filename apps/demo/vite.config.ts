import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const quickJsReleaseAsyncWasm = path.resolve(
  __dirname,
  '../../node_modules/@jitl/quickjs-wasmfile-release-asyncify/dist/emscripten-module.wasm',
);

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
