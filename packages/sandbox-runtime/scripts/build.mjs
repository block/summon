import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as esbuild } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const src = join(root, 'src');
const dist = join(root, 'dist');
const checkOnly = process.argv.includes('--check');

async function main() {
  const [bootstrapSource, tokensSource, arrowRuntimeSource] = await Promise.all([
    readFile(join(src, 'bootstrap.js'), 'utf8'),
    readFile(join(src, 'tokens.css'), 'utf8'),
    bundleArrowRuntime(),
  ]);

  if (checkOnly) {
    if (!bootstrapSource.trim()) throw new Error('bootstrap.js is empty');
    if (!tokensSource.trim()) throw new Error('tokens.css is empty');
    if (!arrowRuntimeSource.trim()) throw new Error('arrow runtime bundle is empty');
    return;
  }

  await mkdir(dist, { recursive: true });
  await Promise.all([
    writeFile(join(dist, 'bootstrap.js'), bootstrapSource),
    writeFile(join(dist, 'tokens.css'), tokensSource),
    writeFile(join(dist, 'arrow-runtime.js'), arrowRuntimeSource),
    writeFile(
      join(dist, 'assets.js'),
      [
        `export const bootstrapSource = ${JSON.stringify(bootstrapSource)};`,
        `export const tokensSource = ${JSON.stringify(tokensSource)};`,
        `export const arrowRuntimeSource = ${JSON.stringify(arrowRuntimeSource)};`,
        '//# sourceMappingURL=assets.js.map',
        '',
      ].join('\n'),
    ),
    writeFile(
      join(dist, 'assets.d.ts'),
      [
        'export declare const bootstrapSource: string;',
        'export declare const tokensSource: string;',
        'export declare const arrowRuntimeSource: string;',
        '//# sourceMappingURL=assets.d.ts.map',
        '',
      ].join('\n'),
    ),
    writeFile(
      join(dist, 'assets.js.map'),
      JSON.stringify({
        version: 3,
        file: 'assets.js',
        sources: ['../src/bootstrap.js', '../src/tokens.css', '../src/arrow-runtime-entry.ts'],
        sourcesContent: [bootstrapSource, tokensSource, arrowRuntimeSource],
        names: [],
        mappings: '',
      }),
    ),
    writeFile(
      join(dist, 'assets.d.ts.map'),
      JSON.stringify({
        version: 3,
        file: 'assets.d.ts',
        sources: ['../src/assets.ts'],
        sourcesContent: [
          "export const bootstrapSource = '';\nexport const tokensSource = '';\nexport const arrowRuntimeSource = '';\n",
        ],
        names: [],
        mappings: '',
      }),
    ),
  ]);
}

async function bundleArrowRuntime() {
  const wasmBinary = await readFile(
    join(
      root,
      '..',
      '..',
      'node_modules',
      '@jitl',
      'quickjs-wasmfile-release-asyncify',
      'dist',
      'emscripten-module.wasm',
    ),
  );
  const wasmBase64 = wasmBinary.toString('base64');
  const releaseAsyncifyModulePath = join(
    root,
    '..',
    '..',
    'node_modules',
    '@jitl',
    'quickjs-wasmfile-release-asyncify',
    'dist',
    'emscripten-module.browser.mjs',
  );

  const result = await esbuild({
    entryPoints: [join(src, 'arrow-runtime-entry.ts')],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: ['es2022'],
    sourcemap: false,
    logLevel: 'silent',
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    plugins: [inlineQuickJsWasmPlugin({
      wasmBase64,
      releaseAsyncifyModulePath,
    })],
  });

  const output = result.outputFiles[0]?.text;
  if (!output) throw new Error('Arrow runtime bundle did not produce output');
  return output;
}

function inlineQuickJsWasmPlugin({ wasmBase64, releaseAsyncifyModulePath }) {
  return {
    name: 'summon-inline-quickjs-wasm',
    setup(build) {
      build.onResolve(
        { filter: /^@jitl\/quickjs-wasmfile-release-asyncify\/emscripten-module$/ },
        () => ({ path: 'summon-inline-quickjs-release-asyncify', namespace: 'summon-quickjs' }),
      );
      build.onLoad(
        { filter: /^summon-inline-quickjs-release-asyncify$/, namespace: 'summon-quickjs' },
        () => ({
          loader: 'js',
          resolveDir: dirname(releaseAsyncifyModulePath),
          contents: [
            'import createModule from "./emscripten-module.browser.mjs";',
            `const wasmBase64 = ${JSON.stringify(wasmBase64)};`,
            'let wasmBinary;',
            'function decodeWasm() {',
            '  if (wasmBinary) return wasmBinary;',
            '  const binary = atob(wasmBase64);',
            '  const bytes = new Uint8Array(binary.length);',
            '  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);',
            '  wasmBinary = bytes;',
            '  return wasmBinary;',
            '}',
            'export default function createInlineQuickJsModule(moduleArg = {}) {',
            '  return createModule({',
            '    ...moduleArg,',
            '    wasmBinary: moduleArg.wasmBinary || decodeWasm(),',
            '    locateFile: moduleArg.locateFile || (() => "summon-inline-quickjs.wasm"),',
            '  });',
            '}',
            '',
          ].join('\n'),
        }),
      );
    },
  };
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
