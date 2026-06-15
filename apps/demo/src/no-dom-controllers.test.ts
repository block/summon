import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';

const srcRoot = new URL('.', import.meta.url).pathname;
const artifactFiles = new Set([
  'adversarial-artifact.ts',
  'strict-demo-artifact.ts',
]);

const forbiddenPatterns = [
  { label: 'document.getElementById', pattern: /document\.getElementById\(/ },
  { label: 'document.querySelector', pattern: /document\.querySelector(All)?\(/ },
  { label: 'document.createElement', pattern: /document\.createElement\(/ },
  { label: 'innerHTML assignment', pattern: /\.innerHTML\s*=/ },
  { label: 'classList mutation', pattern: /\.classList\./ },
];

test('demo host pages stay React-state driven instead of DOM-controller driven', () => {
  const violations: string[] = [];
  for (const file of walk(srcRoot)) {
    const rel = relative(srcRoot, file);
    if (artifactFiles.has(rel) || rel.endsWith('.test.ts') || rel.endsWith('.test.tsx')) continue;
    const source = rel === 'main.tsx'
      ? readFileSync(file, 'utf8').replace("document.getElementById('root')", '')
      : readFileSync(file, 'utf8');
    for (const { label, pattern } of forbiddenPatterns) {
      if (pattern.test(source)) violations.push(`${rel}: ${label}`);
    }
  }

  assert.deepEqual(violations, []);
});

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...walk(path));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      files.push(path);
    }
  }
  return files;
}
