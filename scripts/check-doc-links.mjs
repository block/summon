#!/usr/bin/env node
import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const docsRoot = join(root, 'docs');
const files = await markdownFiles(docsRoot);
const failures = [];

for (const file of files) {
  const text = await readFile(file, 'utf8');
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const raw = match[1].trim();
    const target = raw.split('#')[0].trim();
    if (!target || shouldIgnore(target)) continue;
    const resolved = normalize(resolve(dirname(file), target));
    if (!resolved.startsWith(root)) {
      failures.push(`${relative(file)} -> ${raw} escapes repository`);
      continue;
    }
    try {
      await stat(resolved);
    } catch {
      failures.push(`${relative(file)} -> ${raw} missing`);
    }
  }
}

if (failures.length > 0) {
  console.error('[check-doc-links] broken Markdown links:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`[check-doc-links] ok (${files.length} Markdown files)`);

async function markdownFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await markdownFiles(path));
    else if (entry.isFile() && extname(entry.name) === '.md') out.push(path);
  }
  return out.sort();
}

function shouldIgnore(target) {
  return /^(https?:|mailto:|#)/i.test(target);
}

function relative(path) {
  return path.slice(root.length + 1);
}
