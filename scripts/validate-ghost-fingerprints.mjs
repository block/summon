#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const BUNDLES_DIR = resolve(import.meta.dirname, '../apps/server/fingerprints/bundles');
const VENDORED_GHOST_BIN = resolve(
  import.meta.dirname,
  '../node_modules/@design-intelligence/ghost/dist/bin.js',
);
const GHOST_BIN_OVERRIDE =
  process.env.GHOST_BIN?.trim() ||
  (existsSync(VENDORED_GHOST_BIN) ? VENDORED_GHOST_BIN : '');
const GHOST_COMMAND = GHOST_BIN_OVERRIDE.endsWith('.js') ? process.execPath : GHOST_BIN_OVERRIDE || 'ghost';
const GHOST_ARGS_PREFIX = GHOST_BIN_OVERRIDE.endsWith('.js') ? [GHOST_BIN_OVERRIDE] : [];
const GHOST_LABEL = GHOST_BIN_OVERRIDE || 'ghost';
const CHECKS_DIR = 'checks';

function listGhostDirs() {
  return readdirSync(BUNDLES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ id: entry.name, path: join(BUNDLES_DIR, entry.name, '.ghost') }))
    .filter((entry) => existsSync(entry.path))
    .sort((a, b) => a.id.localeCompare(b.id));
}

async function runGhostValidate(ghostPath) {
  const args = [...GHOST_ARGS_PREFIX, 'validate', ghostPath, '--format', 'json'];
  try {
    const { stdout } = await execFileAsync(GHOST_COMMAND, args, {
      cwd: resolve(import.meta.dirname, '..'),
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });
    return parseReport(stdout, ghostPath);
  } catch (error) {
    const stdout = typeof error.stdout === 'string' ? error.stdout : '';
    if (stdout.trim()) return parseReport(stdout, ghostPath);
    throw error;
  }
}

function parseReport(stdout, ghostPath) {
  const text = stdout.trim();
  if (!text) {
    throw new Error(
      `ghost validate produced no JSON for ${ghostPath}; installed ghost may not support \`validate <path> --format json\``,
    );
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`ghost validate returned non-JSON for ${ghostPath}: ${error.message}`);
  }
}

function issuesFrom(report) {
  if (Array.isArray(report?.issues)) return report.issues;
  if (Array.isArray(report?.results)) return report.results.flatMap((result) => result.issues ?? []);
  if (Array.isArray(report?.diagnostics)) return report.diagnostics;
  return [];
}

function severityOf(issue) {
  return String(issue?.severity ?? issue?.level ?? '').toLowerCase();
}

function formatIssue(issue) {
  const severity = severityOf(issue) || 'issue';
  const rule = issue?.rule ?? issue?.code ?? issue?.name ?? 'unknown-rule';
  const path = issue?.path ?? issue?.file ?? issue?.source ?? '';
  const message = issue?.message ?? issue?.detail ?? JSON.stringify(issue);
  return `  [${severity}] ${rule}${path ? ` ${path}` : ''}: ${message}`;
}

function hygieneWarnings(ghostPath) {
  const warnings = [];

  const glossaryPath = join(ghostPath, 'glossary.md');
  if (!existsSync(glossaryPath)) warnings.push('missing .ghost/glossary.md');

  const gitignorePath = join(ghostPath, '.gitignore');
  if (!existsSync(gitignorePath)) {
    warnings.push('missing .ghost/.gitignore');
  } else {
    const ignored = new Set(
      readFileSync(gitignorePath, 'utf-8')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    );
    for (const required of ['.events', '.pulls']) {
      if (!ignored.has(required)) warnings.push(`.ghost/.gitignore does not ignore ${required}`);
    }
  }

  if (existsSync(join(ghostPath, 'haunts'))) {
    warnings.push('legacy .ghost/haunts directory present; checks now live in flat .ghost/checks');
  }

  const checksPath = join(ghostPath, CHECKS_DIR);
  if (!existsSync(checksPath)) {
    warnings.push('missing .ghost/checks');
    return warnings;
  }

  const checkFiles = readdirSync(checksPath).filter((name) => name.endsWith('.md')).sort();
  if (checkFiles.length === 0) warnings.push('no check markdown files in .ghost/checks');

  if (checkFiles.length > 0 && checkFiles.every((name) => isIndexOnlyCheck(join(checksPath, name)))) {
    warnings.push('all checks reference only index; add specific node ids where possible');
  }

  return warnings;
}

function isIndexOnlyCheck(path) {
  const raw = readFileSync(path, 'utf-8');
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return false;
  const refs = [];
  const lines = match[1].split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() !== 'references:') continue;
    for (let j = i + 1; j < lines.length && /^\s+-\s+/.test(lines[j]); j += 1) {
      refs.push(lines[j].replace(/^\s+-\s+/, '').trim().replace(/^['"]|['"]$/g, ''));
    }
    break;
  }
  return refs.length === 1 && refs[0] === 'index';
}

const ghostDirs = listGhostDirs();
if (ghostDirs.length === 0) {
  console.error(`No Ghost fingerprint bundles found in ${BUNDLES_DIR}`);
  process.exit(1);
}

console.log(`Validating ${ghostDirs.length} Ghost fingerprint bundles with ${GHOST_LABEL}`);

let failed = false;
for (const bundle of ghostDirs) {
  let report;
  try {
    report = await runGhostValidate(bundle.path);
  } catch (error) {
    console.error(`\n${bundle.id}: ghost validate failed to run: ${error.message}`);
    failed = true;
    continue;
  }

  const issues = issuesFrom(report);
  const errors = issues.filter((issue) => severityOf(issue) === 'error');
  const warnings = issues.filter((issue) => ['warning', 'warn'].includes(severityOf(issue)));
  const hygiene = hygieneWarnings(bundle.path);

  console.log(`\n${bundle.id}: ${errors.length} errors, ${warnings.length} warnings`);
  for (const issue of errors) console.log(formatIssue(issue));
  for (const issue of warnings) console.log(formatIssue(issue));
  for (const warning of hygiene) console.log(`  [hygiene] ${warning}`);

  if (errors.length > 0) failed = true;
}

process.exit(failed ? 1 : 0);
