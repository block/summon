import assert from 'node:assert/strict';
import {
  existsSync,
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

test('bundled public directions remain available as token fallbacks only', () => {
  const directions = loadDirections();

  assert.deepEqual(directions.map((direction) => direction.id), [
    'workbench',
    'pulse',
  ]);
  assert.equal(defaultDirectionId(directions), 'workbench');
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
    { path: 'README.md' },
    { path: 'docs' },
    { path: 'scripts' },
    { path: 'apps/demo/public', optional: true },
    { path: 'apps/demo/src' },
    { path: 'apps/server/src' },
    { path: 'apps/server/directions' },
    { path: 'packages' },
  ];
  return roots.flatMap((root) => {
    const absolutePath = join(repoRoot, root.path);
    if (!existsSync(absolutePath)) {
      if (root.optional) return [];
      throw new Error(`Expected public source root to exist: ${root.path}`);
    }
    return collectFiles(absolutePath);
  });
}

function collectFiles(path: string): string[] {
  const stat = statSync(path);
  if (stat.isFile()) {
    return [path];
  }
  if (!stat.isDirectory()) return [];
  const base = path.split('/').at(-1);
  if (base === 'node_modules' || base === 'dist' || base === '.eval') return [];
  return readdirSync(path)
    .sort()
    .flatMap((entry) => collectFiles(join(path, entry)));
}
