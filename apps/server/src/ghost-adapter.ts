import {
  type ToolPack,
  type ProtocolLine,
  type SurfacePlan,
} from '@anarchitecture/summon/engine';
import {
  loadFingerprintPackage,
  resolveFingerprintPackage,
  type LoadedFingerprintPackage,
} from '@anarchitecture/ghost-fingerprint/fingerprint';
import {
  buildCatalogMenu,
  parseGlossary,
  type GhostCatalog,
} from '@anarchitecture/ghost-fingerprint/core';
import { readFile } from 'node:fs/promises';
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

/**
 * The fingerprint's front door: the `index` node is the curated entrypoint of
 * a flat-corpus Ghost package (the flat model has no root/cascade — `index` is
 * a convention, not a graph position). It anchors the brief when no other
 * node is selected.
 */
export const GHOST_FRONT_DOOR_ID = 'index';

/**
 * One check loaded from the fingerprint's `checks` haunt. Ghost does not
 * export this type from a public subpath, so it is derived from the loaded
 * package — the map value IS the integration contract.
 */
export type GhostLoadedCheck =
  LoadedFingerprintPackage['checks'] extends Map<string, infer C> ? C : never;

/**
 * Why a pulled node is in the context: the curated front door (`index`), the
 * semantically selected anchor (lead composition), or the rest of the flat
 * corpus. Summon pulls the whole corpus — vendored fingerprints are small and
 * the generator cannot call back mid-run to expand a menu — so "reason" labels
 * emphasis, not inclusion.
 */
export type GhostPullReason = 'front-door' | 'anchor' | 'corpus';

export interface PulledGhostNode {
  id: string;
  kind?: string;
  body: string;
  reason: GhostPullReason;
}

export interface GhostRootRequest {
  source: 'root';
  rootId: string;
  targetPath: string;
  /** Relative Ghost package directory under the trusted root. */
  packageDir: string | null;
  /** Backward-compatible alias for packageDir; accepted on input and mirrored in parsed requests. */
  memoryDir: string | null;
}

export interface GhostCatalogRequest {
  source: 'catalog';
  fingerprintId: string;
  targetPath: string;
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
}

export interface GhostGlossaryEntry {
  name: string;
  purpose: string;
}

interface BaseGhostSteer {
  /** The anchor node id — `index` by default, refined by semantic selection. */
  surface: string;
  /** The resolved `.ghost` package dir — kept for diagnostics/receipts. */
  packageDir: string;
  catalog: GhostCatalog;
  /** Package glossary categories and their meanings, surfaced for generation. */
  glossary: GhostGlossaryEntry[];
  /** Checks from the `checks` haunt (never part of the generation context). */
  checks: Map<string, GhostLoadedCheck>;
  /** The full corpus, pulled in prompt order (front door → anchor → corpus). */
  pulled: PulledGhostNode[];
  prompt: string;
  product: string;
  tokenSource: GhostTokenSource;
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
  /**
   * Utility-model completion for semantic anchor selection. When omitted, the
   * brief stays anchored at `index` (selection is an optional refinement).
   */
  completeText?: (request: TextCompletionRequest) => Promise<string>;
  surfaceSelectTimeoutMs?: number;
  signal?: AbortSignal;
  /**
   * Pre-selected anchor node id. When provided, `prepareGhostSurfacePrompt`
   * skips its own `selectGhostSurface` model call and uses this anchor directly.
   * The caller is responsible for having resolved it via `selectGhostSurface`
   * (e.g. running it concurrently with the agent ward to avoid a second
   * sequential model round-trip). Falls back to `completeText`-driven selection
   * when omitted.
   */
  preselectedSurface?: string;
}

export interface GhostReceiptValidation {
  blocked: number;
  warnings: number;
  codes: Record<string, number>;
}

export interface GhostReceiptGatheredNode {
  id: string;
  reason: GhostPullReason;
}

export interface GhostReceipt {
  schema: 'summon.ghost-receipt/v2';
  // --- spec-in ---
  fingerprint: {
    source: 'root' | 'catalog';
    id: string;
    name?: string;
    product: string;
    /** The anchor node id (`index` when no lead composition was selected). */
    surface: string;
    gatheredNodes: GhostReceiptGatheredNode[];
    tokenSource: {
      kind: GhostTokenSource['kind'];
      source: string;
      definedTokenCount: number;
      warnings: string[];
    };
    offeredChecks: Array<{ name: string; severity: string }>;
  };
  capability: {
    mode: 'static' | 'interactive';
    grantedTools: string[];
    layoutId: string | null;
  };
  // --- what-happened ---
  generation: {
    runtime: string;
    artifactRuntime: 'surface-document' | null;
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

  if (typeof obj.rootId !== 'string' || !ROOT_ID_RE.test(obj.rootId)) {
    return { ok: false, error: 'ghost.rootId must be a configured root id' };
  }
  if (!roots.has(obj.rootId)) {
    return { ok: false, error: `unknown Ghost root "${obj.rootId}"` };
  }

  const target = normalizeTargetPath(obj.targetPath);
  if (!target.ok) return { ok: false, error: target.error };

  let packageDir: string | null = null;
  const rawPackageDir = obj.packageDir !== undefined && obj.packageDir !== null && obj.packageDir !== ''
    ? obj.packageDir
    : obj.memoryDir;
  if (rawPackageDir !== undefined && rawPackageDir !== null && rawPackageDir !== '') {
    if (typeof rawPackageDir !== 'string') {
      return { ok: false, error: obj.packageDir !== undefined ? 'ghost.packageDir must be a string' : 'ghost.memoryDir must be a string' };
    }
    try {
      packageDir = normalizeGhostPackageDir(rawPackageDir, obj.packageDir !== undefined ? 'ghost.packageDir' : 'ghost.memoryDir');
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
      packageDir,
      memoryDir: packageDir,
    },
  };
}

export async function resolveGhostContext(
  request: GhostRootRequest,
  roots: GhostRoots,
): Promise<ResolvedRootGhostSteer> {
  return resolveGhostGenerationContext(request, roots);
}

export async function resolveGhostGenerationContext(
  request: GhostRootRequest,
  roots: GhostRoots,
): Promise<ResolvedRootGhostSteer> {
  const root = roots.get(request.rootId);
  if (!root) throw new Error(`unknown Ghost root "${request.rootId}"`);
  const targetAbs = resolve(root, request.targetPath);
  if (!isWithinOrEqual(root, targetAbs)) {
    throw new Error('ghost.targetPath must stay within the configured root');
  }

  const ghostDir = join(root, request.packageDir ?? request.memoryDir ?? '.ghost');
  const paths = resolveFingerprintPackage(ghostDir, process.cwd());
  const { catalog, checks } = await loadFingerprintPackage(paths);
  const glossary = await loadGhostGlossary(paths.glossary);
  const pulled = pullCorpus(catalog, GHOST_FRONT_DOOR_ID);

  const product = request.rootId;
  const css = extractCorpusCss(pulled);
  const tokenSource = resolveCorpusTokenSource(css);

  return {
    source: 'root',
    request,
    root,
    surface: GHOST_FRONT_DOOR_ID,
    packageDir: paths.packageDir,
    catalog,
    glossary,
    checks,
    pulled,
    prompt: renderCorpusPrompt(pulled, GHOST_FRONT_DOOR_ID, glossary),
    product,
    tokenSource,
  };
}

export async function resolveCatalogGhostGenerationContext(
  request: FingerprintRequest,
  catalog: FingerprintCatalog,
): Promise<ResolvedCatalogGhostSteer> {
  const entry = catalog.byId.get(request.id);
  if (!entry) throw new Error(`unknown fingerprint "${request.id}"`);

  const paths = resolveFingerprintPackage(entry.ghostDir, process.cwd());
  const { catalog: nodeCatalog, checks } = await loadFingerprintPackage(paths);
  const glossary = await loadGhostGlossary(paths.glossary);
  const pulled = pullCorpus(nodeCatalog, GHOST_FRONT_DOOR_ID);

  const product = entry.name || request.id;
  const css = extractCorpusCss(pulled);
  const tokenSource = resolveCorpusTokenSource(css);
  if (!css.trim()) {
    tokenSource.warnings.push(`Fingerprint "${request.id}" .ghost has no token css block`);
  }

  return {
    source: 'catalog',
    request: {
      source: 'catalog',
      fingerprintId: request.id,
      targetPath: request.targetPath,
    },
    catalogEntry: entry,
    root: entry.root,
    surface: GHOST_FRONT_DOOR_ID,
    packageDir: paths.packageDir,
    catalog: nodeCatalog,
    glossary,
    checks,
    pulled,
    prompt: renderCorpusPrompt(pulled, GHOST_FRONT_DOOR_ID, glossary),
    product,
    tokenSource,
  };
}

export async function prepareGhostSurfacePrompt(
  context: ResolvedGhostSteer,
  options: GhostSurfacePromptOptions,
): Promise<ResolvedGhostSteer> {
  // Anchor selection happens at prepare-time (prompt + catalog are both
  // available here). The resolve fns default to `index`; this refines the
  // choice once the user prompt is known. Selection is semantic (model-driven
  // over the gather menu) and optional — without a `completeText` it stays at
  // `index`. Summon pulls the WHOLE corpus either way: the anchor only hoists
  // the lead composition node, it never changes what the generator sees, so
  // the token CSS is anchor-independent by construction.
  let resolved = context;
  const chosen = options.preselectedSurface !== undefined
    ? validatePreselectedSurface(context.catalog, options.preselectedSurface)
    : await selectGhostSurface(context.catalog, options.userPrompt, {
        completeText: options.completeText,
        timeoutMs: options.surfaceSelectTimeoutMs,
        signal: options.signal,
      });
  if (chosen !== context.surface) {
    const pulled = pullCorpus(context.catalog, chosen);
    resolved = {
      ...context,
      surface: chosen,
      pulled,
      prompt: renderCorpusPrompt(pulled, chosen, context.glossary),
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
   * selection is skipped entirely and the brief stays anchored at `index` —
   * anchor choice is an optional refinement, never a required gate.
   */
  completeText?: (request: TextCompletionRequest) => Promise<string>;
  timeoutMs?: number;
  signal?: AbortSignal;
}

const SURFACE_SELECT_TIMEOUT_MS = 8000;

const SURFACE_SELECT_SYSTEM_PROMPT = [
  'You pick the single best-fitting composition node for a UI generation',
  'request against a design fingerprint. You are given the user request and a',
  'menu of candidate nodes (id + a one-line "reach when" description). Pick',
  'the one id whose description best matches what the user is asking to build.',
  'Prefer a concrete node whenever one plausibly fits — it only focuses the',
  'lead composition; the generator still sees the full fingerprint corpus, so',
  'a confident-but-imperfect pick is better than defaulting to the front door.',
  'Answer "index" only when the request is genuinely generic or truly matches',
  'no node. Answer with ONLY the chosen id, nothing else.',
].join(' ');

/**
 * Semantic anchor selection — the host hands Ghost's gather menu to the model
 * and lets it pick the anchoring node, exactly as Ghost intends ("the agent
 * matches a natural-language ask against descriptions and picks; Ghost does no
 * NLP and no selection"). Summon does not re-implement that matching in code.
 *
 * Selection is an *optional refinement*, never a gate:
 * - single-node (only `index`) corpora always return `index` with no model call;
 * - no `completeText` provided → no model call, returns `index`;
 * - any timeout, error, empty, or out-of-menu answer → falls back to `index`.
 *
 * Falling back to `index` is safe by construction: Summon pulls the whole flat
 * corpus regardless of anchor — the model still sees everything, just without
 * a hoisted lead composition. The anchor labels emphasis, nothing else.
 */
export async function selectGhostSurface(
  catalog: GhostCatalog,
  prompt: string,
  options: SelectGhostSurfaceOptions = {},
): Promise<string> {
  const menu = buildCatalogMenu(catalog);
  const candidates = menu.filter((entry) => entry.id !== GHOST_FRONT_DOOR_ID);
  if (candidates.length === 0) return GHOST_FRONT_DOOR_ID;

  const { completeText } = options;
  if (!completeText) return GHOST_FRONT_DOOR_ID;

  const menuText = candidates
    .map((entry) => `- ${entry.id}: ${entry.description ?? '(no description)'}`)
    .join('\n');
  const userPrompt = [
    `User request:\n${prompt.trim()}`,
    '',
    `Candidate nodes:\n${menuText}\n- index: the curated front door; pick this when no node clearly fits.`,
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
    const chosen = raw.trim().toLowerCase().split(/[^a-z0-9._/-]+/)[0] ?? '';
    if (chosen === GHOST_FRONT_DOOR_ID || chosen === '') return GHOST_FRONT_DOOR_ID;
    return candidates.some((entry) => entry.id === chosen) ? chosen : GHOST_FRONT_DOOR_ID;
  } catch {
    return GHOST_FRONT_DOOR_ID;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onAbort);
  }
}

/**
 * Validate a caller-supplied anchor id against the catalog menu. Accepts
 * `index` and any catalog node; an unknown id falls back to `index`. Mirrors
 * the out-of-menu guard in `selectGhostSurface` so a pre-resolved anchor is
 * held to the same contract as a freshly selected one.
 */
function validatePreselectedSurface(catalog: GhostCatalog, surfaceId: string): string {
  if (surfaceId === GHOST_FRONT_DOOR_ID) return GHOST_FRONT_DOOR_ID;
  return catalog.nodes.has(surfaceId) ? surfaceId : GHOST_FRONT_DOOR_ID;
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
    gatheredNodes: ctx.pulled.map((node) => node.id),
    styleSource: ctx.tokenSource.kind,
  };
}

export function ghostTokenSourceMeta(tokenSource: GhostTokenSource) {
  return {
    kind: tokenSource.kind,
    source: tokenSource.source,
    css: tokenSource.css,
    warnings: tokenSource.warnings,
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
    schema: 'summon.ghost-receipt/v2',
    fingerprint: {
      source: ctx.source,
      id: ctx.source === 'root' ? ctx.request.rootId : ctx.request.fingerprintId,
      ...(ctx.source === 'catalog' ? { name: ctx.catalogEntry.name } : {}),
      product: ctx.product,
      surface: ctx.surface,
      gatheredNodes: ctx.pulled.map((node) => ({
        id: node.id,
        reason: node.reason,
      })),
      tokenSource: {
        kind: ctx.tokenSource.kind,
        source: ctx.tokenSource.source,
        definedTokenCount: countDefinedTokens(ctx.tokenSource.css),
        warnings: ctx.tokenSource.warnings,
      },
      offeredChecks: conformance.checks.map((check) => ({
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
      artifactRuntime: artifactFiles.length > 0 ? 'surface-document' : null,
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
  const toolNames = options.tools?.tools.map((tool) => tool.name) ?? [];
  const outputRule = '- Return a structured Surface Document bundle through the `emit_surface_document` tool/schema. Do not emit Summon stream lines, transport records, Markdown, code fences, or host-owned metadata.';
  const successRule = '- This generation succeeds only if the final Surface Document artifact is visually rich and recognizably faithful to the supplied Ghost fingerprint.';
  const details = [
    `Product: ${context.product}`,
    `Fingerprint anchor: ${context.surface}${context.surface === GHOST_FRONT_DOOR_ID ? ' (front door)' : ' (lead composition)'}`,
    `Gathered nodes: ${pulledNodeList(context.pulled) || GHOST_FRONT_DOOR_ID}`,
    `User request: ${oneLine(options.userPrompt, 600)}`,
    `Surface plan: purpose=${options.surfacePlan.purpose}; runtime=${options.surfacePlan.runtime}; data=${options.surfacePlan.data}; authority=${options.surfacePlan.authority}; persistence=${options.surfacePlan.persistence}`,
    'Output runtime: surface-document',
    `Mode: ${options.mode}`,
    toolNames.length > 0 ? `Granted host tools: ${toolNames.join(', ')}` : 'Granted host tools: none',
  ].filter((line): line is string => Boolean(line));

  // The differentiating content: this fingerprint's signature moves (mandatory,
  // brand-defining), injected regardless of the anchor so an `index` anchor is
  // never a generic base. Composition itself is authored entirely in the
  // fingerprint's own front-door prose (the grammar) and building-block nodes
  // (the composable vocabulary) rendered verbatim above — Summon injects NO
  // composition voice of its own, so distinct fingerprints cannot collapse to a
  // shared Summon-authored layout.
  const signatureBlock = buildSignatureMovesBlock(context.catalog);

  return [
    '## Summon Surface Brief',
    '',
    'Treat the fingerprint above as a product design direction package for this Summon surface.',
    '',
    ...details.map((line) => `- ${line}`),
    ...(signatureBlock ? ['', signatureBlock] : []),
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
    '- The user request is the semantic and task authority: satisfy its workflow, content, data need, and intended action before choosing structure.',
    '- The Ghost fingerprint is the sole composition authority: its front-door (`index`) prose states how this language composes a surface, and its building-block nodes are the parts you compose from. Follow them; do not substitute a generic layout of your own.',
    '- Summon safety restricts APIs, host authority, and runtime behavior. It does not require bland UI, and it has no opinion about how the surface should look.',
    '',
    'Authoring mechanics (design-neutral):',
    '',
    '- Use only the fingerprint-provided tokens, aliases, and primitives as the visual source of truth. You may define local CSS variables that alias or compose those tokens and use safe CSS layout, transitions, transforms, inline SVG, and typographic tuning when fingerprint-compatible.',
    '- Do not import external stylesheets, fonts, images, scripts, or URLs.',
    '- The agent ward controls host authority and tools; the fingerprint controls all product direction, hierarchy, tone, and composition.',
    '- Treat checks as validation constraints, not as content to render.',
  ].join('\n');
}

/**
 * The fingerprint's brand-defining "Signature look & feel" moves, extracted
 * verbatim from the front-door (`index`) node's `## Signature look & feel`
 * section and voiced as mandatory requirements for THIS run. Generic "don't be
 * generic" instructions do not prevent generic output; naming the fingerprint's
 * own unmistakable moves as must-haves does. Returns '' when the fingerprint
 * has no signature section (older packages) so the brief degrades gracefully.
 */
function buildSignatureMovesBlock(catalog: GhostCatalog): string {
  const frontDoor = catalog.nodes.get(GHOST_FRONT_DOOR_ID);
  if (!frontDoor?.body) return '';
  const section = extractMarkdownSection(frontDoor.body, 'Signature look & feel');
  if (!section) return '';
  return [
    'Signature moves — non-negotiable for this fingerprint:',
    '',
    'These are the moves that make this fingerprint unmistakable. Reproduce them; do not soften them into a generic layout. If the surface does not visibly carry these, it is the wrong fingerprint.',
    '',
    section.trim(),
  ].join('\n');
}

/** Extract a `## <title>` section body from a markdown document (stops at the
 * next `## ` heading). Returns null when the section is absent. */
function extractMarkdownSection(markdown: string, title: string): string | null {
  const lines = markdown.split(/\r?\n/);
  const headingRe = new RegExp(`^#{2,3}\\s+${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headingRe.test(lines[i]!)) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return null;
  const collected: string[] = [];
  for (let i = start; i < lines.length; i++) {
    if (/^#{2,3}\s+/.test(lines[i]!)) break;
    collected.push(lines[i]!);
  }
  const body = collected.join('\n').trim();
  return body || null;
}

/**
 * Pull the whole flat corpus in prompt order: front door first, the anchor
 * hoisted second (when it is a distinct node), then the rest sorted by id.
 * Ghost's contract is agent-side selection over the gather menu; for Summon's
 * vendored fingerprints (small, curated corpora feeding a single-shot
 * generation that cannot call back to pull more) selecting EVERYTHING is the
 * fidelity-preserving choice — it matches what the old core slice carried.
 */
function pullCorpus(catalog: GhostCatalog, anchor: string): PulledGhostNode[] {
  const pulled: PulledGhostNode[] = [];
  const push = (id: string, reason: GhostPullReason) => {
    const node = catalog.nodes.get(id);
    if (!node || !node.body.trim()) return;
    pulled.push({
      id: node.id,
      ...(node.kind !== undefined ? { kind: node.kind } : {}),
      body: node.body,
      reason,
    });
  };

  push(GHOST_FRONT_DOOR_ID, 'front-door');
  if (anchor !== GHOST_FRONT_DOOR_ID) push(anchor, 'anchor');
  const rest = [...catalog.nodes.keys()]
    .filter((id) => id !== GHOST_FRONT_DOOR_ID && id !== anchor)
    .sort((a, b) => a.localeCompare(b));
  for (const id of rest) push(id, 'corpus');
  return pulled;
}

function reasonLabel(node: PulledGhostNode): string {
  switch (node.reason) {
    case 'front-door':
      return 'front door';
    case 'anchor':
      return 'lead composition';
    case 'corpus':
      return node.kind ? `(${node.kind})` : '';
  }
}

function renderCorpusPrompt(
  pulled: PulledGhostNode[],
  anchor: string,
  glossary: GhostGlossaryEntry[] = [],
): string {
  const blocks: string[] = [
    '# Ghost Fingerprint',
    `Anchor: ${anchor}`,
  ];
  const glossaryBlock = renderGlossaryPrompt(glossary);
  if (glossaryBlock) blocks.push(glossaryBlock);
  for (const node of pulled) {
    // Keep the node body verbatim — including any fenced ```css token block.
    // The fingerprint prose is the ONLY place the model sees the token CSS:
    // activeTokensCss is consumed solely for validation (parseDefinedTokens) and
    // sandbox injection at render time, never rendered into the system prompt.
    // Stripping it here blinds the model to the token *names* and it invents its
    // own (e.g. --canvas instead of --color-bg). So the prose carries the values.
    const body = node.body.trim();
    if (!body) continue;
    const label = reasonLabel(node);
    blocks.push(label ? `## ${node.id} — ${label}` : `## ${node.id}`, body);
  }
  return blocks.join('\n\n');
}

function pulledNodeList(pulled: PulledGhostNode[]): string {
  return pulled
    .map((node) => `${node.id} (${node.reason})`)
    .join(', ');
}

function renderGlossaryPrompt(glossary: GhostGlossaryEntry[]): string {
  const entries = glossary
    .filter((entry) => entry.name.trim().length > 0)
    .map((entry) => {
      const purpose = entry.purpose.replace(/\s+/g, ' ').trim();
      return `- **${entry.name}**${purpose ? ` — ${purpose}` : ''}`;
    });
  if (entries.length === 0) return '';
  return ['## Fingerprint glossary', '', ...entries].join('\n');
}

async function loadGhostGlossary(path: string): Promise<GhostGlossaryEntry[]> {
  try {
    const raw = await readFile(path, 'utf-8');
    const result = parseGlossary(raw);
    if (result.glossary === null) return [];
    return result.glossary.categories.map((category) => ({
      name: category.name,
      purpose: category.purpose,
    }));
  } catch {
    return [];
  }
}

const CSS_BLOCK_RE = /```css\n([\s\S]*?)```/g;

/**
 * Extract fenced ```css blocks across the pulled corpus for deterministic
 * token injection. Extraction order follows pull order but is normalized to
 * front door → id order (never anchor-hoisted), so the resulting CSS — and
 * therefore last-write-wins token resolution — is stable regardless of which
 * anchor was selected for the run.
 */
function extractCorpusCss(pulled: PulledGhostNode[]): string {
  const ordered = [...pulled].sort((a, b) => {
    const aFront = a.reason === 'front-door' ? 0 : 1;
    const bFront = b.reason === 'front-door' ? 0 : 1;
    return aFront - bFront || a.id.localeCompare(b.id);
  });
  const blocks: string[] = [];
  for (const node of ordered) {
    for (const match of node.body.matchAll(CSS_BLOCK_RE)) {
      const css = match[1]?.trim();
      if (css) blocks.push(css);
    }
  }
  return blocks.join('\n\n');
}

function resolveCorpusTokenSource(css: string): GhostTokenSource {
  return {
    kind: 'ghost-config',
    source: 'fingerprint:index',
    css,
    warnings: [],
  };
}

function normalizeGhostPackageDir(raw: string, label: 'ghost.packageDir' | 'ghost.memoryDir'): string {
  const normalized = raw.trim().replaceAll('\\', '/').replace(/\/+/g, '/').replace(/\/$/g, '');
  if (!normalized || normalized === '.') return '.ghost';
  if (normalized.startsWith('/') || isAbsolute(normalized) || /^[A-Za-z]:/.test(normalized)) {
    throw new Error(`${label} must be relative`);
  }
  const segments = normalized.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new Error(`${label} must not contain path traversal segments`);
  }
  return segments.join('/');
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
    if (value?.runtime !== 'surface-document' || !value.source || typeof value.source !== 'object' || Array.isArray(value.source)) {
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
