import {
  loadMemoryStackForPath,
  memoryStackToPackageMemory,
  normalizeMemoryDir,
  readOptionalPackageConfig,
  writePackageContextBundleFromMemory,
  type GhostMemoryStack,
  type GhostMemoryStackLayer,
  type PackageMemory,
} from '@anarchitecture/ghost/scan';
import { compileTokenContract, type ProtocolLine } from '@summon/engine';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from 'node:path';
import { fileURLToPath } from 'node:url';

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

export interface GhostRequest {
  rootId: string;
  targetPath: string;
  memoryDir: string;
  baseDirectionId: string | null;
}

export interface GhostRoot {
  id: string;
  root: string;
}

export type GhostRoots = Map<string, string>;

export interface GhostTokenSource {
  kind: 'ghost-config' | 'base-direction' | 'summon-default';
  source: string;
  css: string;
  warnings: string[];
  baseDirectionId?: string | null;
}

export interface GhostBaseDirection {
  id: string;
  tokensCss: string;
}

export interface ResolvedGhostSteer {
  request: GhostRequest;
  root: string;
  stack: GhostMemoryStack;
  memory: PackageMemory;
  prompt: string;
  tokenSource: GhostTokenSource;
  baseDirectionId: string | null;
}

export type ResolvedGhostContext = ResolvedGhostSteer;

export interface GhostReviewPacket {
  schema: 'summon.ghost-generation/v1';
  prompt: string;
  rootId: string;
  targetPath: string;
  memoryDir: string;
  product: string;
  layers: string[];
  memoryProvenance: {
    merge: GhostMemoryStack['provenance']['merge'];
    layers: Array<{
      relativeRoot: string;
      memoryDir: string;
    }>;
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
      memoryDir = normalizeMemoryDir(obj.memoryDir);
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  let baseDirectionId: string | null = null;
  if (obj.baseDirectionId !== undefined && obj.baseDirectionId !== null && obj.baseDirectionId !== '') {
    if (typeof obj.baseDirectionId !== 'string' || !ROOT_ID_RE.test(obj.baseDirectionId)) {
      return { ok: false, error: 'ghost.baseDirectionId must be a valid direction id' };
    }
    baseDirectionId = obj.baseDirectionId;
  }

  return {
    ok: true,
    request: {
      rootId: obj.rootId,
      targetPath: target.path,
      memoryDir,
      baseDirectionId,
    },
  };
}

export async function resolveGhostContext(
  request: GhostRequest,
  roots: GhostRoots,
): Promise<ResolvedGhostContext> {
  return resolveGhostSteer(request, roots);
}

export async function resolveGhostSteer(
  request: GhostRequest,
  roots: GhostRoots,
  baseDirection: GhostBaseDirection | null = null,
): Promise<ResolvedGhostSteer> {
  const root = roots.get(request.rootId);
  if (!root) throw new Error(`unknown Ghost root "${request.rootId}"`);
  const targetAbs = resolve(root, request.targetPath);
  if (!isWithinOrEqual(root, targetAbs)) {
    throw new Error('ghost.targetPath must stay within the configured root');
  }

  const stack = await loadMemoryStackForPath(request.targetPath, root, {
    memoryDir: request.memoryDir,
  });
  if (resolve(stack.repo_root) !== resolve(root)) {
    throw new Error('configured Ghost root must resolve to the memory stack repo root');
  }
  const memory = memoryStackToPackageMemory(stack);
  const [prompt, tokenSource] = await Promise.all([
    buildPromptFromMemory(memory),
    resolveGhostTokenSource(stack, baseDirection),
  ]);
  return {
    request,
    root,
    stack,
    memory,
    prompt,
    tokenSource,
    baseDirectionId: baseDirection?.id ?? request.baseDirectionId ?? null,
  };
}

export function ghostContextMeta(ctx: ResolvedGhostContext) {
  return {
    rootId: ctx.request.rootId,
    targetPath: ctx.stack.target_path,
    memoryDir: ctx.stack.memory_dir,
    layers: ctx.stack.layers.map((layer) => layer.relative_root),
    product: ctx.stack.merged.fingerprint.summary.product ?? ctx.memory.name,
    baseDirectionId: ctx.baseDirectionId,
    styleSource: ctx.tokenSource.kind,
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
  return {
    schema: 'summon.ghost-generation/v1',
    prompt: input.prompt,
    rootId: input.context.request.rootId,
    targetPath: input.context.stack.target_path,
    memoryDir: input.context.stack.memory_dir,
    product:
      input.context.stack.merged.fingerprint.summary.product ??
      input.context.memory.name,
    layers: input.context.stack.layers.map((layer) => layer.relative_root),
    memoryProvenance: {
      merge: input.context.stack.provenance.merge,
      layers: input.context.stack.provenance.layers.map((layer) => ({
        relativeRoot: layer.relative_root,
        memoryDir: layer.memory_dir,
      })),
    },
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

async function buildPromptFromMemory(memory: PackageMemory): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'summon-ghost-context-'));
  try {
    await writePackageContextBundleFromMemory(memory, {
      outDir: dir,
      promptOnly: true,
    });
    return await readFile(join(dir, 'prompt.md'), 'utf-8');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function resolveGhostTokenSource(
  stack: GhostMemoryStack,
  baseDirection: GhostBaseDirection | null,
): Promise<GhostTokenSource> {
  const warnings: string[] = [];
  for (const layer of [...stack.layers].reverse()) {
    const configPath = resolve(layer.dir, 'config.yml');
    let config;
    try {
      config = await readOptionalPackageConfig(configPath);
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
    source: '@summon/sandbox-runtime/tokens.css',
    css: DEFAULT_TOKENS_CSS,
    warnings: [
      ...warnings,
      'No contract-complete Ghost token CSS was found; using Summon default tokens.',
    ],
  };
}

function resolveTokenPath(
  layer: GhostMemoryStackLayer,
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

function displayPath(stack: GhostMemoryStack, absPath: string): string {
  const rel = relative(stack.repo_root, absPath);
  return rel && !rel.startsWith('..') && !isAbsolute(rel) ? rel : absPath;
}
