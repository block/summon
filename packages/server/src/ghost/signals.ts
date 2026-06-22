import type { GhostIngestionContract } from '@summon-internal/engine';
import type { GhostRelayNode, RawGhostFingerprintBundle } from './types.js';
import {
  recordArrayValue,
  recordValue,
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

export function definedTokenNames(css: string): string[] {
  return uniqueStrings(Array.from(css.matchAll(/--[A-Za-z0-9_-]+\s*:/g)).map((match) => match[0]!.slice(0, -1).trim()));
}

export function customTokenNames(tokenNames: string[]): string[] {
  return [...tokenNames];
}

export function isAvoidanceLine(value: string): boolean {
  return /^(refuses|counterexample|avoid):/i.test(value.trim());
}
