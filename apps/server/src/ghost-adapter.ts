import {
  compileTokenContract,
  type ToolPack,
  type ComponentPack,
  type ProtocolLine,
  type SurfacePlan,
} from '@anarchitecture/summon/engine';
import type { GhostGenerationContext } from '@anarchitecture/summon-server';
import { readOptionalPackageConfig } from '@anarchitecture/ghost/fingerprint';
import {
  gatherRelayContext,
  type RelayGatherResult,
} from '@anarchitecture/ghost/relay';
import { existsSync, readFileSync, statSync } from 'node:fs';
import {
  dirname,
  isAbsolute,
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

type RelayStackSource = Extract<RelayGatherResult['source'], { kind: 'stack' }>;
type RelayStackLayer = RelayStackSource['provenance']['layers'][number];

export interface GhostRootRequest {
  source: 'root';
  rootId: string;
  targetPath: string;
  memoryDir: string;
  baseDirectionId: string | null;
}

export type GhostRequest = GhostRootRequest;

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

export interface ResolvedRootGhostSteer extends GhostGenerationContext {
  source: 'root';
  request: GhostRootRequest;
  root: string;
  relay: RelayGatherResult & { source: RelayStackSource };
  prompt: string;
  tokenSource: GhostTokenSource;
  baseDirectionId: string | null;
  product: string;
}

export type ResolvedGhostSteer = ResolvedRootGhostSteer;

export type ResolvedGhostContext = ResolvedGhostSteer;

export interface GhostSurfacePromptOptions {
  userPrompt: string;
  mode: 'static' | 'interactive';
  surfacePlan: SurfacePlan;
  shape?: string | null;
  tools?: ToolPack | null;
  components?: ComponentPack | null;
}

export interface GhostReviewPacket {
  schema: 'summon.ghost-fingerprint-generation/v1';
  source: 'root';
  prompt: string;
  rootId: string;
  targetPath: string;
  memoryDir: string;
  product: string;
  layers: string[];
  fingerprintProvenance: {
    merge: RelayStackSource['provenance']['merge'];
    layers: Array<{
      relativeRoot: string;
      memoryDir: string;
      dir: string;
    }>;
    layerDirs: string[];
    targetPaths: string[];
    match: RelayGatherResult['entrypoint']['match'];
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
  artifactRuntime: 'arrow' | null;
  artifactFiles: string[];
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
  if (source !== 'root') {
    return {
      ok: false,
      error: 'ghost.source must be "root"; resolved-context is no longer supported',
    };
  }

  const baseDirectionId = parseBaseDirectionId(obj.baseDirectionId);
  if (!baseDirectionId.ok) return { ok: false, error: baseDirectionId.error };

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
  const root = roots.get(request.rootId);
  if (!root) throw new Error(`unknown Ghost root "${request.rootId}"`);
  const targetAbs = resolve(root, request.targetPath);
  if (!isWithinOrEqual(root, targetAbs)) {
    throw new Error('ghost.targetPath must stay within the configured root');
  }

  const relay = await gatherRelayContext({
    cwd: root,
    target: request.targetPath,
    memoryDir: request.memoryDir,
  });
  if (relay.source.kind !== 'stack') {
    throw new Error('Ghost relay did not resolve a fingerprint stack source');
  }
  if (resolve(relay.source.repoRoot) !== resolve(root)) {
    throw new Error('configured Ghost root must resolve to the fingerprint stack repo root');
  }
  const stackRelay = relay as RelayGatherResult & { source: RelayStackSource };
  const product = relay.entrypoint.identity.product || relay.name || request.rootId;
  const tokenSource = await resolveGhostTokenSource(stackRelay, baseDirection);
  return {
    source: 'root',
    request,
    root,
    relay: stackRelay,
    prompt: relay.brief,
    product,
    tokenSource,
    baseDirectionId: baseDirection?.id ?? request.baseDirectionId ?? null,
  };
}

export function prepareGhostSurfacePrompt(
  context: ResolvedGhostSteer,
  options: GhostSurfacePromptOptions,
): ResolvedGhostSteer {
  return {
    ...context,
    prompt: [
      context.prompt.trim(),
      buildSummonFingerprintSurfaceBrief(context, options),
    ].filter(Boolean).join('\n\n'),
  };
}

export function ghostContextMeta(ctx: ResolvedGhostContext) {
  return {
    source: ctx.source,
    rootId: ctx.request.rootId,
    targetPath: ctx.relay.source.targetPath,
    memoryDir: ctx.relay.source.fingerprintDir,
    layers: ctx.relay.source.provenance.layers.map((layer: RelayStackLayer) => layer.relative_root),
    product: ctx.product,
    baseDirectionId: ctx.baseDirectionId,
    styleSource: ctx.tokenSource.kind,
    provenance: fingerprintProvenance(ctx.relay),
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
  const artifactFiles = artifactFilesFromLines(input.acceptedLines);
  return {
    schema: 'summon.ghost-fingerprint-generation/v1',
    source: input.context.source,
    prompt: input.prompt,
    rootId: input.context.request.rootId,
    targetPath: input.context.relay.source.targetPath,
    memoryDir: input.context.relay.source.fingerprintDir,
    product: input.context.product,
    layers: input.context.relay.source.provenance.layers.map((layer: RelayStackLayer) => layer.relative_root),
    fingerprintProvenance: fingerprintProvenance(input.context.relay),
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
    artifactRuntime: artifactFiles.length > 0 ? 'arrow' : null,
    artifactFiles,
  };
}

function buildSummonFingerprintSurfaceBrief(
  context: ResolvedGhostSteer,
  options: GhostSurfacePromptOptions,
): string {
  const toolNames = options.tools?.tools.map((tool) => tool.name) ?? [];
  const componentNames = options.components?.components.map((component) => component.name) ?? [];
  const details = [
    `Product: ${context.product}`,
    `Target path: ${context.relay.source.targetPath}`,
    `User request: ${oneLine(options.userPrompt, 600)}`,
    `Surface plan: purpose=${options.surfacePlan.purpose}; runtime=${options.surfacePlan.runtime}; data=${options.surfacePlan.data}; authority=${options.surfacePlan.authority}; persistence=${options.surfacePlan.persistence}`,
    `Mode: ${options.mode}`,
    options.shape ? `Response shape hint: ${options.shape}` : null,
    toolNames.length > 0 ? `Granted host tools: ${toolNames.join(', ')}` : 'Granted host tools: none',
    componentNames.length > 0 ? `Granted host components: ${componentNames.join(', ')}` : null,
  ].filter((line): line is string => Boolean(line));

  return [
    '## Summon Surface Brief',
    '',
    'Treat the Ghost fingerprint above as a product design direction package for this Summon surface.',
    '',
    ...details.map((line) => `- ${line}`),
    '',
    'Generation rules:',
    '',
    '- Compose from the fingerprint prose, inventory, and composition layers. Prose states tool; inventory supplies material and evidence; composition supplies reusable surface patterns.',
    '- Do not imitate Ghost UI as a visual style. Use inventory examples only when they support the selected tool and composition pattern.',
    '- The agent broker controls host authority and tools. The fingerprint controls product direction, hierarchy, tone, and composition expectations.',
    '- Treat checks as validation constraints, not as content to render.',
  ].join('\n');
}

async function resolveGhostTokenSource(
  relay: RelayGatherResult & { source: RelayStackSource },
  baseDirection: GhostBaseDirection | null,
): Promise<GhostTokenSource> {
  const warnings: string[] = [];
  for (const layer of [...relay.source.provenance.layers].reverse()) {
    const configPath = resolve(layer.dir, 'config.yml');
    let config;
    try {
      config = await readOptionalPackageConfig(configPath);
    } catch (err) {
      warnings.push(
        `${displayPath(relay.source, configPath)} could not be read: ${
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
          warnings.push(`${displayPath(relay.source, tokenPath)} not found`);
          continue;
        }
        const css = readFileSync(tokenPath, 'utf-8');
        const validation = compileTokenContract({ css });
        const blocking = validation.issues.filter((issue) => issue.severity === 'block');
        if (blocking.length > 0) {
          warnings.push(
            `${displayPath(relay.source, tokenPath)} failed token contract: ${blocking.map((issue) => issue.message).join('; ')}`,
          );
          continue;
        }
        return {
          kind: 'ghost-config',
          source: displayPath(relay.source, tokenPath),
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
          'No contract-complete Ghost fingerprint token CSS was found; using the fallback Summon direction tokens.',
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
      'No contract-complete Ghost fingerprint token CSS was found; using Summon default tokens.',
    ],
  };
}

function resolveTokenPath(
  layer: RelayStackLayer,
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

function fingerprintProvenance(relay: RelayGatherResult & { source: RelayStackSource }): GhostReviewPacket['fingerprintProvenance'] {
  return {
    merge: relay.source.provenance.merge,
    layers: relay.source.provenance.layers.map((layer: RelayStackLayer) => ({
      relativeRoot: layer.relative_root,
      memoryDir: layer.fingerprint_dir,
      dir: displayPath(relay.source, layer.dir),
    })),
    layerDirs: relay.layerDirs.map((dir: string) => displayPath(relay.source, dir)),
    targetPaths: relay.targetPaths,
    match: relay.entrypoint.match,
  };
}

function normalizeGhostMemoryDir(raw: string): string {
  const normalized = raw.trim().replaceAll('\\', '/').replace(/\/+/g, '/').replace(/\/$/g, '');
  if (!normalized || normalized === '.') return '.ghost';
  if (normalized.startsWith('/') || isAbsolute(normalized) || /^[A-Za-z]:/.test(normalized)) {
    throw new Error('ghost.memoryDir must be relative');
  }
  const segments = normalized.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new Error('ghost.memoryDir must not contain path traversal segments');
  }
  return segments.join('/');
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

function artifactFilesFromLines(lines: ProtocolLine[]): string[] {
  for (let index = lines.length - 1; index >= 0; index--) {
    const line = lines[index];
    if (line?.op !== 'artifact') continue;
    const value = line.value as { runtime?: unknown; source?: unknown } | undefined;
    if (value?.runtime !== 'arrow' || !value.source || typeof value.source !== 'object' || Array.isArray(value.source)) {
      continue;
    }
    return Object.keys(value.source).sort();
  }
  return [];
}

function oneLine(value: string, max: number): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length <= max ? compact : `${compact.slice(0, Math.max(0, max - 3))}...`;
}

function isWithinOrEqual(root: string, child: string): boolean {
  const rel = relative(resolve(root), resolve(child));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function displayPath(source: RelayStackSource, absPath: string): string {
  const rel = relative(source.repoRoot, absPath);
  return rel && !rel.startsWith('..') && !isAbsolute(rel) ? rel : absPath;
}
