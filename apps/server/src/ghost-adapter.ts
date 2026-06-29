import {
  runtimeProfile,
  type ToolPack,
  type ProtocolLine,
  type SurfacePlan,
  type SummonOutputRuntime,
} from '@anarchitecture/summon/engine';
import {
  loadFingerprintPackage,
  resolveFingerprintPackage,
} from '@anarchitecture/ghost/fingerprint';
import {
  GHOST_GRAPH_ROOT_ID,
  buildGraphMenu,
  resolveGraphSlice,
  type GhostGraph,
  type GraphSlice,
  type GraphSliceProvenance,
} from '@anarchitecture/ghost/core';
import { isAbsolute, join, relative, resolve } from 'node:path';
import {
  resolveCatalogTokenSource,
  type FingerprintCatalog,
  type FingerprintCatalogEntry,
  type FingerprintRequest,
} from './fingerprint-catalog.js';

const ROOT_ID_RE = /^[a-z][a-z0-9._-]{0,63}$/;

export interface GhostRootRequest {
  source: 'root';
  rootId: string;
  targetPath: string;
  memoryDir: string | null;
  baseDirectionId: string | null;
}

export interface GhostCatalogRequest {
  source: 'catalog';
  fingerprintId: string;
  targetPath: string;
  baseDirectionId: string | null;
}

export type GhostRequest = GhostRootRequest | GhostCatalogRequest;

export interface GhostRoot {
  id: string;
  root: string;
}

export type GhostRoots = Map<string, string>;

export interface GhostTokenSource {
  kind: 'ghost-config' | 'fingerprint-catalog';
  source: string;
  css: string;
  warnings: string[];
  baseDirectionId?: string | null;
}

export interface GhostBaseDirection {
  id: string;
  tokensCss: string;
}

interface BaseGhostSteer {
  surface: string;
  graph: GhostGraph;
  slice: GraphSlice;
  prompt: string;
  product: string;
  tokenSource: GhostTokenSource;
  baseDirectionId: string | null;
}

export interface ResolvedRootGhostSteer extends BaseGhostSteer {
  source: 'root';
  request: GhostRootRequest;
  root: string;
}

export interface ResolvedCatalogGhostSteer extends BaseGhostSteer {
  source: 'catalog';
  request: GhostCatalogRequest;
  catalogEntry: FingerprintCatalogEntry;
  root: string;
}

export type ResolvedGhostSteer = ResolvedRootGhostSteer | ResolvedCatalogGhostSteer;

export type ResolvedGhostContext = ResolvedGhostSteer;

export interface GhostSurfacePromptOptions {
  userPrompt: string;
  mode: 'static' | 'interactive';
  surfacePlan: SurfacePlan;
  tools?: ToolPack | null;
  outputRuntime?: SummonOutputRuntime;
}

export interface GhostReviewPacket {
  schema: 'summon.ghost-fingerprint-generation/v1';
  source: 'root' | 'catalog';
  rootId: string;
  catalogId?: string;
  catalogName?: string;
  product: string;
  surface: string;
  gatheredNodes: string[];
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
  | { ok: true; request: GhostRootRequest | null }
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

  let memoryDir: string | null = null;
  if (obj.memoryDir !== undefined && obj.memoryDir !== null && obj.memoryDir !== '') {
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
  request: GhostRootRequest,
  roots: GhostRoots,
): Promise<ResolvedRootGhostSteer> {
  return resolveGhostGenerationContext(request, roots);
}

export async function resolveGhostSteer(
  request: GhostRootRequest,
  roots: GhostRoots,
  baseDirection: GhostBaseDirection | null = null,
): Promise<ResolvedRootGhostSteer> {
  return resolveGhostGenerationContext(request, roots, baseDirection);
}

export async function resolveGhostGenerationContext(
  request: GhostRootRequest,
  roots: GhostRoots,
  baseDirection: GhostBaseDirection | null = null,
): Promise<ResolvedRootGhostSteer> {
  const root = roots.get(request.rootId);
  if (!root) throw new Error(`unknown Ghost root "${request.rootId}"`);
  const targetAbs = resolve(root, request.targetPath);
  if (!isWithinOrEqual(root, targetAbs)) {
    throw new Error('ghost.targetPath must stay within the configured root');
  }

  const ghostDir = join(root, request.memoryDir ?? '.ghost');
  const paths = resolveFingerprintPackage(ghostDir, process.cwd());
  const { graph } = await loadFingerprintPackage(paths);
  const slice = resolveGraphSlice(graph, GHOST_GRAPH_ROOT_ID);

  const product = request.rootId;
  const css = extractSliceCss(slice);
  const tokenSource = resolveGraphTokenSource(css, baseDirection);

  return {
    source: 'root',
    request,
    root,
    surface: 'core',
    graph,
    slice,
    prompt: renderSlicePrompt(slice),
    product,
    tokenSource,
    baseDirectionId: baseDirection?.id ?? request.baseDirectionId ?? null,
  };
}

export async function resolveCatalogGhostGenerationContext(
  request: FingerprintRequest,
  catalog: FingerprintCatalog,
  baseDirection: GhostBaseDirection | null = null,
): Promise<ResolvedCatalogGhostSteer> {
  const entry = catalog.byId.get(request.id);
  if (!entry) throw new Error(`unknown fingerprint "${request.id}"`);

  const paths = resolveFingerprintPackage(entry.ghostDir, process.cwd());
  const { graph } = await loadFingerprintPackage(paths);
  const slice = resolveGraphSlice(graph, GHOST_GRAPH_ROOT_ID);

  const product = entry.name || request.id;
  const css = extractSliceCss(slice);
  const tokenSource = css.trim()
    ? resolveGraphTokenSource(css, baseDirection)
    : resolveCatalogTokenSource(entry, baseDirection);

  return {
    source: 'catalog',
    request: {
      source: 'catalog',
      fingerprintId: request.id,
      targetPath: request.targetPath,
      baseDirectionId: request.baseDirectionId,
    },
    catalogEntry: entry,
    root: entry.root,
    surface: 'core',
    graph,
    slice,
    prompt: renderSlicePrompt(slice),
    product,
    tokenSource,
    baseDirectionId: baseDirection?.id ?? request.baseDirectionId ?? null,
  };
}

export function prepareGhostSurfacePrompt(
  context: ResolvedGhostSteer,
  options: GhostSurfacePromptOptions,
): ResolvedGhostSteer {
  // Surface selection happens at prepare-time (both prompt + graph are
  // available here). The resolve fns default to `core`; this refines the choice
  // once the user prompt is known. For the common single-`core` fixture, the
  // chosen surface equals `context.surface` and no re-resolve is needed.
  let resolved = context;
  const chosen = selectGhostSurface(context.graph, options.userPrompt);
  if (chosen !== context.surface) {
    const slice = resolveGraphSlice(context.graph, chosen);
    // Rebuild the token CSS from the new slice, but preserve the kind/source/
    // baseDirectionId already resolved at load-time (baseDirection is not in
    // scope here). This keeps the token plumbing stable while the slice/prose
    // follow the selected surface.
    const tokenSource: GhostTokenSource = {
      ...context.tokenSource,
      css: extractSliceCss(slice),
    };
    resolved = {
      ...context,
      surface: chosen,
      slice,
      tokenSource,
      prompt: renderSlicePrompt(slice),
    };
  }

  const surfaceBrief = buildSummonFingerprintSurfaceBrief(resolved, options);
  return {
    ...resolved,
    prompt: [
      resolved.prompt.trim(),
      surfaceBrief,
    ].filter(Boolean).join('\n\n'),
  };
}

/**
 * Deterministic surface selection (no LLM). Ghost's principle: the agent names
 * the node; Ghost does not infer it from paths. For single-`core` fixtures this
 * always returns `core`. When the package offers multiple real surfaces, score
 * each menu entry by word overlap between the prompt and the entry's
 * description + id, and return the best match (ties / zero score fall back to
 * `core`). This is the minimal seam — a heavyweight classifier is deferred until
 * multi-surface fingerprints exist.
 */
export function selectGhostSurface(graph: GhostGraph, prompt: string): string {
  const menu = buildGraphMenu(graph);
  const realSurfaces = menu.filter((entry) => entry.id !== GHOST_GRAPH_ROOT_ID);
  if (realSurfaces.length <= 1) return GHOST_GRAPH_ROOT_ID;

  const promptWords = new Set(
    prompt.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2),
  );
  const scored = realSurfaces.map((entry) => {
    const text = `${entry.id} ${entry.description ?? ''}`.toLowerCase();
    const words = new Set(text.split(/[^a-z0-9]+/).filter((word) => word.length > 2));
    let score = 0;
    for (const word of words) if (promptWords.has(word)) score++;
    return { id: entry.id, score };
  });
  const top = Math.max(...scored.map((entry) => entry.score));
  const leaders = scored.filter((entry) => entry.score === top);
  if (top === 0 || leaders.length !== 1) return GHOST_GRAPH_ROOT_ID;
  return leaders[0]!.id;
}

export function ghostContextMeta(ctx: ResolvedGhostContext) {
  return {
    source: ctx.source,
    rootId: ctx.source === 'root' ? ctx.request.rootId : ctx.request.fingerprintId,
    ...(ctx.source === 'catalog' ? {
      catalogId: ctx.request.fingerprintId,
      catalogName: ctx.catalogEntry.name,
      catalogSummary: ctx.catalogEntry.summary,
      catalogStatus: ctx.catalogEntry.status,
      catalogTags: ctx.catalogEntry.tags,
    } : {}),
    product: ctx.product,
    surface: ctx.surface,
    gatheredNodes: sliceNodeIds(ctx.slice),
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
  const artifactFiles = artifactFilesFromLines(input.acceptedLines);
  const ctx = input.context;
  return {
    schema: 'summon.ghost-fingerprint-generation/v1',
    source: ctx.source,
    rootId: ctx.source === 'root' ? ctx.request.rootId : ctx.request.fingerprintId,
    ...(ctx.source === 'catalog' ? {
      catalogId: ctx.request.fingerprintId,
      catalogName: ctx.catalogEntry.name,
    } : {}),
    product: ctx.product,
    surface: ctx.surface,
    gatheredNodes: sliceNodeIds(ctx.slice),
    baseDirectionId: ctx.baseDirectionId,
    styleSource: ctx.tokenSource.kind,
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
  const outputRuntime = options.outputRuntime ?? 'arrow-control';
  const htmlRuntime = runtimeProfile(outputRuntime).format === 'html';
  const toolNames = options.tools?.tools.map((tool) => tool.name) ?? [];
  const outputRule = htmlRuntime
    ? '- Return a structured HTML/CSS sandbox bundle through the `create_summon_html_surface` tool/schema. Do not emit Summon stream lines, transport records, Markdown, code fences, host-owned metadata, or Arrow source.'
    : '- Return a structured Arrow sandbox bundle through the `create_summon_arrow_surface` tool/schema. Do not emit Summon stream lines, transport records, Markdown, code fences, or host-owned metadata.';
  const successRule = htmlRuntime
    ? '- This generation succeeds only if the final HTML artifact is visually rich and recognizably faithful to the supplied Ghost fingerprint.'
    : '- This generation succeeds only if the final Arrow artifact is visually rich and recognizably faithful to the supplied Ghost fingerprint.';
  const details = [
    `Product: ${context.product}`,
    `Fingerprint surface: ${context.surface} (cascade: ${sliceCascade(context.slice)})`,
    `Gathered nodes: ${sliceProvenanceList(context.slice) || 'core'}`,
    `User request: ${oneLine(options.userPrompt, 600)}`,
    `Surface plan: purpose=${options.surfacePlan.purpose}; runtime=${options.surfacePlan.runtime}; data=${options.surfacePlan.data}; authority=${options.surfacePlan.authority}; persistence=${options.surfacePlan.persistence}`,
    `Output runtime: ${outputRuntime}`,
    `Mode: ${options.mode}`,
    toolNames.length > 0 ? `Granted host tools: ${toolNames.join(', ')}` : 'Granted host tools: none',
  ].filter((line): line is string => Boolean(line));

  return [
    '## Summon Surface Brief',
    '',
    'Treat the fingerprint above as a product design direction package for this Summon surface.',
    '',
    ...details.map((line) => `- ${line}`),
    '',
    'Generation rules:',
    '',
    '- Do not pause to inspect suggested files or ask the host for more Ghost context. Use the supplied Ghost fingerprint as the complete fingerprint entrypoint for this run.',
    outputRule,
    '',
    'Primary success criterion:',
    '',
    successRule,
    '- A technically valid but generic surface is a failed generation.',
    '- The user request is the semantic and task authority: satisfy its workflow, content, data need, and intended action before choosing decorative structure.',
    '- The Ghost fingerprint is the visual and composition authority: use it to decide product grammar, hierarchy, density, patterns, and anti-patterns without replacing the user task.',
    '- The Ghost fingerprint is the binding authority for composition, hierarchy, density, spacing rhythm, typography rhythm, surface grammar, motif vocabulary, tone, and anti-pattern boundaries.',
    '- Summon safety restricts APIs, host authority, and runtime behavior. It does not require bland UI.',
    '',
    'Fingerprint composition rules:',
    '',
    '- Compose from the fingerprint prose. The prose states the product grammar, material, and evidence; reuse its surface patterns.',
    '- Imitate the Ghost fingerprint’s visual grammar. Preserve its composition patterns, hierarchy, typography rhythm, density, surface treatment, motifs, and anti-pattern boundaries. Adapt content to the user request without genericizing the visual system.',
    '- Choose a fingerprint composition shell before authoring the artifact. The root `<main>` must express that shell through layout, spacing, hierarchy, and surface treatment.',
    '- The final artifact must include a composed outer shell, not unframed content. Avoid generic header-plus-card-grid layouts unless the fingerprint explicitly calls for that pattern.',
    '- Use Ghost-provided tokens, aliases, renderable primitives, and fingerprint examples as the visual source of truth. You may define local CSS variables that alias or compose Ghost tokens and use advanced safe CSS layout, transitions, transforms, inline SVG, and typographic tuning when fingerprint-compatible.',
    '- Do not invent unrelated colors, fonts, shadows, gradients, radii, or decorative motifs. Do not import external stylesheets, fonts, images, scripts, or URLs.',
    '- The agent broker controls host authority and tools. The fingerprint controls product direction, hierarchy, tone, and composition expectations.',
    '- Treat checks as validation constraints, not as content to render.',
  ].join('\n');
}

const PROVENANCE_RANK: Record<GraphSliceProvenance['kind'], number> = {
  own: 0,
  ancestor: 1,
  edge: 2,
};

function provenanceLabel(provenance: GraphSliceProvenance): string {
  switch (provenance.kind) {
    case 'own':
      return 'own';
    case 'ancestor':
      return `from \`${provenance.from}\``;
    case 'edge':
      return provenance.via
        ? `${provenance.via} \`${provenance.from}\``
        : `relates \`${provenance.from}\``;
  }
}

function sliceCascade(slice: GraphSlice): string {
  return slice.surface === GHOST_GRAPH_ROOT_ID && slice.ancestors.length === 0
    ? slice.surface
    : [slice.surface, ...slice.ancestors].join(' → ');
}

// Strip the fenced ```css block(s) from a node body: the token VALUES are
// already extracted into tokenSource.css / injected as activeTokensCss, so the
// prose should carry only the intent (no duplication). Tidy trailing blanks.
function renderSlicePrompt(slice: GraphSlice): string {
  const blocks: string[] = [
    '# Ghost Fingerprint',
    `Cascade: ${sliceCascade(slice)}`,
  ];
  // Provenance-ordered: own first, then ancestors, then edges (mirrors Ghost's
  // gather formatter). Spokes are omitted for Summon v1 (decision 2) — the model
  // cannot call back to expand them in a single generation.
  const ordered = [...slice.nodes].sort(
    (a, b) => PROVENANCE_RANK[a.provenance.kind] - PROVENANCE_RANK[b.provenance.kind],
  );
  for (const node of ordered) {
    // Keep the node body verbatim — including any fenced ```css token block.
    // The fingerprint prose is the ONLY place the model sees the token CSS:
    // activeTokensCss is consumed solely for validation (parseDefinedTokens) and
    // sandbox injection at render time, never rendered into the system prompt.
    // Stripping it here blinds the model to the token *names* and it invents its
    // own (e.g. --canvas instead of --color-bg). So the prose carries the values.
    const body = node.body.trim();
    if (!body) continue;
    blocks.push(`## ${node.id} — ${provenanceLabel(node.provenance)}`, body);
  }
  return blocks.join('\n\n');
}

function sliceNodeIds(slice: GraphSlice): string[] {
  return slice.nodes.map((node) => node.id);
}

function sliceProvenanceList(slice: GraphSlice): string {
  const ordered = [...slice.nodes].sort(
    (a, b) => PROVENANCE_RANK[a.provenance.kind] - PROVENANCE_RANK[b.provenance.kind],
  );
  return ordered
    .map((node) => `${node.id} (${node.provenance.kind})`)
    .join(', ');
}

const CSS_BLOCK_RE = /```css\n([\s\S]*?)```/g;

function extractSliceCss(slice: GraphSlice): string {
  const blocks: string[] = [];
  for (const node of slice.nodes) {
    for (const match of node.body.matchAll(CSS_BLOCK_RE)) {
      const css = match[1]?.trim();
      if (css) blocks.push(css);
    }
  }
  return blocks.join('\n\n');
}

function resolveGraphTokenSource(
  css: string,
  baseDirection: GhostBaseDirection | null,
): GhostTokenSource {
  return {
    kind: 'ghost-config',
    source: 'fingerprint:core',
    css,
    warnings: [],
    baseDirectionId: baseDirection?.id ?? null,
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
