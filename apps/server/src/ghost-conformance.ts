import type { GhostCatalog } from '@anarchitecture/ghost-fingerprint/core';
import type { GhostLoadedCheck } from './ghost-adapter.js';
import type { TextCompletionRequest } from './model-providers.js';

export type ConformanceVerdictValue = 'pass' | 'fail' | 'inconclusive';

/**
 * How a check was offered for this run. Ghost's flat-corpus model routes
 * checks by diff-material matching in `ghost review`; Summon evaluates
 * generated artifacts (not repo diffs), so no material locator can match and
 * every fingerprint check is offered — the sanctioned "always" shape for
 * assertions not bound to repo files.
 */
export type ConformanceOffered = 'always';

export interface CheckVerdict {
  name: string;
  severity: 'high' | 'medium' | 'low';
  offered: ConformanceOffered;
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
  schema: 'summon.ghost-conformance/v2';
  /** The anchor node id the generation was briefed against (diagnostic only). */
  surface: string;
  evaluated: boolean;
  checks: CheckVerdict[];
  summary: ConformanceSummary;
}

export interface EvaluateConformanceInput {
  /**
   * Checks from the loaded fingerprint package's `checks` haunt
   * (`LoadedFingerprintPackage.checks`). Ghost selects and emits; it never
   * runs a check — Summon's utility model is the evaluating agent here.
   */
  checks: Map<string, GhostLoadedCheck>;
  catalog?: GhostCatalog;
  surface: string;
  artifactSource: Record<string, string> | null;
  completeText: (request: TextCompletionRequest) => Promise<string>;
  timeoutMs?: number;
  signal?: AbortSignal;
}

const SCHEMA = 'summon.ghost-conformance/v2' as const;
// Real artifacts (~20K chars of html+css) take a utility model ~10s to grade;
// the previous 8s deadline fired on essentially every non-trivial surface and
// returned blanket inconclusives. Conformance is a post-pass advisory line, so
// the cost of the longer deadline is receipt latency, not user-visible stalls.
const DEFAULT_TIMEOUT_MS = 25_000;
// Conformance judges design fidelity, so the prompt must preserve design-bearing
// files. Blindly truncating the concatenated artifact at 12K hid main.css behind
// large imperative main.js files, creating false design failures for domjs.
const MAX_ARTIFACT_TOTAL_CHARS = 48_000;
const MAX_ARTIFACT_FILE_CHARS = 16_000;

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

/** Public helper: an unevaluated verdict (gated off or blocked generation). */
export function emptyConformanceVerdict(surface: string): ConformanceVerdict {
  return emptyVerdict(surface);
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

export function formatArtifactSourceForConformance(source: Record<string, string>): string {
  const parts: string[] = [];
  for (const [file, content] of orderedSourceEntries(source)) {
    if (typeof content !== 'string' || !content) continue;
    const trimmed = content.length <= MAX_ARTIFACT_FILE_CHARS
      ? content
      : `${content.slice(0, MAX_ARTIFACT_FILE_CHARS)}\n... [${file} truncated after ${MAX_ARTIFACT_FILE_CHARS} of ${content.length} chars]`;
    parts.push(`=== ${file} ===\n${trimmed}`);
  }
  const joined = parts.join('\n\n');
  return joined.length <= MAX_ARTIFACT_TOTAL_CHARS
    ? joined
    : `${joined.slice(0, MAX_ARTIFACT_TOTAL_CHARS)}\n... [artifact truncated after ${MAX_ARTIFACT_TOTAL_CHARS} chars]`;
}

function orderedSourceEntries(source: Record<string, string>): Array<[string, string]> {
  return Object.entries(source).sort(([a], [b]) => sourcePriority(a) - sourcePriority(b) || a.localeCompare(b));
}

function sourcePriority(file: string): number {
  if (file.endsWith('.css')) return 0;
  if (file === 'main.html' || file === 'body.html' || file.endsWith('.html')) return 1;
  if (file === 'main.js' || file === 'main.ts') return 2;
  if (file.endsWith('.js') || file.endsWith('.ts')) return 3;
  return 4;
}

/** Stable evaluation order: by check id. */
function orderedChecks(checks: Map<string, GhostLoadedCheck>): GhostLoadedCheck[] {
  return [...checks.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, check]) => check);
}

function buildEvalPrompt(
  artifactSource: Record<string, string>,
  offered: GhostLoadedCheck[],
  catalog?: GhostCatalog,
): string {
  const checksBlock = offered
    .map((entry, index) => {
      const name = entry.doc.frontmatter.name;
      const description = entry.doc.frontmatter.description;
      const refs = entry.references;
      const baseline = catalog ? baselineForReferences(refs, catalog) : [];
      const lines = [`${index + 1}. ${name}`];
      if (description) lines.push(`Description: ${description}`);
      if (refs.length > 0) lines.push(`References: ${refs.map((ref) => `\`${ref}\``).join(', ')}`);
      if (baseline.length > 0) {
        lines.push('Baseline prose:');
        for (const item of baseline) {
          lines.push(`- ${item.ref}`);
          lines.push(indentBlock(item.prose, '  '));
        }
      }
      lines.push('Check instruction:', entry.doc.body.trim());
      return lines.join('\n');
    })
    .join('\n\n');
  return [
    '## Generated UI source',
    '',
    formatArtifactSourceForConformance(artifactSource),
    '',
    '## Checks',
    '',
    checksBlock,
    '',
    'Return a JSON array with one object per check above, keyed by the check name.',
  ].join('\n');
}

function baselineForReferences(refs: string[], catalog: GhostCatalog): Array<{ ref: string; prose: string }> {
  return refs.flatMap((ref) => {
    const nodeId = ref.split('>')[0]?.trim() ?? ref.trim();
    const node = catalog.nodes.get(nodeId);
    if (!node?.body.trim()) return [];
    return [{ ref, prose: truncateBaseline(node.body.trim()) }];
  });
}

function truncateBaseline(value: string): string {
  const max = 2400;
  return value.length <= max ? value : `${value.slice(0, max)}\n... [baseline truncated]`;
}

function indentBlock(value: string, indent: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => `${indent}${line}`)
    .join('\n');
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

function inconclusiveVerdicts(offered: GhostLoadedCheck[], reason: string): CheckVerdict[] {
  return offered.map((entry) => ({
    name: entry.doc.frontmatter.name,
    severity: entry.doc.frontmatter.severity,
    offered: 'always' as const,
    verdict: 'inconclusive' as const,
    reason,
  }));
}

export async function evaluateConformance(
  input: EvaluateConformanceInput,
): Promise<ConformanceVerdict> {
  const { checks, surface, artifactSource } = input;

  // Every fingerprint check is offered: Summon judges a generated artifact,
  // not a repo diff, so Ghost's material-based routing cannot apply and the
  // "always offered" shape is the correct one (see ConformanceOffered).
  const offered = orderedChecks(checks);

  // No-op fast path: no checks or no artifact → no model call.
  if (offered.length === 0 || !artifactSource) {
    return emptyVerdict(surface);
  }

  const prompt = buildEvalPrompt(artifactSource, offered, input.catalog);
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let raw: string | null = null;
  let failure = 'Evaluator returned no parseable verdict.';
  try {
    raw = await Promise.race<string | null>([
      input.completeText({
        system: EVAL_SYSTEM_PROMPT,
        prompt,
        maxTokens: 2048,
        temperature: 0,
        signal: input.signal,
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    if (raw === null) failure = `Evaluator timed out after ${timeoutMs}ms.`;
  } catch (err) {
    raw = null;
    failure = `Evaluator call failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  const parsed = raw ? extractJsonArray(raw) : null;
  if (!parsed) {
    const verdicts = inconclusiveVerdicts(offered, failure);
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

  const verdicts: CheckVerdict[] = offered.map((entry) => {
    const name = entry.doc.frontmatter.name;
    const severity = entry.doc.frontmatter.severity;
    const found = byName.get(name);
    if (!found || typeof found.pass !== 'boolean') {
      return {
        name,
        severity,
        offered: 'always' as const,
        verdict: 'inconclusive' as const,
        reason: found && typeof found.reason === 'string'
          ? found.reason
          : 'Evaluator omitted this check.',
      };
    }
    const verdict: CheckVerdict = {
      name,
      severity,
      offered: 'always',
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
