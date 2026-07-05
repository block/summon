import type { SurfaceStreamResult } from '@decentralized-design/summon/browser';
import type { ProtocolLine } from '@decentralized-design/summon/engine';

export type ConformanceGlyph = {
  name: string;
  severity: 'high' | 'medium' | 'low';
  verdict: 'pass' | 'fail' | 'inconclusive';
  reason: string;
  evidence?: string;
};

export interface GenerationTrace {
  runId: number;
  phase: string | null;
  gatheredNodes: Array<{ id: string; pullReason: string; kind?: string; reason: string }>;
  gatherWarnings: string[];
  context: { product: string; surface: string; styleSource: string } | null;
  tokenSource: { kind: string; source: string; warnings: string[] } | null;
  bytes: number;
  streamHealth: { complete: boolean; blockedCount: number; artifactCount: number } | null;
  conformance: { evaluated: boolean; checks: ConformanceGlyph[]; summary: { pass: number; fail: number; inconclusive: number } } | null;
  receipt: unknown | null;
  timeline: Array<{ at: number; kind: 'status' | 'gather' | 'context' | 'tokens' | 'artifact' | 'conformance' | 'receipt' | 'error'; label: string; detail?: string }>;
  done: boolean;
  error: string | null;
}

export type TraceAction =
  | { type: 'reset' }
  | { type: 'replay'; bytes: number }
  | { type: 'line'; line: ProtocolLine; at: number }
  | { type: 'bytes'; total: number }
  | { type: 'stream-graph'; health: SurfaceStreamResult['streamGraph']['health']; artifacts: SurfaceStreamResult['streamGraph']['artifacts'] }
  | { type: 'end'; ok: boolean; error?: string };

export const initialGenerationTrace: GenerationTrace = {
  runId: 0,
  phase: null,
  gatheredNodes: [],
  gatherWarnings: [],
  context: null,
  tokenSource: null,
  bytes: 0,
  streamHealth: null,
  conformance: null,
  receipt: null,
  timeline: [],
  done: false,
  error: null,
};

export function traceReducer(state: GenerationTrace, action: TraceAction): GenerationTrace {
  switch (action.type) {
    case 'reset':
      return { ...initialGenerationTrace, runId: state.runId + 1 };
    case 'replay':
      return {
        ...initialGenerationTrace,
        runId: state.runId + 1,
        phase: 'replayed',
        bytes: action.bytes,
        done: true,
        timeline: [{ at: Date.now(), kind: 'artifact', label: 'Replayed saved surface' }],
      };
    case 'bytes':
      return { ...state, bytes: action.total };
    case 'stream-graph':
      return {
        ...state,
        streamHealth: {
          complete: action.health.complete,
          blockedCount: action.health.blockedCount,
          artifactCount: action.artifacts.length,
        },
      };
    case 'end':
      return {
        ...state,
        done: true,
        error: action.ok ? null : action.error ?? 'Generation ended before completion',
        timeline: appendTimeline(state, {
          at: Date.now(),
          kind: action.ok ? 'status' : 'error',
          label: action.ok ? 'Done' : 'Ended',
          ...(action.error ? { detail: action.error } : {}),
        }),
      };
    case 'line':
      return applyProtocolLine(state, action.line, action.at);
  }
}

function applyProtocolLine(state: GenerationTrace, line: ProtocolLine, at: number): GenerationTrace {
  if (line.op === 'artifact') {
    const files = artifactFiles(line.value);
    return {
      ...state,
      timeline: appendTimeline(state, {
        at,
        kind: 'artifact',
        label: files.length ? `Artifact: ${files.join(', ')}` : 'Artifact received',
      }),
    };
  }
  if (line.op !== 'meta') return state;

  switch (line.path) {
    case '/status': {
      const phase = String(line.value ?? 'streaming');
      return {
        ...state,
        phase,
        timeline: appendTimeline(state, { at, kind: 'status', label: phase }),
      };
    }
    case '/ghost-gather': {
      const value = line.value as { selectedNodes?: unknown; warnings?: unknown } | undefined;
      const nodes = parseGatheredNodes(value?.selectedNodes);
      const warnings = stringArray(value?.warnings);
      return {
        ...state,
        gatheredNodes: nodes,
        gatherWarnings: warnings,
        timeline: appendTimeline(state, {
          at,
          kind: 'gather',
          label: `Gathered ${nodes.length} fingerprint node${nodes.length === 1 ? '' : 's'}`,
          detail: nodes.map((node) => `${node.id} (${node.pullReason})`).join(', '),
        }),
      };
    }
    case '/ghost-context': {
      const value = asRecord(line.value);
      const context = {
        product: stringValue(value.product, 'Ghost fingerprint'),
        surface: stringValue(value.surface, 'surface'),
        styleSource: stringValue(value.styleSource, 'unknown'),
      };
      return {
        ...state,
        context,
        timeline: appendTimeline(state, {
          at,
          kind: 'context',
          label: `${context.product} → ${context.surface}`,
          detail: `style=${context.styleSource}`,
        }),
      };
    }
    case '/ghost-token-source': {
      const value = asRecord(line.value);
      const tokenSource = {
        kind: stringValue(value.kind, 'unknown'),
        source: stringValue(value.source, 'unknown'),
        warnings: stringArray(value.warnings),
      };
      return {
        ...state,
        tokenSource,
        timeline: appendTimeline(state, {
          at,
          kind: 'tokens',
          label: `Tokens: ${tokenSource.kind}`,
          detail: `${tokenSource.source}${tokenSource.warnings.length ? `; warnings=${tokenSource.warnings.length}` : ''}`,
        }),
      };
    }
    case '/ghost-conformance': {
      const value = asRecord(line.value);
      const summary = parseSummary(value.summary);
      const checks = parseConformanceChecks(value.checks);
      return {
        ...state,
        conformance: { evaluated: value.evaluated === true, checks, summary },
        timeline: appendTimeline(state, {
          at,
          kind: 'conformance',
          label: `Conformance ${summary.pass}p/${summary.fail}f/${summary.inconclusive}i`,
          detail: checks.map((check) => `${check.name}: ${check.verdict}`).join(', '),
        }),
      };
    }
    case '/ghost-receipt': {
      const value = asRecord(line.value);
      const summary = parseSummary(asRecord(value.conformance).summary);
      return {
        ...state,
        receipt: line.value ?? null,
        timeline: appendTimeline(state, {
          at,
          kind: 'receipt',
          label: `Receipt ${summary.pass}p/${summary.fail}f/${summary.inconclusive}i`,
        }),
      };
    }
    case '/error':
      return {
        ...state,
        error: String(line.value ?? 'error'),
        timeline: appendTimeline(state, { at, kind: 'error', label: String(line.value ?? 'error') }),
      };
    default:
      return state;
  }
}

function appendTimeline(state: GenerationTrace, item: GenerationTrace['timeline'][number]) {
  return [...state.timeline, item].slice(-120);
}

export function parseConformanceChecks(value: unknown): ConformanceGlyph[] {
  if (!Array.isArray(value)) return [];
  const checks: ConformanceGlyph[] = [];
  for (const entry of value) {
    const item = asRecord(entry);
    if (typeof item.name !== 'string') continue;
    checks.push({
      name: item.name,
      severity: severityValue(item.severity),
      verdict: verdictValue(item.verdict),
      reason: typeof item.reason === 'string' ? item.reason : '',
      ...(typeof item.evidence === 'string' && item.evidence ? { evidence: item.evidence } : {}),
    });
  }
  return checks;
}

export function parseGatheredNodes(value: unknown): Array<{ id: string; pullReason: string; kind?: string; reason: string }> {
  if (!Array.isArray(value)) return [];
  const nodes: Array<{ id: string; pullReason: string; kind?: string; reason: string }> = [];
  for (const entry of value) {
    const item = asRecord(entry);
    if (typeof item.id !== 'string') continue;
    nodes.push({
      id: item.id,
      pullReason: typeof item.pullReason === 'string' ? item.pullReason : 'unknown',
      reason: typeof item.reason === 'string' ? item.reason : '',
      ...(typeof item.kind === 'string' ? { kind: item.kind } : {}),
    });
  }
  return nodes;
}

export function parseOfferedChecks(value: unknown): Array<{ name: string; severity: string }> {
  if (!Array.isArray(value)) return [];
  const checks: Array<{ name: string; severity: string }> = [];
  for (const entry of value) {
    const item = asRecord(entry);
    if (typeof item.name !== 'string') continue;
    checks.push({ name: item.name, severity: typeof item.severity === 'string' ? item.severity : 'unknown' });
  }
  return checks;
}

function artifactFiles(value: unknown): string[] {
  const source = asRecord(asRecord(value).source);
  return Object.keys(source);
}

function parseSummary(value: unknown): { pass: number; fail: number; inconclusive: number } {
  const item = asRecord(value);
  return {
    pass: numberValue(item.pass),
    fail: numberValue(item.fail),
    inconclusive: numberValue(item.inconclusive),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value ? value : fallback;
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function severityValue(value: unknown): ConformanceGlyph['severity'] {
  return value === 'high' || value === 'medium' || value === 'low' ? value : 'low';
}

function verdictValue(value: unknown): ConformanceGlyph['verdict'] {
  return value === 'pass' || value === 'fail' || value === 'inconclusive' ? value : 'inconclusive';
}
