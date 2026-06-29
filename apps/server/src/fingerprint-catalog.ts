import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GhostBaseDirection, GhostTokenSource } from './ghost-adapter.js';

const ID_RE = /^[a-z][a-z0-9._-]{0,63}$/;
const CATALOG_SCHEMA = 'summon.fingerprint-catalog/v1';
const BUNDLE_SCHEMA = 'summon.fingerprint-bundle/v1';
const GHOST_MARKETPLACE_BUNDLE_SCHEMA = 'ghost.marketplace-bundle/v1';

export interface FingerprintCatalogEntry {
  id: string;
  name: string;
  summary: string;
  status: 'draft' | 'review' | 'published' | 'deprecated';
  version: string;
  tags: string[];
  previewColors: string[];
  root: string;
  fingerprintDir: string;
  ghostDir: string;
  tokenCssPath: string | null;
  defaultTargetPath: string;
  defaultTokenFallback: string | null;
}

export interface PublicFingerprintInfo {
  id: string;
  name: string;
  summary: string;
  status: string;
  version: string;
  tags: string[];
  previewColors: string[];
  defaultTargetPath: string;
  defaultTokenFallback: string | null;
}

export interface FingerprintRequest {
  id: string;
  targetPath: string;
  baseDirectionId: string | null;
}

export type ParseFingerprintRequestResult =
  | { ok: true; request: FingerprintRequest | null }
  | { ok: false; error: string };

export interface FingerprintCatalog {
  root: string;
  entries: FingerprintCatalogEntry[];
  byId: Map<string, FingerprintCatalogEntry>;
}

interface RawCatalogEntry {
  id: string;
  path: string;
  enabled?: boolean;
  defaultTargetPath?: string;
  defaultTokenFallback?: string | null;
}

export function defaultFingerprintCatalogRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', 'fingerprints');
}

export function loadFingerprintCatalog(root = defaultFingerprintCatalogRoot()): FingerprintCatalog {
  const catalogPath = resolve(root, 'catalog.json');
  if (!existsSync(catalogPath)) return emptyCatalog(root);
  const raw = readJson(catalogPath);
  if (!isRecord(raw) || raw.schema !== CATALOG_SCHEMA || !Array.isArray(raw.bundles)) {
    throw new Error(`Invalid fingerprint catalog at ${catalogPath}`);
  }

  const entries: FingerprintCatalogEntry[] = [];
  const seen = new Set<string>();
  for (const item of raw.bundles) {
    if (!isRawCatalogEntry(item)) {
      throw new Error(`Invalid fingerprint catalog entry in ${catalogPath}`);
    }
    if (item.enabled === false) continue;
    if (seen.has(item.id)) throw new Error(`Duplicate fingerprint id "${item.id}"`);
    seen.add(item.id);
    entries.push(loadBundle(root, item));
  }
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  return { root: resolve(root), entries, byId };
}

export function publicFingerprints(catalog: FingerprintCatalog): PublicFingerprintInfo[] {
  return catalog.entries
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      summary: entry.summary,
      status: entry.status,
      version: entry.version,
      tags: [...entry.tags],
      previewColors: [...entry.previewColors],
      defaultTargetPath: entry.defaultTargetPath,
      defaultTokenFallback: entry.defaultTokenFallback,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function parseFingerprintRequest(
  raw: unknown,
  catalog: FingerprintCatalog,
): ParseFingerprintRequestResult {
  if (raw === undefined || raw === null || raw === '') return { ok: true, request: null };
  if (!isRecord(raw)) return { ok: false, error: 'fingerprint must be an object' };
  const id = raw.id;
  if (typeof id !== 'string' || !ID_RE.test(id)) {
    return { ok: false, error: 'fingerprint.id must be a configured fingerprint id' };
  }
  if (!catalog.byId.has(id)) {
    return { ok: false, error: `unknown fingerprint "${id}"` };
  }
  const target = normalizeTargetPath(raw.targetPath, 'fingerprint.targetPath');
  if (!target.ok) return { ok: false, error: target.error };
  const base = parseBaseDirectionId(raw.baseDirectionId, 'fingerprint.baseDirectionId');
  if (!base.ok) return { ok: false, error: base.error };
  return {
    ok: true,
    request: {
      id,
      targetPath: target.path,
      baseDirectionId: base.value,
    },
  };
}

export function resolveCatalogTokenSource(
  entry: FingerprintCatalogEntry,
  baseDirection: GhostBaseDirection | null,
): GhostTokenSource {
  const warnings: string[] = [];
  if (entry.tokenCssPath) {
    const css = readFileSync(entry.tokenCssPath, 'utf-8');
    return {
      kind: 'fingerprint-catalog',
      source: displayPath(entry.root, entry.tokenCssPath),
      css,
      baseDirectionId: baseDirection?.id ?? null,
      warnings,
    };
  }
  if (baseDirection) {
    warnings.push(
      `Ignoring requested fallback direction "${baseDirection.id}" because Summon generation is Ghost-fingerprint-only.`,
    );
  }
  throw new Error([
    `Catalog fingerprint "${entry.id}" token CSS is required for Summon generation.`,
    'No catalog fingerprint token/style CSS was found.',
    ...warnings,
  ].join(' '));
}

function emptyCatalog(root: string): FingerprintCatalog {
  return { root: resolve(root), entries: [], byId: new Map() };
}

function loadBundle(catalogRoot: string, item: RawCatalogEntry): FingerprintCatalogEntry {
  const bundleRoot = safeResolve(catalogRoot, item.path, `fingerprint catalog path for ${item.id}`);
  const metaPath = existsSync(join(bundleRoot, 'bundle.json'))
    ? join(bundleRoot, 'bundle.json')
    : join(bundleRoot, 'marketplace.json');
  if (!existsSync(metaPath)) throw new Error(`Fingerprint bundle ${item.id} is missing bundle.json`);
  const meta = readJson(metaPath);
  if (!isRecord(meta)) throw new Error(`Fingerprint bundle ${item.id} metadata must be an object`);
  if (meta.schema !== BUNDLE_SCHEMA && meta.schema !== GHOST_MARKETPLACE_BUNDLE_SCHEMA) {
    throw new Error(`Fingerprint bundle ${item.id} has unsupported schema`);
  }
  if (meta.id !== item.id) throw new Error(`Fingerprint bundle id mismatch: ${item.id}`);
  const fingerprintRef = typeof meta.fingerprint === 'string' ? meta.fingerprint : 'fingerprint';
  const fingerprintDir = safeResolve(bundleRoot, fingerprintRef, `fingerprint directory for ${item.id}`);
  for (const file of ['manifest.yml', 'prose.yml', 'inventory.yml', 'composition.yml']) {
    const full = join(fingerprintDir, file);
    if (!existsSync(full) || !statSync(full).isFile()) {
      throw new Error(`Fingerprint bundle ${item.id} is missing fingerprint/${file}`);
    }
  }
  const target = normalizeTargetPath(item.defaultTargetPath, `defaultTargetPath for ${item.id}`);
  if (!target.ok) throw new Error(target.error);
  const fallback = parseBaseDirectionId(item.defaultTokenFallback, `defaultTokenFallback for ${item.id}`);
  if (!fallback.ok) throw new Error(fallback.error);
  const tokenCssPath = typeof meta.tokens === 'string' && meta.tokens.trim()
    ? safeResolve(bundleRoot, meta.tokens, `token CSS for ${item.id}`)
    : null;
  if (tokenCssPath && (!existsSync(tokenCssPath) || !statSync(tokenCssPath).isFile())) {
    throw new Error(`Fingerprint bundle ${item.id} token CSS not found`);
  }
  const previewColors = tokenCssPath
    ? extractPreviewColors(readFileSync(tokenCssPath, 'utf-8'))
    : [];
  return {
    id: item.id,
    name: stringField(meta.name, item.id),
    summary: stringField(meta.summary, ''),
    status: statusField(meta.status),
    version: stringField(meta.version, '0.0.0'),
    tags: Array.isArray(meta.tags) ? meta.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    previewColors,
    root: bundleRoot,
    fingerprintDir,
    ghostDir: join(bundleRoot, '.ghost'),
    tokenCssPath,
    defaultTargetPath: target.path,
    defaultTokenFallback: fallback.value,
  };
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf-8')) as unknown;
}

function isRawCatalogEntry(value: unknown): value is RawCatalogEntry {
  return isRecord(value) &&
    typeof value.id === 'string' && ID_RE.test(value.id) &&
    typeof value.path === 'string' && value.path.trim().length > 0 &&
    (value.enabled === undefined || typeof value.enabled === 'boolean') &&
    (value.defaultTargetPath === undefined || typeof value.defaultTargetPath === 'string') &&
    (value.defaultTokenFallback === undefined || value.defaultTokenFallback === null || typeof value.defaultTokenFallback === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function safeResolve(root: string, rawRef: string, label: string): string {
  const normalized = rawRef.trim().replaceAll('\\', '/').replace(/\/+/g, '/').replace(/^\.\//, '');
  if (!normalized || normalized.startsWith('/') || isAbsolute(normalized) || /^[A-Za-z]:/.test(normalized)) {
    throw new Error(`${label} must be a safe relative path`);
  }
  const segments = normalized.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new Error(`${label} must not contain path traversal segments`);
  }
  const resolved = resolve(root, normalized);
  if (!isWithinOrEqual(root, resolved)) {
    throw new Error(`${label} must stay within the fingerprint catalog`);
  }
  return resolved;
}

function normalizeTargetPath(raw: unknown, label: string):
  | { ok: true; path: string }
  | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === '') return { ok: true, path: '.' };
  if (typeof raw !== 'string') return { ok: false, error: `${label} must be a string` };
  const value = raw.trim().replaceAll('\\', '/').replace(/\/+/g, '/');
  if (value === '.' || value === '') return { ok: true, path: '.' };
  if (value.startsWith('/') || isAbsolute(value) || /^[A-Za-z]:/.test(value)) {
    return { ok: false, error: `${label} must be relative` };
  }
  const segments = value.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    return { ok: false, error: `${label} must not contain path traversal segments` };
  }
  return { ok: true, path: segments.join('/') };
}

function parseBaseDirectionId(raw: unknown, label: string):
  | { ok: true; value: string | null }
  | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === '') return { ok: true, value: null };
  if (typeof raw !== 'string' || !ID_RE.test(raw)) {
    return { ok: false, error: `${label} must be a valid direction id` };
  }
  return { ok: true, value: raw };
}

function stringField(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function statusField(value: unknown): FingerprintCatalogEntry['status'] {
  return value === 'draft' || value === 'review' || value === 'published' || value === 'deprecated'
    ? value
    : 'draft';
}

function isWithinOrEqual(root: string, child: string): boolean {
  const rel = relative(resolve(root), resolve(child));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function displayPath(root: string, absPath: string): string {
  const rel = relative(root, absPath);
  return rel && !rel.startsWith('..') && !isAbsolute(rel) ? rel : absPath;
}

const PREVIEW_COLOR_TOKENS = [
  '--color-bg',
  '--color-surface',
  '--color-surface-muted',
  '--color-canvas',
  '--color-command',
  '--color-surface-dark',
  '--color-surface-light',
  '--color-accent',
  '--color-accent-2',
  '--color-accent-hot',
  '--color-accent-warm',
  '--color-accent-yellow',
  '--color-text',
  '--color-border-strong',
];

function extractPreviewColors(css: string): string[] {
  const declarations = new Map<string, string>();
  const colorRe = /(--color-[a-z0-9-]+)\s*:\s*(#[0-9a-f]{3,8}|rgba?\([^)]+\))\s*;/gi;
  for (const match of css.matchAll(colorRe)) {
    const token = match[1]?.toLowerCase();
    const value = match[2]?.trim();
    if (token && value) declarations.set(token, value);
  }

  const colors: string[] = [];
  const seen = new Set<string>();
  const addColor = (value: string | undefined) => {
    if (!value) return;
    const normalized = value.replace(/\s+/g, '').toLowerCase();
    if (seen.has(normalized)) return;
    seen.add(normalized);
    colors.push(value);
  };

  for (const token of PREVIEW_COLOR_TOKENS) {
    addColor(declarations.get(token));
    if (colors.length >= 5) return colors;
  }
  for (const value of declarations.values()) {
    addColor(value);
    if (colors.length >= 5) return colors;
  }
  return colors;
}
