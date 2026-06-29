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
  type FingerprintCatalog,
  type FingerprintCatalogEntry,
  type FingerprintRequest,
} from './fingerprint-catalog.js';
import type {
  ConformanceSummary,
  ConformanceVerdict,
  ConformanceVerdictValue,
} from './ghost-conformance.js';
import type { TextCompletionRequest } from './model-providers.js';

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
  /** The resolved `.ghost` package dir — routing input for step-5 conformance. */
  packageDir: string;
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
  /**
   * Utility-model completion for semantic surface selection. When omitted, the
   * slice stays anchored at `core` (selection is an optional refinement).
   */
  completeText?: (request: TextCompletionRequest) => Promise<string>;
  surfaceSelectTimeoutMs?: number;
  signal?: AbortSignal;
}

export interface GhostReceiptValidation {
  blocked: number;
  warnings: number;
  codes: Record<string, number>;
}

export interface GhostReceiptGatheredNode {
  id: string;
  provenance: GraphSliceProvenance['kind'];
}

export interface GhostReceipt {
  schema: 'summon.ghost-receipt/v1';
  // --- spec-in ---
  fingerprint: {
    source: 'root' | 'catalog';
    id: string;
    name?: string;
    product: string;
    surface: string;
    cascade: string[];
    gatheredNodes: GhostReceiptGatheredNode[];
    tokenSource: {
      kind: GhostTokenSource['kind'];
      source: string;
      definedTokenCount: number;
      warnings: string[];
    };
    routedChecks: Array<{ name: string; severity: string }>;
  };
  capability: {
    mode: 'static' | 'interactive';
    grantedTools: string[];
    layoutId: string | null;
  };
  // --- what-happened ---
  generation: {
    runtime: string;
    artifactRuntime: 'arrow' | null;
    artifactFiles: string[];
    repairs: number;
    blocked: boolean;
    validation: GhostReceiptValidation;
    safetyViolations: string[];
  };
  conformance: {
    evaluated: boolean;
    summary: ConformanceSummary;
    checks: Array<{
      name: string;
      severity: string;
      verdict: ConformanceVerdictValue;
      reason: string;
    }>;
  };
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
    packageDir: paths.packageDir,
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
  const tokenSource = resolveGraphTokenSource(css, baseDirection);
  if (!css.trim()) {
    tokenSource.warnings.push(`Fingerprint "${request.id}" .ghost has no token css block`);
  }

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
    packageDir: paths.packageDir,
    graph,
    slice,
    prompt: renderSlicePrompt(slice),
    product,
    tokenSource,
    baseDirectionId: baseDirection?.id ?? request.baseDirectionId ?? null,
  };
}

export async function prepareGhostSurfacePrompt(
  context: ResolvedGhostSteer,
  options: GhostSurfacePromptOptions,
): Promise<ResolvedGhostSteer> {
  // Surface selection happens at prepare-time (both prompt + graph are
  // available here). The resolve fns default to `core`; this refines the choice
  // once the user prompt is known. Selection is semantic (model-driven over the
  // gather menu) and optional — without a `completeText` it stays at `core`.
  let resolved = context;
  const chosen = await selectGhostSurface(context.graph, options.userPrompt, {
    completeText: options.completeText,
    timeoutMs: options.surfaceSelectTimeoutMs,
    signal: options.signal,
  });
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

export interface SelectGhostSurfaceOptions {
  /**
   * Utility-model text completion (same path conformance uses). When absent,
   * selection is skipped entirely and the slice stays anchored at `core` —
   * surface choice is an optional refinement, never a required gate.
   */
  completeText?: (request: TextCompletionRequest) => Promise<string>;
  timeoutMs?: number;
  signal?: AbortSignal;
}

const SURFACE_SELECT_TIMEOUT_MS = 4000;

const SURFACE_SELECT_SYSTEM_PROMPT = [
  'You route a UI generation request to the single best-fitting surface of a',
  'design fingerprint. You are given the user request and a menu of candidate',
  'surfaces (id + a one-line "reach when" description). Pick the one id whose',
  'description best matches what the user is asking to build. If none clearly',
  'fits, or several fit equally, answer "core" to let the generator use the',
  'shared base. Answer with ONLY the chosen id, nothing else.',
].join(' ');

/**
 * Semantic surface selection — the host hands Ghost's gather menu to the model
 * and lets it pick the anchoring surface, exactly as Ghost intends ("the agent
 * matches a natural-language ask against descriptions and picks; Ghost does no
 * NLP"). Summon does not re-implement that matching in code.
 *
 * Selection is an *optional refinement*, never a gate:
 * - single-surface (only `core`) graphs always return `core` with no model call;
 * - no `completeText` provided → no model call, returns `core`;
 * - any timeout, error, empty, or out-of-menu answer → falls back to `core`.
 *
 * Falling back to `core` is safe by construction: `core` is always on the spine,
 * so its slice carries the full shared material and spoke pointers to every
 * surface — the model still sees everything, just unfocused. The directory
 * walls do the slice composition; this only chooses where to anchor.
 */
export async function selectGhostSurface(
  graph: GhostGraph,
  prompt: string,
  options: SelectGhostSurfaceOptions = {},
): Promise<string> {
  const menu = buildGraphMenu(graph);
  const candidates = menu.filter((entry) => entry.id !== GHOST_GRAPH_ROOT_ID);
  if (candidates.length === 0) return GHOST_GRAPH_ROOT_ID;

  const { completeText } = options;
  if (!completeText) return GHOST_GRAPH_ROOT_ID;

  const menuText = candidates
    .map((entry) => `- ${entry.id}: ${entry.description ?? '(no description)'}`)
    .join('\n');
  const userPrompt = [
    `User request:\n${prompt.trim()}`,
    '',
    `Candidate surfaces:\n${menuText}\n- core: the shared base; pick this when no surface clearly fits.`,
    '',
    'Chosen id:',
  ].join('\n');

  const timeoutMs = options.timeoutMs ?? SURFACE_SELECT_TIMEOUT_MS;
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const raw = await completeText({
      system: SURFACE_SELECT_SYSTEM_PROMPT,
      prompt: userPrompt,
      maxTokens: 32,
      temperature: 0,
      signal: controller.signal,
    });
    const chosen = raw.trim().toLowerCase().split(/[^a-z0-9._-]+/)[0] ?? '';
    if (chosen === GHOST_GRAPH_ROOT_ID || chosen === '') return GHOST_GRAPH_ROOT_ID;
    return candidates.some((entry) => entry.id === chosen) ? chosen : GHOST_GRAPH_ROOT_ID;
  } catch {
    return GHOST_GRAPH_ROOT_ID;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onAbort);
  }
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

const DEFINED_TOKEN_RE = /--[a-z0-9-]+\s*:/gi;

function countDefinedTokens(css: string): number {
  const matches = css.match(DEFINED_TOKEN_RE);
  return matches ? matches.length : 0;
}

export function buildGhostReceipt(input: {
  context: ResolvedGhostContext;
  mode: 'static' | 'interactive';
  layoutId: string | null;
  grantedTools: string[];
  validation: GhostReceiptValidation;
  acceptedLines: ProtocolLine[];
  runtime: string;
  repairs: number;
  blocked: boolean;
  safetyViolations: string[];
  conformance: ConformanceVerdict;
}): GhostReceipt {
  const artifactFiles = artifactFilesFromLines(input.acceptedLines);
  const ctx = input.context;
  const conformance = input.conformance;
  return {
    schema: 'summon.ghost-receipt/v1',
    fingerprint: {
      source: ctx.source,
      id: ctx.source === 'root' ? ctx.request.rootId : ctx.request.fingerprintId,
      ...(ctx.source === 'catalog' ? { name: ctx.catalogEntry.name } : {}),
      product: ctx.product,
      surface: ctx.surface,
      cascade: [ctx.surface, ...ctx.slice.ancestors],
      gatheredNodes: ctx.slice.nodes.map((node) => ({
        id: node.id,
        provenance: node.provenance.kind,
      })),
      tokenSource: {
        kind: ctx.tokenSource.kind,
        source: ctx.tokenSource.source,
        definedTokenCount: countDefinedTokens(ctx.tokenSource.css),
        warnings: ctx.tokenSource.warnings,
      },
      routedChecks: conformance.checks.map((check) => ({
        name: check.name,
        severity: check.severity,
      })),
    },
    capability: {
      mode: input.mode,
      grantedTools: input.grantedTools,
      layoutId: input.layoutId,
    },
    generation: {
      runtime: input.runtime,
      artifactRuntime: artifactFiles.length > 0 ? 'arrow' : null,
      artifactFiles,
      repairs: input.repairs,
      blocked: input.blocked,
      validation: input.validation,
      safetyViolations: input.safetyViolations,
    },
    conformance: {
      evaluated: conformance.evaluated,
      summary: conformance.summary,
      checks: conformance.checks.map((check) => ({
        name: check.name,
        severity: check.severity,
        verdict: check.verdict,
        reason: check.reason,
      })),
    },
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
