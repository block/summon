import assert from 'node:assert/strict';
import {
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { defaultDirectionId, loadDirections } from './directions-loader.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');

test('bundled public directions load in Ghost-first order', () => {
  const directions = loadDirections();

  assert.deepEqual(directions.map((direction) => direction.id), [
    'ghost',
    'pulse',
    'workbench',
  ]);
  assert.equal(defaultDirectionId(directions), 'ghost');
});

test('public source has no bundled product-design references outside Ghost', () => {
  const bannedTerms = [
    ['Cash', ' App'].join(''),
    ['Cash', 'Sans'].join(''),
    ['Cash', ' Sans'].join(''),
    ['cdn', '.block', '.xyz'].join(''),
    ['Mar', 'ket'].join(''),
    ['S', 'quare'].join(''),
    ['@s', 'quareup'].join(''),
    ['Style', ' Dictionary'].join(''),
    ['ar', 'cade'].join(''),
  ];
  const findings: string[] = [];

  for (const file of publicSourceFiles()) {
    const text = readFileSync(file, 'utf-8');
    for (const term of bannedTerms) {
      if (text.includes(term)) {
        findings.push(`${relative(repoRoot, file)}: ${term}`);
      }
    }
  }

  assert.deepEqual(findings, []);
});

function publicSourceFiles(): string[] {
  const roots = [
    'README.md',
    'docs',
    'scripts',
    'apps/demo/public',
    'apps/demo/src',
    'apps/server/src',
    'apps/server/directions',
    'packages',
  ];
  return roots.flatMap((root) => collectFiles(join(repoRoot, root)));
}

function collectFiles(path: string): string[] {
  const stat = statSync(path);
  if (stat.isFile()) {
    if (path.endsWith('apps/server/directions/ghost/bucket.json')) return [];
    return [path];
  }
  if (!stat.isDirectory()) return [];
  const base = path.split('/').at(-1);
  if (base === 'node_modules' || base === 'dist' || base === '.eval') return [];
  return readdirSync(path)
    .sort()
    .flatMap((entry) => collectFiles(join(path, entry)));
}
