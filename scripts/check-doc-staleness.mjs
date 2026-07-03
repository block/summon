#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const docsRoot = join(root, 'docs');

const deny = [
  { pattern: /domjs as the sole capability-isolated runtime/i, message: 'Superseded by Surface Document successor direction.' },
  { pattern: /Decision pending: converge on one capability-isolated runtime/i, message: 'The live direction is Surface Document successor candidate.' },
  { pattern: /experimentalRuntime.*no longer exists/i, message: 'False: experimentalRuntime still exists while Surface Document bakes.' },
];

const allowedDirs = [];

const files = await markdownFiles(docsRoot);
const failures = [];
for (const file of files) {
  const rel = relative(file);
  if (allowedDirs.some((prefix) => rel.startsWith(prefix))) continue;
  const text = await readFile(file, 'utf8');
  const lines = text.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    for (const rule of deny) {
      if (rule.pattern.test(line)) {
        failures.push(`${rel}:${index + 1}: ${rule.message}\n  ${line.trim()}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error('[check-doc-staleness] stale live-doc language found:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`[check-doc-staleness] ok (${files.length} Markdown files scanned)`);

async function markdownFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await markdownFiles(path));
    else if (entry.isFile() && extname(entry.name) === '.md') out.push(path);
  }
  return out.sort();
}

function relative(path) {
  return path.slice(root.length + 1);
}
