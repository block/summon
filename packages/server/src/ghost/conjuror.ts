import {
  type ToolPack,
  type SurfacePlan,
} from '@summon-internal/engine';
import {
  buildCatalogMenu,
  type GhostCatalog,
} from '@decentralized-design/ghost/core';
import type { TextCompletionRequest } from '../types.js';

/**
 * The fingerprint's front door: the `index` node is the curated entrypoint of
 * a flat-corpus Ghost package (the flat model has no root/cascade — `index` is
 * a convention, not a graph position). It anchors the brief when no other
 * node is selected.
 */
export const GHOST_FRONT_DOOR_ID = 'index';

/**
 * Why a pulled node is in the context. Compiled packets still use the existing
 * pull reasons so receipts and older diagnostics keep their meaning.
 */
export type GhostPullReason = 'front-door' | 'anchor' | 'corpus';

export interface PulledGhostNode {
  id: string;
  kind?: string;
  body: string;
  reason: GhostPullReason;
}

export interface GhostGlossaryEntry {
  name: string;
  purpose: string;
}

export type GhostGatherStrategy = 'full-corpus' | 'compiled';
export type ConjurorStrategy = GhostGatherStrategy;
export type GhostGatherStrategyOption = 'auto' | GhostGatherStrategy;
export type ConjurorStrategyOption = GhostGatherStrategyOption;

export interface GhostGatherSelectedNode {
  id: string;
  reason: string;
  pullReason: GhostPullReason;
  kind?: string;
}

export type ConjurorSelectedNode = GhostGatherSelectedNode;

export interface GhostGatherExcludedNode {
  id: string;
  reason: string;
}

export type ConjurorExcludedNode = GhostGatherExcludedNode;

export interface GhostGatherAuthorityEntry {
  id: string;
  reason: string;
}

export type ConjurorAuthorityEntry = GhostGatherAuthorityEntry;

export interface GhostGatherPacket {
  schema: 'summon.ghost-gather/v1';
  strategy: GhostGatherStrategy;
  selectedNodes: GhostGatherSelectedNode[];
  excludedNodes: GhostGatherExcludedNode[];
  authorityStack: GhostGatherAuthorityEntry[];
  warnings: string[];
}
export type ConjurorPacket = GhostGatherPacket;

export interface ConjurorCompileOptions {
  userPrompt: string;
  mode: 'static' | 'interactive';
  surfacePlan: SurfacePlan;
  tools?: ToolPack | null;
  completeText?: (request: TextCompletionRequest) => Promise<string>;
  surfaceSelectTimeoutMs?: number;
  signal?: AbortSignal;
  preselectedSurface?: string;
  strategy?: ConjurorStrategyOption;
  fullPullNodeLimit?: number;
  maxNodes?: number;
  maxSupportNodes?: number;
  maxChars?: number;
}

export interface CompiledConjurorContext {
  surface: string;
  pulled: PulledGhostNode[];
  prompt: string;
  packet: ConjurorPacket;
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
const DEFAULT_FULL_PULL_NODE_LIMIT = 12;
const DEFAULT_MAX_NODES = 8;
const DEFAULT_MAX_SUPPORT_NODES = 6;
const DEFAULT_MAX_CHARS = 24_000;

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

const CONJUROR_SELECT_SYSTEM_PROMPT = [
  'You are Conjuror, a host-side Ghost context selector for Summon. Select a',
  'small authority packet from one flat Ghost fingerprint catalog. Return JSON',
  'only. The host will validate every id. Do not invent ids. Checks and haunts',
  'are not in this menu and must not be requested. Select one lead composition',
  'id and up to the requested number of support ids. The host always includes',
  'the index and token CSS nodes, so do not use support slots for them unless',
  'they are truly the best lead.',
].join(' ');

interface SelectorResult {
  leadId: string | null;
  supportIds: string[];
  excludedNodes: ConjurorExcludedNode[];
  warnings: string[];
  usedFallback: boolean;
}

/**
 * Compile the Ghost fingerprint prompt for a Summon run. Small corpora keep
 * the historical full-corpus behavior. Larger corpora select a host-validated
 * authority packet while preserving selected node bodies verbatim.
 */
export async function compileConjurorContext(
  catalog: GhostCatalog,
  glossary: GhostGlossaryEntry[],
  options: ConjurorCompileOptions,
): Promise<CompiledConjurorContext> {
  const strategy = resolveStrategy(catalog, options);
  if (strategy === 'full-corpus') {
    const surface = options.preselectedSurface !== undefined
      ? validateSurface(catalog, options.preselectedSurface)
      : await selectGhostSurface(catalog, options.userPrompt, {
          completeText: options.completeText,
          timeoutMs: options.surfaceSelectTimeoutMs,
          signal: options.signal,
        });
    const pulled = pullCorpus(catalog, surface);
    return {
      surface,
      pulled,
      prompt: renderCorpusPrompt(pulled, surface, glossary),
      packet: buildPacket('full-corpus', pulled, []),
    };
  }

  const compiled = await compileSelectedPacket(catalog, glossary, options);
  return compiled;
}

/**
 * Semantic anchor selection — the host hands Ghost's gather menu to the model
 * and lets it pick the anchoring node. Selection is optional and never gates
 * generation: no model, timeout, error, empty, or out-of-menu answer all fall
 * back to `index`.
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
 * `index` and any catalog node; an unknown id falls back to `index`.
 */
export function validateSurface(catalog: GhostCatalog, surfaceId: string): string {
  if (surfaceId === GHOST_FRONT_DOOR_ID) return GHOST_FRONT_DOOR_ID;
  return catalog.nodes.has(surfaceId) ? surfaceId : GHOST_FRONT_DOOR_ID;
}

/**
 * Pull the whole flat corpus in prompt order: front door first, the anchor
 * hoisted second (when it is a distinct node), then the rest sorted by id.
 */
export function pullCorpus(catalog: GhostCatalog, anchor: string): PulledGhostNode[] {
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

export function renderCorpusPrompt(
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
    const body = node.body.trim();
    if (!body) continue;
    const label = reasonLabel(node);
    blocks.push(label ? `## ${node.id} — ${label}` : `## ${node.id}`, body);
  }
  return blocks.join('\n\n');
}

const CSS_BLOCK_RE = /```css\n([\s\S]*?)```/g;

/**
 * Extract fenced ```css blocks across the pulled corpus for deterministic
 * token injection. Extraction order follows front door → id order, not anchor
 * hoisting, so last-write-wins token resolution is stable.
 */
export function extractCorpusCss(pulled: PulledGhostNode[]): string {
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

function resolveStrategy(catalog: GhostCatalog, options: ConjurorCompileOptions): ConjurorStrategy {
  const requested = options.strategy ?? 'auto';
  if (requested === 'full-corpus' || requested === 'compiled') return requested;
  const limit = boundedInt(options.fullPullNodeLimit, 0, 10_000, DEFAULT_FULL_PULL_NODE_LIMIT);
  return catalog.nodes.size <= limit ? 'full-corpus' : 'compiled';
}

async function compileSelectedPacket(
  catalog: GhostCatalog,
  glossary: GhostGlossaryEntry[],
  options: ConjurorCompileOptions,
): Promise<CompiledConjurorContext> {
  const warnings: string[] = [];
  const maxNodes = boundedInt(options.maxNodes, 1, 200, DEFAULT_MAX_NODES);
  const maxSupportNodes = boundedInt(options.maxSupportNodes, 0, 200, DEFAULT_MAX_SUPPORT_NODES);
  const maxChars = boundedInt(options.maxChars, 1_000, 2_000_000, DEFAULT_MAX_CHARS);
  const cssIds = tokenCssNodeIds(catalog);
  const selector = await selectCompiledNodes(catalog, options, maxSupportNodes);
  warnings.push(...selector.warnings);

  const selectedIds: string[] = [];
  const selectedReasons = new Map<string, string>();
  const pushSelected = (id: string, reason: string, mandatory = false) => {
    if (!catalog.nodes.has(id)) return;
    if (!mandatory && selectedIds.length >= maxNodes) return;
    if (!selectedIds.includes(id)) selectedIds.push(id);
    if (!selectedReasons.has(id)) selectedReasons.set(id, reason);
  };

  pushSelected(GHOST_FRONT_DOOR_ID, 'front door', true);
  if (selector.leadId && selector.leadId !== GHOST_FRONT_DOOR_ID) {
    pushSelected(selector.leadId, selector.usedFallback ? 'heuristic lead composition' : 'selector lead composition', true);
  }
  for (const id of cssIds) pushSelected(id, 'token CSS authority', true);

  const supportBudget = Math.max(0, Math.min(maxSupportNodes, maxNodes - selectedIds.length));
  let supportAdded = 0;
  for (const id of selector.supportIds) {
    if (supportAdded >= supportBudget) break;
    if (selectedIds.includes(id)) continue;
    pushSelected(id, selector.usedFallback ? 'heuristic support' : 'selector support');
    supportAdded += 1;
  }

  const pulled = buildCompiledPulled(catalog, selectedIds, selector.leadId);
  const capped = capPulledByChars(pulled, selector.leadId, glossary, maxChars, warnings);
  const surface = capped.some((node) => node.id === selector.leadId)
    ? selector.leadId ?? GHOST_FRONT_DOOR_ID
    : GHOST_FRONT_DOOR_ID;
  const finalPulled = surface === selector.leadId ? capped : relabelPulled(capped, GHOST_FRONT_DOOR_ID);

  return {
    surface,
    pulled: finalPulled,
    prompt: renderCorpusPrompt(finalPulled, surface, glossary),
    packet: buildPacket('compiled', finalPulled, selector.excludedNodes, selectedReasons, warnings),
  };
}

async function selectCompiledNodes(
  catalog: GhostCatalog,
  options: ConjurorCompileOptions,
  maxSupportNodes: number,
): Promise<SelectorResult> {
  if (!options.completeText) {
    return heuristicSelector(catalog, options.userPrompt, 'no utility completeText available; used heuristic Conjuror selection');
  }

  const prompt = buildCompiledSelectorPrompt(catalog, options, maxSupportNodes);
  const timeoutMs = options.surfaceSelectTimeoutMs ?? SURFACE_SELECT_TIMEOUT_MS;
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const raw = await options.completeText({
      system: CONJUROR_SELECT_SYSTEM_PROMPT,
      prompt,
      maxTokens: 700,
      temperature: 0,
      signal: controller.signal,
    });
    const parsed = parseSelectorOutput(raw, catalog, maxSupportNodes);
    if (!parsed) {
      return heuristicSelector(catalog, options.userPrompt, 'malformed Conjuror selector output; used heuristic fallback');
    }
    return parsed;
  } catch {
    return heuristicSelector(catalog, options.userPrompt, 'Conjuror selector failed; used heuristic fallback');
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onAbort);
  }
}

function buildCompiledSelectorPrompt(
  catalog: GhostCatalog,
  options: ConjurorCompileOptions,
  maxSupportNodes: number,
): string {
  const menu = buildCatalogMenu(catalog)
    .filter((entry) => entry.id !== GHOST_FRONT_DOOR_ID)
    .map((entry) => {
      const node = catalog.nodes.get(entry.id);
      const kind = node?.kind ? ` kind=${node.kind}` : '';
      const css = node?.body && hasCssBlock(node.body) ? ' token-css=true' : '';
      return `- ${entry.id}${kind}${css}: ${entry.description ?? '(no description)'}`;
    })
    .join('\n');
  const toolNames = options.tools?.tools.map((tool) => tool.name).join(', ') || 'none';
  return [
    `User request:\n${options.userPrompt.trim()}`,
    '',
    `Surface plan: purpose=${options.surfacePlan.purpose}; runtime=${options.surfacePlan.runtime}; data=${options.surfacePlan.data}; authority=${options.surfacePlan.authority}; persistence=${options.surfacePlan.persistence}`,
    `Mode: ${options.mode}`,
    `Granted host tools: ${toolNames}`,
    '',
    'Candidate Ghost nodes (id + retrieval description):',
    menu || '(no non-index candidate nodes)',
    '',
    `Return JSON only in this shape: {"leadId":"node-id","supportIds":["node-id"],"excluded":[{"id":"node-id","reason":"short reason"}]}. Use at most ${maxSupportNodes} supportIds.`,
  ].join('\n');
}

function parseSelectorOutput(
  raw: string,
  catalog: GhostCatalog,
  maxSupportNodes: number,
): SelectorResult | null {
  const json = extractJsonObject(raw);
  if (!json) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const obj = parsed as Record<string, unknown>;
  const warnings: string[] = [];
  const leadCandidate = firstString(obj.leadId, obj.lead, obj.leadCompositionId, obj.surface);
  const leadId = leadCandidate ? validateSelectorId(leadCandidate, catalog, warnings, 'lead') : null;
  const supportRaw = firstArray(obj.supportIds, obj.support, obj.supportNodes);
  const supportIds: string[] = [];
  for (const id of supportRaw) {
    if (supportIds.length >= maxSupportNodes) break;
    const valid = validateSelectorId(id, catalog, warnings, 'support');
    if (valid && valid !== leadId && !supportIds.includes(valid)) supportIds.push(valid);
  }
  const excludedNodes = parseExcludedNodes(obj.excluded ?? obj.excludedIds ?? obj.exclusions, catalog, warnings);
  if (!leadId) {
    const fallbackWarning = 'Conjuror selector did not provide a valid lead id; used heuristic fallback';
    warnings.push(fallbackWarning);
    const fallback = heuristicSelector(catalog, '', fallbackWarning);
    return {
      ...fallback,
      warnings: [...warnings, ...fallback.warnings.filter((warning) => !warnings.includes(warning))],
    };
  }
  return {
    leadId,
    supportIds,
    excludedNodes,
    warnings,
    usedFallback: false,
  };
}

function heuristicSelector(catalog: GhostCatalog, prompt: string, warning: string): SelectorResult {
  const cssIds = new Set(tokenCssNodeIds(catalog));
  const menu = buildCatalogMenu(catalog).filter((entry) => entry.id !== GHOST_FRONT_DOOR_ID && !cssIds.has(entry.id));
  const terms = significantTerms(prompt);
  const scored = menu.map((entry, index) => {
    const node = catalog.nodes.get(entry.id);
    const haystack = `${entry.id} ${entry.description ?? ''} ${node?.body.slice(0, 1200) ?? ''}`.toLowerCase();
    const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
    return { id: entry.id, index, score };
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index || a.id.localeCompare(b.id));
  const lead = scored.find((entry) => entry.score > 0)?.id ?? scored[0]?.id ?? null;
  const supportIds = scored
    .filter((entry) => entry.id !== lead)
    .map((entry) => entry.id);
  return {
    leadId: lead,
    supportIds,
    excludedNodes: [],
    warnings: [warning],
    usedFallback: true,
  };
}

function buildCompiledPulled(catalog: GhostCatalog, ids: string[], leadId: string | null): PulledGhostNode[] {
  const ordered = [...ids].sort((a, b) => {
    const rank = (id: string) => id === GHOST_FRONT_DOOR_ID ? 0 : id === leadId ? 1 : 2;
    return rank(a) - rank(b) || a.localeCompare(b);
  });
  return ordered.flatMap((id): PulledGhostNode[] => {
    const node = catalog.nodes.get(id);
    if (!node || !node.body.trim()) return [];
    const reason: GhostPullReason = id === GHOST_FRONT_DOOR_ID
      ? 'front-door'
      : id === leadId
        ? 'anchor'
        : 'corpus';
    return [{
      id: node.id,
      ...(node.kind !== undefined ? { kind: node.kind } : {}),
      body: node.body,
      reason,
    }];
  });
}

function capPulledByChars(
  pulled: PulledGhostNode[],
  leadId: string | null,
  glossary: GhostGlossaryEntry[],
  maxChars: number,
  warnings: string[],
): PulledGhostNode[] {
  let accepted: PulledGhostNode[] = [];
  const isMandatory = (node: PulledGhostNode) => (
    node.id === GHOST_FRONT_DOOR_ID || node.id === leadId || hasCssBlock(node.body)
  );
  for (const node of pulled) {
    const candidate = [...accepted, node];
    if (isMandatory(node) || renderCorpusPrompt(candidate, leadId ?? GHOST_FRONT_DOOR_ID, glossary).length <= maxChars) {
      accepted = candidate;
      continue;
    }
    warnings.push(`Skipped optional Ghost node "${node.id}" to stay within Conjuror character budget`);
  }
  return accepted;
}

function relabelPulled(pulled: PulledGhostNode[], surface: string): PulledGhostNode[] {
  return pulled.map((node) => ({
    ...node,
    reason: node.id === GHOST_FRONT_DOOR_ID
      ? 'front-door'
      : node.id === surface
        ? 'anchor'
        : 'corpus',
  }));
}

function buildPacket(
  strategy: ConjurorStrategy,
  pulled: PulledGhostNode[],
  excludedNodes: ConjurorExcludedNode[],
  selectedReasons?: Map<string, string>,
  warnings: string[] = [],
): ConjurorPacket {
  const selectedNodes = pulled.map((node) => ({
    id: node.id,
    reason: selectedReasons?.get(node.id) ?? reasonText(node),
    pullReason: node.reason,
    ...(node.kind !== undefined ? { kind: node.kind } : {}),
  }));
  return {
    schema: 'summon.ghost-gather/v1',
    strategy,
    selectedNodes,
    excludedNodes: excludedNodes.filter((node) => !pulled.some((pulledNode) => pulledNode.id === node.id)),
    authorityStack: selectedNodes.map((node) => ({ id: node.id, reason: node.reason })),
    warnings,
  };
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

function reasonText(node: PulledGhostNode): string {
  switch (node.reason) {
    case 'front-door':
      return 'front door';
    case 'anchor':
      return 'lead composition';
    case 'corpus':
      return hasCssBlock(node.body) ? 'token CSS authority' : 'corpus';
  }
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

function tokenCssNodeIds(catalog: GhostCatalog): string[] {
  return [...catalog.nodes.values()]
    .filter((node) => node.body.trim() && hasCssBlock(node.body))
    .map((node) => node.id)
    .sort((a, b) => {
      const aFront = a === GHOST_FRONT_DOOR_ID ? 0 : 1;
      const bFront = b === GHOST_FRONT_DOOR_ID ? 0 : 1;
      return aFront - bFront || a.localeCompare(b);
    });
}

function hasCssBlock(body: string): boolean {
  return /```css\n[\s\S]*?```/.test(body);
}

function extractJsonObject(raw: string): string | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const text = fenced || raw.trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function firstArray(...values: unknown[]): string[] {
  for (const value of values) {
    if (!Array.isArray(value)) continue;
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }
  return [];
}

function validateSelectorId(raw: string, catalog: GhostCatalog, warnings: string[], role: string): string | null {
  const trimmed = raw.trim();
  const candidate = catalog.nodes.has(trimmed) ? trimmed : trimmed.toLowerCase();
  if (catalog.nodes.has(candidate)) return candidate;
  warnings.push(`Dropped invalid Conjuror ${role} id "${trimmed}"`);
  return null;
}

function parseExcludedNodes(raw: unknown, catalog: GhostCatalog, warnings: string[]): ConjurorExcludedNode[] {
  const entries = Array.isArray(raw) ? raw : [];
  const excluded: ConjurorExcludedNode[] = [];
  for (const entry of entries) {
    if (typeof entry === 'string') {
      const id = validateSelectorId(entry, catalog, warnings, 'excluded');
      if (id && !excluded.some((node) => node.id === id)) excluded.push({ id, reason: 'excluded by selector' });
      continue;
    }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const obj = entry as Record<string, unknown>;
    const rawId = typeof obj.id === 'string' ? obj.id : null;
    if (!rawId) continue;
    const id = validateSelectorId(rawId, catalog, warnings, 'excluded');
    if (!id || excluded.some((node) => node.id === id)) continue;
    const reason = typeof obj.reason === 'string' && obj.reason.trim()
      ? obj.reason.trim().slice(0, 240)
      : 'excluded by selector';
    excluded.push({ id, reason });
  }
  return excluded;
}

function significantTerms(prompt: string): string[] {
  const stop = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'show', 'make', 'build', 'create', 'need', 'want', 'surface']);
  const terms = prompt
    .toLowerCase()
    .match(/[a-z0-9]{3,}/g) ?? [];
  return [...new Set(terms.filter((term) => !stop.has(term)))].slice(0, 16);
}

function boundedInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}
