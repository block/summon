import { compileTokenContract, type ProtocolLine } from '@anarchitecture/summon/engine';
import type { GhostGenerationContext } from '@anarchitecture/summon-server';
import { existsSync, readFileSync, statSync } from 'node:fs';
import {
  dirname,
  isAbsolute,
  relative,
  resolve,
} from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  normalizeGhostMemoryDir,
  readGhostPackageConfig,
  resolveGhostRootCompat,
  type GhostStackCompat,
  type GhostStackLayerCompat,
  type GhostContextCompat,
} from './ghost-scan-compat.js';

const ROOT_ID_RE = /^[a-z][a-z0-9._-]{0,63}$/;

const DEFAULT_TOKENS_CSS = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    '..',
    'packages',
    'sandbox-runtime',
    'src',
    'tokens.css',
  ),
  'utf-8',
);

export interface GhostRootRequest {
  source: 'root';
  rootId: string;
  targetPath: string;
  memoryDir: string;
  baseDirectionId: string | null;
}

export interface GhostResolvedContextRequest {
  source: 'resolved-context';
  id?: string;
  product?: string;
  prompt: string;
  tokensCss?: string;
  tokenSource?: string;
  provenance?: unknown;
  baseDirectionId: string | null;
}

export type GhostRequest = GhostRootRequest | GhostResolvedContextRequest;

export interface GhostRoot {
  id: string;
  root: string;
}

export type GhostRoots = Map<string, string>;

export interface GhostTokenSource {
  kind: 'ghost-config' | 'resolved-context' | 'base-direction' | 'summon-default';
  source: string;
  css: string;
  warnings: string[];
  baseDirectionId?: string | null;
}

export interface GhostBaseDirection {
  id: string;
  tokensCss: string;
}

export interface ResolvedRootGhostSteer extends GhostGenerationContext {
  source: 'root';
  request: GhostRootRequest;
  root: string;
  stack: GhostStackCompat;
  context: GhostContextCompat;
  prompt: string;
  tokenSource: GhostTokenSource;
  baseDirectionId: string | null;
  product: string;
}

export interface ResolvedContextGhostSteer extends GhostGenerationContext {
  source: 'resolved-context';
  request: GhostResolvedContextRequest;
  root: null;
  stack: null;
  context: null;
  prompt: string;
  tokenSource: GhostTokenSource;
  baseDirectionId: string | null;
  product?: string;
  provenance?: unknown;
}

export type ResolvedGhostSteer = ResolvedRootGhostSteer | ResolvedContextGhostSteer;

export type ResolvedGhostContext = ResolvedGhostSteer;

export interface GhostReviewPacket {
  schema: 'summon.ghost-generation/v1';
  source: ResolvedGhostSteer['source'];
  prompt: string;
  rootId: string | null;
  targetPath: string | null;
  memoryDir: string | null;
  product: string;
  layers: string[];
  memoryProvenance: {
    merge: GhostStackCompat['provenance']['merge'] | 'external';
    layers: Array<{
      relativeRoot: string;
      memoryDir: string;
    }>;
    provenance?: unknown;
  };
  tokenSource: Omit<GhostTokenSource, 'css'>;
  baseDirectionId: string | null;
  styleSource: GhostTokenSource['kind'];
  mode: 'static' | 'interactive';
  layoutId: string | null;
  validation: {
    blocked: number;
    warnings: number;
    codes: Record<string, number>;
  };
  declaredSections: string[];
  sections: Array<{ id: string; html: string }>;
}

export type ParseGhostRequestResult =
  | { ok: true; request: GhostRequest | null }
  | { ok: false; error: string };

export function parseGhostRoots(raw: string | undefined): GhostRoots {
  const roots: GhostRoots = new Map();
  if (!raw?.trim()) return roots;

  for (const entry of raw.split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) {
      throw new Error(`Invalid SUMMON_GHOST_ROOTS entry "${trimmed}"`);
    }
    const id = trimmed.slice(0, eq).trim();
    const root = trimmed.slice(eq + 1).trim();
    if (!ROOT_ID_RE.test(id)) {
      throw new Error(`Invalid Ghost root id "${id}"`);
    }
    if (!isAbsolute(root)) {
      throw new Error(`Ghost root "${id}" must be absolute`);
    }
    roots.set(id, resolve(root));
  }
  return roots;
}

export function publicGhostRoots(roots: GhostRoots): GhostRoot[] {
  return [...roots.entries()]
    .map(([id, root]) => ({ id, root }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function parseGhostRequest(
  raw: unknown,
  roots: GhostRoots,
): ParseGhostRequestResult {
  if (raw === undefined || raw === null) return { ok: true, request: null };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'ghost must be an object' };
  }

  const obj = raw as Record<string, unknown>;
  const source = obj.source === undefined || obj.source === null || obj.source === ''
    ? 'root'
    : obj.source;
  if (source !== 'root' && source !== 'resolved-context') {
    return { ok: false, error: 'ghost.source must be "root" or "resolved-context"' };
  }

  const baseDirectionId = parseBaseDirectionId(obj.baseDirectionId);
  if (!baseDirectionId.ok) return { ok: false, error: baseDirectionId.error };

  if (source === 'resolved-context') {
    const prompt = typeof obj.prompt === 'string' ? obj.prompt.trim() : '';
    if (!prompt) {
      return { ok: false, error: 'ghost.prompt is required for resolved-context' };
    }
    const request: GhostResolvedContextRequest = {
      source: 'resolved-context',
      prompt,
      baseDirectionId: baseDirectionId.value,
    };
    if (obj.id !== undefined && (typeof obj.id !== 'string' || !obj.id.trim())) {
      return { ok: false, error: 'ghost.id must be a non-empty string when provided' };
    }
    if (typeof obj.id === 'string') request.id = obj.id.trim();
    if (obj.product !== undefined && (typeof obj.product !== 'string' || !obj.product.trim())) {
      return { ok: false, error: 'ghost.product must be a non-empty string when provided' };
    }
    if (typeof obj.product === 'string') request.product = obj.product.trim();
    if (obj.tokensCss !== undefined && typeof obj.tokensCss !== 'string') {
      return { ok: false, error: 'ghost.tokensCss must be a string when provided' };
    }
    if (typeof obj.tokensCss === 'string' && obj.tokensCss.trim()) request.tokensCss = obj.tokensCss;
    if (obj.tokenSource !== undefined && (typeof obj.tokenSource !== 'string' || !obj.tokenSource.trim())) {
      return { ok: false, error: 'ghost.tokenSource must be a non-empty string when provided' };
    }
    if (typeof obj.tokenSource === 'string' && obj.tokenSource.trim()) {
      request.tokenSource = obj.tokenSource.trim();
    }
    if (obj.provenance !== undefined) request.provenance = obj.provenance;
    return { ok: true, request };
  }

  if (typeof obj.rootId !== 'string' || !ROOT_ID_RE.test(obj.rootId)) {
    return { ok: false, error: 'ghost.rootId must be a configured root id' };
  }
  if (!roots.has(obj.rootId)) {
    return { ok: false, error: `unknown Ghost root "${obj.rootId}"` };
  }

  const target = normalizeTargetPath(obj.targetPath);
  if (!target.ok) return { ok: false, error: target.error };

  let memoryDir = '.ghost';
  if (obj.memoryDir !== undefined) {
    if (typeof obj.memoryDir !== 'string') {
      return { ok: false, error: 'ghost.memoryDir must be a string' };
    }
    try {
      memoryDir = normalizeGhostMemoryDir(obj.memoryDir);
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return {
    ok: true,
    request: {
      source: 'root',
      rootId: obj.rootId,
      targetPath: target.path,
      memoryDir,
      baseDirectionId: baseDirectionId.value,
    },
  };
}

export async function resolveGhostContext(
  request: GhostRequest,
  roots: GhostRoots,
): Promise<ResolvedGhostContext> {
  return resolveGhostGenerationContext(request, roots);
}

export async function resolveGhostSteer(
  request: GhostRequest,
  roots: GhostRoots,
  baseDirection: GhostBaseDirection | null = null,
): Promise<ResolvedGhostSteer> {
  return resolveGhostGenerationContext(request, roots, baseDirection);
}

export async function resolveGhostGenerationContext(
  request: GhostRequest,
  roots: GhostRoots,
  baseDirection: GhostBaseDirection | null = null,
): Promise<ResolvedGhostSteer> {
  if (request.source === 'resolved-context') {
    const tokenSource = resolveResolvedContextTokenSource(request, baseDirection);
    return {
      source: 'resolved-context',
      request,
      root: null,
      stack: null,
      context: null,
      prompt: request.prompt,
      product: request.product,
      tokenSource,
      provenance: request.provenance,
      baseDirectionId: baseDirection?.id ?? request.baseDirectionId ?? null,
    };
  }
  return resolveRootGhostGenerationContext(request, roots, baseDirection);
}

async function resolveRootGhostGenerationContext(
  request: GhostRootRequest,
  roots: GhostRoots,
  baseDirection: GhostBaseDirection | null,
): Promise<ResolvedRootGhostSteer> {
  const root = roots.get(request.rootId);
  if (!root) throw new Error(`unknown Ghost root "${request.rootId}"`);
  const targetAbs = resolve(root, request.targetPath);
  if (!isWithinOrEqual(root, targetAbs)) {
    throw new Error('ghost.targetPath must stay within the configured root');
  }

  const resolved = await resolveGhostRootCompat({
    root,
    targetPath: request.targetPath,
    memoryDir: request.memoryDir,
  });
  const { stack, context } = resolved;
  if (resolve(stack.repoRoot) !== resolve(root)) {
    throw new Error('configured Ghost root must resolve to the fingerprint stack repo root');
  }
  const [prompt, tokenSource] = await Promise.all([
    buildPromptFromContext(context),
    resolveGhostTokenSource(stack, baseDirection),
  ]);
  return {
    source: 'root',
    request,
    root,
    stack,
    context,
    prompt,
    product: stack.product ?? context.name,
    tokenSource,
    baseDirectionId: baseDirection?.id ?? request.baseDirectionId ?? null,
  };
}

export function ghostContextMeta(ctx: ResolvedGhostContext) {
  if (ctx.source === 'resolved-context') {
    return {
      source: ctx.source,
      rootId: ctx.request.id ?? null,
      targetPath: null,
      memoryDir: null,
      layers: [],
      product: ctx.product ?? ctx.request.id ?? 'Ghost',
      baseDirectionId: ctx.baseDirectionId,
      styleSource: ctx.tokenSource.kind,
      provenance: ctx.provenance ?? null,
    };
  }
  return {
    source: ctx.source,
    rootId: ctx.request.rootId,
    targetPath: ctx.stack.targetPath,
    memoryDir: ctx.stack.memoryDir,
    layers: ctx.stack.layers.map((layer) => layer.relativeRoot),
    product: ctx.product,
    baseDirectionId: ctx.baseDirectionId,
    styleSource: ctx.tokenSource.kind,
    provenance: {
      merge: ctx.stack.provenance.merge,
      layers: ctx.stack.provenance.layers.map((layer) => ({
        relativeRoot: layer.relativeRoot,
        memoryDir: layer.memoryDir,
      })),
    },
  };
}

export function ghostTokenSourceMeta(tokenSource: GhostTokenSource) {
  return {
    kind: tokenSource.kind,
    source: tokenSource.source,
    css: tokenSource.css,
    warnings: tokenSource.warnings,
    baseDirectionId: tokenSource.baseDirectionId ?? null,
  };
}

export function buildGhostReviewPacket(input: {
  context: ResolvedGhostContext;
  mode: 'static' | 'interactive';
  layoutId: string | null;
  validation: GhostReviewPacket['validation'];
  acceptedLines: ProtocolLine[];
  prompt: string;
}): GhostReviewPacket {
  const declaredSections = declaredSectionsFromLines(input.acceptedLines);
  const sectionsById = new Map<string, string>();
  for (const line of input.acceptedLines) {
    if (line.op !== 'add' || !line.path.startsWith('/section/')) continue;
    sectionsById.set(line.path.slice('/section/'.length), line.html ?? '');
  }
  const rootFields = input.context.source === 'root'
    ? {
        rootId: input.context.request.rootId,
        targetPath: input.context.stack.targetPath,
        memoryDir: input.context.stack.memoryDir,
        product: input.context.product,
        layers: input.context.stack.layers.map((layer) => layer.relativeRoot),
        memoryProvenance: {
          merge: input.context.stack.provenance.merge,
          layers: input.context.stack.provenance.layers.map((layer) => ({
            relativeRoot: layer.relativeRoot,
            memoryDir: layer.memoryDir,
          })),
        },
      }
    : {
        rootId: input.context.request.id ?? null,
        targetPath: null,
        memoryDir: null,
        product: input.context.product ?? input.context.request.id ?? 'Ghost',
        layers: [],
        memoryProvenance: {
          merge: 'external' as const,
          layers: [],
          provenance: input.context.provenance ?? null,
        },
      };
  return {
    schema: 'summon.ghost-generation/v1',
    source: input.context.source,
    prompt: input.prompt,
    ...rootFields,
    tokenSource: {
      kind: input.context.tokenSource.kind,
      source: input.context.tokenSource.source,
      warnings: input.context.tokenSource.warnings,
      baseDirectionId: input.context.tokenSource.baseDirectionId ?? null,
    },
    baseDirectionId: input.context.baseDirectionId,
    styleSource: input.context.tokenSource.kind,
    mode: input.mode,
    layoutId: input.layoutId,
    validation: input.validation,
    declaredSections,
    sections: [...sectionsById.entries()].map(([id, html]) => ({ id, html })),
  };
}

async function buildPromptFromContext(context: GhostContextCompat): Promise<string> {
  return context.writePrompt();
}

async function resolveGhostTokenSource(
  stack: GhostStackCompat,
  baseDirection: GhostBaseDirection | null,
): Promise<GhostTokenSource> {
  const warnings: string[] = [];
  for (const layer of [...stack.layers].reverse()) {
    const configPath = resolve(layer.root, layer.memoryDir, 'config.yml');
    let config;
    try {
      config = await readGhostPackageConfig(configPath);
    } catch (err) {
      warnings.push(
        `${displayPath(stack, configPath)} could not be read: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      continue;
    }
    if (!config) continue;
    for (const target of config.targets) {
      for (const tokenRef of target.tokens ?? []) {
        const tokenPath = resolveTokenPath(layer, tokenRef);
        if (!tokenPath) {
          warnings.push(
            `${tokenRef} is not a safe relative token CSS path`,
          );
          continue;
        }
        if (!existsSync(tokenPath) || !statSync(tokenPath).isFile()) {
          warnings.push(`${displayPath(stack, tokenPath)} not found`);
          continue;
        }
        const css = readFileSync(tokenPath, 'utf-8');
        const validation = compileTokenContract({ css });
        const blocking = validation.issues.filter((issue) => issue.severity === 'block');
        if (blocking.length > 0) {
          warnings.push(
            `${displayPath(stack, tokenPath)} failed token contract: ${blocking.map((issue) => issue.message).join('; ')}`,
          );
          continue;
        }
        return {
          kind: 'ghost-config',
          source: displayPath(stack, tokenPath),
          css,
          warnings: [
            ...warnings,
            ...validation.issues
              .filter((issue) => issue.severity === 'warn')
              .map((issue) => issue.message),
          ],
        };
      }
    }
  }
  return resolveFallbackTokenSource(warnings, baseDirection);
}

function resolveResolvedContextTokenSource(
  request: GhostResolvedContextRequest,
  baseDirection: GhostBaseDirection | null,
): GhostTokenSource {
  const warnings: string[] = [];
  if (request.tokensCss) {
    const validation = compileTokenContract({ css: request.tokensCss });
    const blocking = validation.issues.filter((issue) => issue.severity === 'block');
    if (blocking.length === 0) {
      return {
        kind: 'resolved-context',
        source: request.tokenSource ?? 'resolved-context:tokensCss',
        css: request.tokensCss,
        warnings: [
          ...validation.issues
            .filter((issue) => issue.severity === 'warn')
            .map((issue) => issue.message),
        ],
      };
    }
    warnings.push(
      `${request.tokenSource ?? 'resolved-context:tokensCss'} failed token contract: ${blocking.map((issue) => issue.message).join('; ')}`,
    );
  }
  return resolveFallbackTokenSource(warnings, baseDirection);
}

function resolveFallbackTokenSource(
  warnings: string[],
  baseDirection: GhostBaseDirection | null,
): GhostTokenSource {
  if (baseDirection) {
    const validation = compileTokenContract({ css: baseDirection.tokensCss });
    const blocking = validation.issues.filter((issue) => issue.severity === 'block');
    if (blocking.length === 0) {
      return {
        kind: 'base-direction',
        source: `direction:${baseDirection.id}/tokens.css`,
        css: baseDirection.tokensCss,
        baseDirectionId: baseDirection.id,
        warnings: [
          ...warnings,
          'No contract-complete Ghost token CSS was found; using the base Summon direction tokens.',
          ...validation.issues
            .filter((issue) => issue.severity === 'warn')
            .map((issue) => issue.message),
        ],
      };
    }
    warnings.push(
      `direction:${baseDirection.id}/tokens.css failed token contract: ${blocking.map((issue) => issue.message).join('; ')}`,
    );
  }
  return {
    kind: 'summon-default',
    source: '@anarchitecture/summon/tokens.css',
    css: DEFAULT_TOKENS_CSS,
    warnings: [
      ...warnings,
      'No contract-complete Ghost token CSS was found; using Summon default tokens.',
    ],
  };
}

function resolveTokenPath(
  layer: GhostStackLayerCompat,
  rawRef: string,
): string | null {
  const raw = rawRef.trim();
  const ref = raw.startsWith('workspace:')
    ? raw.slice('workspace:'.length)
    : raw;
  if (!ref.endsWith('.css')) return null;
  const normalized = ref.trim().replaceAll('\\', '/').replace(/\/+/g, '/');
  if (
    !normalized ||
    normalized.startsWith('/') ||
    isAbsolute(normalized) ||
    /^[A-Za-z]:/.test(normalized)
  ) {
    return null;
  }
  const segments = normalized.split('/');
  if (
    segments.some(
      (segment) => segment === '' || segment === '.' || segment === '..',
    )
  ) {
    return null;
  }
  const resolved = resolve(layer.root, normalized);
  return isWithinOrEqual(layer.root, resolved) ? resolved : null;
}

function parseBaseDirectionId(raw: unknown):
  | { ok: true; value: string | null }
  | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, value: null };
  }
  if (typeof raw !== 'string' || !ROOT_ID_RE.test(raw)) {
    return { ok: false, error: 'ghost.baseDirectionId must be a valid direction id' };
  }
  return { ok: true, value: raw };
}

function normalizeTargetPath(raw: unknown):
  | { ok: true; path: string }
  | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, path: '.' };
  }
  if (typeof raw !== 'string') {
    return { ok: false, error: 'ghost.targetPath must be a string' };
  }
  const value = raw.trim().replaceAll('\\', '/').replace(/\/+/g, '/');
  if (value === '.' || value === '') return { ok: true, path: '.' };
  if (value.startsWith('/') || isAbsolute(value) || /^[A-Za-z]:/.test(value)) {
    return { ok: false, error: 'ghost.targetPath must be relative' };
  }
  const segments = value.split('/');
  if (
    segments.some(
      (segment) => segment === '' || segment === '.' || segment === '..',
    )
  ) {
    return {
      ok: false,
      error: 'ghost.targetPath must not contain path traversal segments',
    };
  }
  return { ok: true, path: segments.join('/') };
}

function declaredSectionsFromLines(lines: ProtocolLine[]): string[] {
  for (let index = lines.length - 1; index >= 0; index--) {
    const line = lines[index];
    if (line?.op !== 'set' || line.path !== '/screen') continue;
    const value = line.value as { sections?: unknown } | undefined;
    if (!value || !Array.isArray(value.sections)) continue;
    return value.sections.filter((section): section is string => typeof section === 'string');
  }
  return [];
}

function isWithinOrEqual(root: string, child: string): boolean {
  const rel = relative(resolve(root), resolve(child));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function displayPath(stack: GhostStackCompat, absPath: string): string {
  const rel = relative(stack.repoRoot, absPath);
  return rel && !rel.startsWith('..') && !isAbsolute(rel) ? rel : absPath;
}
