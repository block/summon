import { loadChecksDir } from '@anarchitecture/ghost/scan';
import {
  selectChecksForSurfaces,
  type GhostGraph,
  type RoutedCheck,
} from '@anarchitecture/ghost/core';
import type { TextCompletionRequest } from './model-providers.js';

export type ConformanceVerdictValue = 'pass' | 'fail' | 'inconclusive';

export interface CheckVerdict {
  name: string;
  severity: 'high' | 'medium' | 'low';
  relevance: 'own' | 'ancestor';
  verdict: ConformanceVerdictValue;
  reason: string;
  evidence?: string;
}

export interface ConformanceSummary {
  pass: number;
  fail: number;
  inconclusive: number;
  failedHigh: number;
  failedMedium: number;
  failedLow: number;
}

export interface ConformanceVerdict {
  schema: 'summon.ghost-conformance/v1';
  surface: string;
  evaluated: boolean;
  checks: CheckVerdict[];
  summary: ConformanceSummary;
}

export interface EvaluateConformanceInput {
  packageDir: string;
  graph: GhostGraph;
  surface: string;
  artifactSource: Record<string, string> | null;
  completeText: (request: TextCompletionRequest) => Promise<string>;
  timeoutMs?: number;
  signal?: AbortSignal;
}

const SCHEMA = 'summon.ghost-conformance/v1' as const;
const DEFAULT_TIMEOUT_MS = 8000;
const MAX_ARTIFACT_CHARS = 12000;

const EVAL_SYSTEM_PROMPT = [
  'You are a design-conformance evaluator.',
  'Given generated UI source and a list of named checks (prose rules), return',
  'ONLY a JSON array, one object per check, each',
  '{name, pass:boolean, reason:string, evidence?:string}.',
  'Be strict but fair; judge only what the check states.',
].join(' ');

function zeroSummary(): ConformanceSummary {
  return { pass: 0, fail: 0, inconclusive: 0, failedHigh: 0, failedMedium: 0, failedLow: 0 };
}

function emptyVerdict(surface: string): ConformanceVerdict {
  return { schema: SCHEMA, surface, evaluated: false, checks: [], summary: zeroSummary() };
}

/**
 * Extract a JSON array from a possibly fenced model response. Strips ```json /
 * ``` fences, then matches the first `[ ... ]` span. Returns null on failure
 * (caller treats this as inconclusive).
 */
export function extractJsonArray(raw: string): unknown[] | null {
  if (!raw) return null;
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function clampArtifactSource(source: Record<string, string>): string {
  const parts: string[] = [];
  for (const [file, content] of Object.entries(source)) {
    if (typeof content !== 'string' || !content) continue;
    parts.push(`=== ${file} ===\n${content}`);
  }
  const joined = parts.join('\n\n');
  return joined.length <= MAX_ARTIFACT_CHARS
    ? joined
    : `${joined.slice(0, MAX_ARTIFACT_CHARS)}\n... [truncated]`;
}

function buildEvalPrompt(artifactSource: Record<string, string>, routed: RoutedCheck[]): string {
  const checksBlock = routed
    .map((entry, index) => {
      const name = entry.check.frontmatter.name;
      const body = entry.check.body.trim();
      return `${index + 1}. ${name}\n${body}`;
    })
    .join('\n\n');
  return [
    '## Generated UI source',
    '',
    clampArtifactSource(artifactSource),
    '',
    '## Checks',
    '',
    checksBlock,
    '',
    'Return a JSON array with one object per check above, keyed by the check name.',
  ].join('\n');
}

function buildSummary(checks: CheckVerdict[]): ConformanceSummary {
  const summary = zeroSummary();
  for (const verdict of checks) {
    if (verdict.verdict === 'pass') summary.pass++;
    else if (verdict.verdict === 'fail') {
      summary.fail++;
      if (verdict.severity === 'high') summary.failedHigh++;
      else if (verdict.severity === 'medium') summary.failedMedium++;
      else summary.failedLow++;
    } else summary.inconclusive++;
  }
  return summary;
}

function inconclusiveVerdicts(routed: RoutedCheck[], reason: string): CheckVerdict[] {
  return routed.map((entry) => ({
    name: entry.check.frontmatter.name,
    severity: entry.check.frontmatter.severity,
    relevance: entry.relevance.kind,
    verdict: 'inconclusive' as const,
    reason,
  }));
}

export async function evaluateConformance(
  input: EvaluateConformanceInput,
): Promise<ConformanceVerdict> {
  const { packageDir, graph, surface, artifactSource } = input;

  const { checks } = await loadChecksDir(packageDir);
  const routed = selectChecksForSurfaces(checks, graph, [surface]);

  // No-op fast path: no routed checks or no artifact → no model call.
  if (routed.length === 0 || !artifactSource) {
    return emptyVerdict(surface);
  }

  const prompt = buildEvalPrompt(artifactSource, routed);
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let raw: string | null = null;
  try {
    raw = await Promise.race<string | null>([
      input.completeText({
        system: EVAL_SYSTEM_PROMPT,
        prompt,
        maxTokens: 1024,
        temperature: 0,
        signal: input.signal,
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
  } catch {
    raw = null;
  }

  const parsed = raw ? extractJsonArray(raw) : null;
  if (!parsed) {
    const verdicts = inconclusiveVerdicts(routed, 'Evaluator returned no parseable verdict.');
    return { schema: SCHEMA, surface, evaluated: true, checks: verdicts, summary: buildSummary(verdicts) };
  }

  // Index parsed entries by check name.
  const byName = new Map<string, Record<string, unknown>>();
  for (const item of parsed) {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const obj = item as Record<string, unknown>;
      if (typeof obj.name === 'string') byName.set(obj.name, obj);
    }
  }

  const verdicts: CheckVerdict[] = routed.map((entry) => {
    const name = entry.check.frontmatter.name;
    const severity = entry.check.frontmatter.severity;
    const relevance = entry.relevance.kind;
    const found = byName.get(name);
    if (!found || typeof found.pass !== 'boolean') {
      return {
        name,
        severity,
        relevance,
        verdict: 'inconclusive' as const,
        reason: found && typeof found.reason === 'string'
          ? found.reason
          : 'Evaluator omitted this check.',
      };
    }
    const verdict: CheckVerdict = {
      name,
      severity,
      relevance,
      verdict: found.pass ? 'pass' : 'fail',
      reason: typeof found.reason === 'string' ? found.reason : '',
    };
    if (typeof found.evidence === 'string' && found.evidence) {
      verdict.evidence = found.evidence;
    }
    return verdict;
  });

  return { schema: SCHEMA, surface, evaluated: true, checks: verdicts, summary: buildSummary(verdicts) };
}
