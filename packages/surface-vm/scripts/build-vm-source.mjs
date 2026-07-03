#!/usr/bin/env node
// Builds the VM-side domjs runtime: strips types from src/engine/domjs/vm/*.ts
// (which are authored as TypeScript for hygiene but execute inside QuickJS) and
// embeds them as source strings in runtime-source.generated.ts.
//
// The generated file is committed so tests and consumers run from src without a
// build step. `--check` verifies it is not stale (wired into `pnpm test`).
//
// This is the stringify pattern the old hand-written runtime-source.ts header
// pointed at (unsupported runtime's sync-vm-sources.mjs).

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const vmDir = join(here, '../src/engine/domjs/vm');
const outFile = join(here, '../src/engine/domjs/runtime-source.generated.ts');
const checkOnly = process.argv.includes('--check');

const CORE_MODULE_ID = 'surface-vm:domjs-core';
const FACADE_MODULE_ID = 'surface-vm:domjs-facade';

async function compile(fileName, importRewrites) {
  const source = await readFile(join(vmDir, fileName), 'utf8');
  const { code } = await transform(source, {
    loader: 'ts',
    target: 'es2022',
    format: 'esm',
  });
  let out = code;
  for (const [from, to] of Object.entries(importRewrites)) {
    out = out.replaceAll(`from "${from}"`, `from ${JSON.stringify(to)}`).replaceAll(`from '${from}'`, `from ${JSON.stringify(to)}`);
  }
  return out.trim() + '\n';
}

const core = await compile('core.ts', {});
const facade = await compile('facade.ts', { './core.js': CORE_MODULE_ID });

const generated = `// GENERATED FILE — do not edit by hand.
// Source of truth: src/engine/domjs/vm/{core,facade}.ts
// Regenerate: node scripts/build-vm-source.mjs   (checked by \`pnpm test\`)

export const DOMJS_CORE_MODULE_ID = ${JSON.stringify(CORE_MODULE_ID)};
export const DOMJS_FACADE_MODULE_ID = ${JSON.stringify(FACADE_MODULE_ID)};

export const DOMJS_CORE_SOURCE = ${JSON.stringify(core)};

export const DOMJS_FACADE_SOURCE = ${JSON.stringify(facade)};
`;

if (checkOnly) {
  const current = await readFile(outFile, 'utf8').catch(() => '');
  if (current !== generated) {
    console.error('[build-vm-source] runtime-source.generated.ts is stale. Run: node scripts/build-vm-source.mjs');
    process.exit(1);
  }
  console.log('[build-vm-source] up to date');
} else {
  await writeFile(outFile, generated);
  console.log(`[build-vm-source] wrote ${outFile} (core ${core.length}b, facade ${facade.length}b)`);
}
