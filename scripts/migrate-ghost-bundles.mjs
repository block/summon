#!/usr/bin/env node
/**
 * Migrate vendored Ghost fingerprint bundles from the graph-era model to the
 * flat-corpus + haunts model (ghost >= 0.19).
 *
 * Per bundle at apps/server/fingerprints/bundles/<id>/.ghost:
 *
 * 1. Nodes: strip the removed `relates:` frontmatter key. The edge intent is
 *    preserved as a single trailing prose line in the body
 *    (`Related: reinforces `a`, `b`; contrasts with `c`.`) so the corpus keeps
 *    the cross-reference for agent selection without any schema.
 * 2. Checks: move `.ghost/checks/*.md` -> `.ghost/haunts/checks/`, anchored by
 *    a `haunt.yml` (`ghost.haunt/v1`). Strip the removed `surface:` key and
 *    ensure `references: [index]` when the check declares none — the loader
 *    requires at least one reference, and `index` (the front door) is the
 *    faithful translation of `surface: core`. Checks whose references carry
 *    no `materials` route as "always offered" in `ghost review`.
 * 3. Gate: run `ghost validate --format json` (new CLI) per bundle and fail
 *    the script on any error-severity issue.
 *
 * Usage:
 *   node scripts/migrate-ghost-bundles.mjs [--dry-run] [--skip-validate]
 *   GHOST_BIN=/path/to/ghost/dist/bin.js node scripts/migrate-ghost-bundles.mjs
 *
 * Idempotent: a migrated bundle is a no-op on re-run.
 */

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';

const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_VALIDATE = process.argv.includes('--skip-validate');
const BUNDLES_DIR = resolve(
  import.meta.dirname,
  '../apps/server/fingerprints/bundles',
);
const GHOST_BIN = process.env.GHOST_BIN ?? null;
const HAUNT_MANIFEST = 'schema: ghost.haunt/v1\nid: checks\n';

/** Split a markdown file into { fmLines, body }. Returns null when there is no frontmatter. */
function splitFrontmatter(raw) {
  const lines = raw.split('\n');
  if (lines[0] !== '---') return null;
  const end = lines.indexOf('---', 1);
  if (end === -1) return null;
  return { fmLines: lines.slice(1, end), body: lines.slice(end + 1).join('\n') };
}

/**
 * Remove a top-level YAML key (and its indented continuation lines) from the
 * frontmatter, textually — so untouched lines stay byte-identical.
 * Returns { removed: string[] | null, kept: string[] }.
 */
function extractKey(fmLines, key) {
  const start = fmLines.findIndex((line) => line.startsWith(`${key}:`));
  if (start === -1) return { removed: null, kept: fmLines };
  let end = start + 1;
  while (end < fmLines.length && /^[ \t]/.test(fmLines[end])) end++;
  return {
    removed: fmLines.slice(start, end),
    kept: [...fmLines.slice(0, start), ...fmLines.slice(end)],
  };
}

/** Render the removed `relates:` block as one prose line, grouped by edge kind. */
function relatesToProse(relatesLines) {
  const parsed = parseYaml(relatesLines.join('\n'));
  const edges = parsed?.relates;
  if (!Array.isArray(edges) || edges.length === 0) return null;
  const groups = new Map();
  for (const edge of edges) {
    if (!edge?.to) continue;
    const kind = edge.as ?? 'relates to';
    if (!groups.has(kind)) groups.set(kind, []);
    groups.get(kind).push(`\`${edge.to}\``);
  }
  const clauses = [];
  for (const [kind, targets] of groups) {
    const verb = kind === 'contrasts' ? 'contrasts with' : kind;
    clauses.push(`${verb} ${targets.join(', ')}`);
  }
  return clauses.length > 0 ? `Related: ${clauses.join('; ')}.` : null;
}

function migrateNode(path, report) {
  const raw = readFileSync(path, 'utf-8');
  const split = splitFrontmatter(raw);
  if (!split) return;
  const { removed, kept } = extractKey(split.fmLines, 'relates');
  if (!removed) return;

  const prose = relatesToProse(removed);
  let body = split.body.replace(/\s+$/, '');
  if (prose && !body.includes('\nRelated: ')) body += `\n\n${prose}`;

  const next = `---\n${kept.join('\n')}\n---\n${body}\n`;
  report.push(`  node  ${path.slice(BUNDLES_DIR.length + 1)} — relates → prose`);
  if (!DRY_RUN) writeFileSync(path, next);
}

function migrateCheck(srcPath, destPath, report) {
  const raw = readFileSync(srcPath, 'utf-8');
  const split = splitFrontmatter(raw);
  let next = raw;
  if (split) {
    let { kept } = extractKey(split.fmLines, 'surface');
    // The loader requires >=1 reference; `index` is the faithful home for a
    // check that governed `core` (fingerprint-wide).
    if (!kept.some((line) => line.startsWith('references:'))) {
      kept = [...kept, 'references:', '  - index'];
    }
    next = `---\n${kept.join('\n')}\n---\n${split.body}`;
  }
  report.push(
    `  check ${srcPath.slice(BUNDLES_DIR.length + 1)} → ${destPath.slice(BUNDLES_DIR.length + 1)}`,
  );
  if (!DRY_RUN) writeFileSync(destPath, next);
}

function migrateBundle(bundleId, report) {
  const ghostDir = join(BUNDLES_DIR, bundleId, '.ghost');
  if (!existsSync(join(ghostDir, 'manifest.yml'))) {
    report.push(`  skip  no manifest.yml`);
    return;
  }

  // 1. Nodes: strip `relates`.
  for (const entry of readdirSync(ghostDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      migrateNode(join(ghostDir, entry.name), report);
    }
  }

  // 2. Checks already at .ghost/haunts/checks: repair in place (idempotent
  //    re-run after a partial migration — strip `surface:`, ensure references).
  const hauntChecks = join(ghostDir, 'haunts', 'checks');
  if (existsSync(hauntChecks)) {
    for (const name of readdirSync(hauntChecks)) {
      if (!name.endsWith('.md')) continue;
      const path = join(hauntChecks, name);
      const raw = readFileSync(path, 'utf-8');
      if (/^surface:/m.test(raw) || !/^references:/m.test(raw)) {
        migrateCheck(path, path, report);
      }
    }
  }

  // 3. Legacy checks: .ghost/checks -> .ghost/haunts/checks + haunt.yml.
  const legacyChecks = join(ghostDir, 'checks');
  if (existsSync(legacyChecks)) {
    const hauntDir = join(ghostDir, 'haunts', 'checks');
    if (!DRY_RUN) mkdirSync(hauntDir, { recursive: true });
    for (const name of readdirSync(legacyChecks)) {
      if (!name.endsWith('.md')) continue;
      migrateCheck(join(legacyChecks, name), join(hauntDir, name), report);
    }
    report.push(`  haunt ${bundleId}/.ghost/haunts/checks/haunt.yml`);
    if (!DRY_RUN) {
      writeFileSync(join(hauntDir, 'haunt.yml'), HAUNT_MANIFEST);
      for (const name of readdirSync(legacyChecks)) {
        unlinkSync(join(legacyChecks, name));
      }
      rmdirSync(legacyChecks);
    }
  }
}

function validateBundle(bundleId) {
  const bundleRoot = join(BUNDLES_DIR, bundleId);
  const out = execFileSync('node', [GHOST_BIN, 'validate', '--format', 'json'], {
    cwd: bundleRoot,
    encoding: 'utf-8',
  });
  return JSON.parse(out);
}

// --- main ---

const bundles = readdirSync(BUNDLES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

console.log(`${DRY_RUN ? '[dry-run] ' : ''}Migrating ${bundles.length} bundles in ${BUNDLES_DIR}\n`);

for (const bundleId of bundles) {
  const report = [];
  migrateBundle(bundleId, report);
  console.log(`${bundleId}${report.length === 0 ? ' — already migrated' : ''}`);
  for (const line of report) console.log(line);
}

if (DRY_RUN || SKIP_VALIDATE) process.exit(0);

if (!GHOST_BIN) {
  console.error('\nGHOST_BIN not set — skipping validate gate. Set it to the new ghost dist/bin.js to gate.');
  process.exit(1);
}

console.log('\n--- validate gate ---');
let failed = false;
for (const bundleId of bundles) {
  let result;
  try {
    result = validateBundle(bundleId);
  } catch (err) {
    // ghost validate exits 1 when it finds errors; stdout still carries the report.
    const stdout = err?.stdout;
    if (typeof stdout === 'string' && stdout.trim().startsWith('{')) {
      result = JSON.parse(stdout);
    } else {
      console.error(`${bundleId}: validate crashed: ${err.message}`);
      failed = true;
      continue;
    }
  }
  const errors = (result.issues ?? []).filter((issue) => issue.severity === 'error');
  const warnings = (result.issues ?? []).filter((issue) => issue.severity === 'warning');
  console.log(`${bundleId}: ${errors.length} errors, ${warnings.length} warnings`);
  for (const issue of [...errors, ...warnings]) {
    console.log(`  [${issue.severity}] ${issue.rule} ${issue.path}: ${issue.message}`);
  }
  if (errors.length > 0) failed = true;
}

process.exit(failed ? 1 : 0);
