import {
  type GhostFidelitySignal,
  type GhostIngestionContract,
} from '@summon-internal/engine';
import type { GhostRelayNode, RawGhostFingerprintBundle } from './types.js';
import {
  recordArrayValue,
  recordValue,
  stableSignalId,
  stringArrayValue,
  uniqueStrings,
} from './util.js';

export interface GhostNodeSummary {
  ref: string;
  summary: string;
  details: string[];
}

export function nodeSummary(node: GhostRelayNode): GhostNodeSummary {
  return {
    ref: node.ref,
    summary: node.summary,
    details: [...node.details],
  };
}

export function extractInventoryContract(
  raw: Record<string, unknown> | undefined,
  exemplars: GhostNodeSummary[],
): GhostIngestionContract['fingerprint']['inventory'] {
  const buildingBlocks = recordValue(raw?.building_blocks);
  const tokens = stringArrayValue(buildingBlocks?.tokens);
  const components = stringArrayValue(buildingBlocks?.components);
  const libraries = stringArrayValue(buildingBlocks?.libraries);
  return {
    refs: exemplars.map((node) => node.ref),
    buildingBlocks: uniqueStrings([...tokens, ...components, ...libraries]),
    tokens,
    components,
    libraries,
  };
}

export function extractRawAntiPatterns(raw: RawGhostFingerprintBundle): string[] {
  const out: string[] = [];
  for (const situation of recordArrayValue(raw.prose?.situations)) {
    out.push(...stringArrayValue(situation.refuses));
  }
  for (const principle of recordArrayValue(raw.prose?.principles)) {
    out.push(...stringArrayValue(principle.counterexamples));
  }
  for (const pattern of recordArrayValue(raw.composition?.patterns)) {
    out.push(...stringArrayValue(pattern.anti_patterns));
  }
  return out;
}

export function buildRequiredSignals(input: {
  prose: GhostNodeSummary[];
  composition: GhostNodeSummary[];
  inventory: GhostIngestionContract['fingerprint']['inventory'];
  tokenNames: string[];
}): GhostFidelitySignal[] {
  const signals: GhostFidelitySignal[] = [];
  for (const node of input.composition.slice(0, 4)) {
    const terms = signalTerms(`${node.summary} ${node.details.join(' ')}`, { includeVisualWords: true });
    if (terms.length > 0) {
      signals.push({
        id: stableSignalId('composition', node.ref),
        kind: 'composition',
        label: node.summary,
        terms,
        severity: 'block',
        sourceRef: node.ref,
        message: `Artifact does not show enough evidence of Ghost composition pattern ${node.ref}.`,
        hint: `Recompose around ${node.ref}: ${node.summary}`,
      });
    }
  }
  for (const node of input.prose.slice(0, 3)) {
    const terms = signalTerms(`${node.summary} ${node.details.join(' ')}`);
    if (terms.length > 0) {
      signals.push({
        id: stableSignalId('prose', node.ref),
        kind: 'prose',
        label: node.summary,
        terms,
        severity: 'warn',
        sourceRef: node.ref,
        message: `Artifact has weak evidence of Ghost prose obligation ${node.ref}.`,
      });
    }
  }
  for (const component of input.inventory.components.slice(0, 6)) {
    const terms = signalTerms(component);
    if (terms.length > 0) {
      signals.push({
        id: stableSignalId('inventory', component),
        kind: 'inventory',
        label: component,
        terms,
        severity: 'warn',
        sourceRef: component,
        message: `Artifact does not visibly use inventory building block ${component}.`,
      });
    }
  }
  const importantTokens = input.inventory.tokens.length > 0 ? input.inventory.tokens : input.tokenNames.slice(0, 8);
  for (const token of importantTokens.slice(0, 8)) {
    const normalized = token.startsWith('--') ? token : `--${token}`;
    signals.push({
      id: stableSignalId('token', normalized),
      kind: 'token',
      label: normalized,
      terms: [normalized],
      severity: 'warn',
      sourceRef: normalized,
      message: `Artifact does not reference Ghost token ${normalized}.`,
    });
  }
  return signals.slice(0, 24);
}

export function buildForbiddenSignals(antiPatterns: string[]): GhostFidelitySignal[] {
  return antiPatterns.slice(0, 16).map((text): GhostFidelitySignal => ({
    id: stableSignalId('avoid', text),
    kind: 'anti-pattern',
    label: text,
    terms: antiPatternTerms(text),
    severity: 'block',
    sourceRef: 'ghost.avoid',
    message: `Artifact appears to contain Ghost anti-pattern: ${text}`,
    hint: `Remove this anti-pattern and use selected fingerprint composition instead: ${text}`,
  })).filter((signal) => signal.terms.length > 0);
}

export function definedTokenNames(css: string): string[] {
  return uniqueStrings(Array.from(css.matchAll(/--[A-Za-z0-9_-]+\s*:/g)).map((match) => match[0]!.slice(0, -1).trim()));
}

export function customTokenNames(tokenNames: string[]): string[] {
  return [...tokenNames];
}

export function signalTerms(text: string, options: { includeVisualWords?: boolean } = {}): string[] {
  const stop = new Set([
    'the', 'and', 'with', 'without', 'that', 'this', 'from', 'into', 'through', 'rather', 'than', 'when', 'where', 'should', 'must', 'make', 'show', 'use', 'uses', 'using', 'surface', 'surfaces', 'user', 'product', 'obligation', 'pattern', 'avoid', 'prefer', 'keep', 'clear', 'specific', 'generic', 'content', 'request', 'selected', 'fingerprint',
  ]);
  const words = text
    .toLowerCase()
    .replace(/[`*_#()[\]{}:;,.!?"']/g, ' ')
    .split(/\s+|\//)
    .map((word) => word.trim())
    .filter((word) => word.length >= 4 && !stop.has(word));
  const phrases = Array.from(text.toLowerCase().matchAll(/\b[a-z][a-z0-9]+(?:[- ][a-z0-9]+){1,3}\b/g))
    .map((match) => match[0]!.trim())
    .filter((phrase) => phrase.length >= 7 && !phrase.split(/[- ]/).every((part) => stop.has(part)));
  const visual = options.includeVisualWords ? ['shell', 'layout', 'hierarchy', 'panel', 'grid', 'row', 'note', 'evidence', 'spread', 'badge', 'rule', 'matrix'] : [];
  return uniqueStrings([...phrases, ...words, ...visual]).slice(0, 12);
}

export function antiPatternTerms(text: string): string[] {
  const normalized = text
    .replace(/^(refuses|counterexample|avoid):\s*/i, '')
    .replace(/\b(do not|don't|avoid|without|unless explicitly requested)\b/gi, ' ');
  const terms = Array.from(normalized.matchAll(/\b[a-z][a-z0-9]+(?:[- ][a-z0-9]+){1,4}\b/gi))
    .map((match) => match[0]!.toLowerCase().trim())
    .filter((term) => term.length >= 10);
  return uniqueStrings(terms).slice(0, 4);
}

export function isAvoidanceLine(value: string): boolean {
  return /^(refuses|counterexample|avoid):/i.test(value.trim());
}
