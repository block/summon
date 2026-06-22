import type { GhostIngestionContract } from '@summon-internal/engine';
import type { GhostNodeSummary } from './signals.js';
import type { GhostRelayEntrypointLike } from './types.js';
import { uniqueStrings } from './util.js';

export function buildGhostContractPrompt(input: {
  prose: GhostNodeSummary[];
  composition: GhostNodeSummary[];
  inventory: GhostIngestionContract['fingerprint']['inventory'];
  checks: GhostNodeSummary[];
  antiPatterns: string[];
  tokenNames: string[];
  entrypoint: GhostRelayEntrypointLike;
}): string {
  void input.entrypoint;
  return [
    '## Ghost Ingestion Contract',
    '',
    'Summon has compiled the Ghost relay into a runtime-aware generation contract. Use this as binding design/product direction; the Surface Contract and Tools blocks still own host authority.',
    '',
    '### Prose and intent anchors',
    formatNodeList(input.prose),
    '',
    '### Composition anchors',
    'Choose one selected composition anchor as the visible outer shell. The root `<main>` must make this shell obvious through layout, spacing, hierarchy, and surface treatment.',
    formatNodeList(input.composition),
    '',
    '### Inventory and building blocks',
    formatInventory(input.inventory),
    '',
    '### Anti-pattern boundaries',
    formatBullets(input.antiPatterns, 'None selected.'),
    '',
    '### Active or selected checks',
    formatNodeList(input.checks),
    '',
    '### Active token vocabulary',
    formatBullets(input.tokenNames.slice(0, 80), 'No token names detected.'),
  ].join('\n');
}

function formatNodeList(nodes: GhostNodeSummary[]): string {
  if (nodes.length === 0) return '- None selected.';
  return nodes.map((node) => [
    `- ${node.ref}: ${node.summary}`,
    ...node.details.slice(0, 4).map((detail) => `  - ${detail}`),
  ].join('\n')).join('\n');
}

function formatInventory(inventory: GhostIngestionContract['fingerprint']['inventory']): string {
  return [
    `- Tokens: ${inventory.tokens.length ? inventory.tokens.join(', ') : 'none listed'}`,
    `- Building blocks/components: ${inventory.components.length ? inventory.components.join(', ') : 'none listed'}`,
    `- Libraries: ${inventory.libraries.length ? inventory.libraries.join(', ') : 'none listed'}`,
    '- If a building block is named but no implementation is provided, express it as safe Arrow HTML and CSS. Do not import unavailable libraries or components.',
  ].join('\n');
}

function formatBullets(values: string[], empty: string): string {
  const cleaned = uniqueStrings(values).filter(Boolean);
  return cleaned.length ? cleaned.map((value) => `- ${value}`).join('\n') : `- ${empty}`;
}
