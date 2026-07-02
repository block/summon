import type { SummonLayout, SummonOutputRuntime } from '@anarchitecture/summon/engine';
import { createScopedDemoRegistry } from '../../showcase.js';

/**
 * The generate workbench is pinned to the Surface Document runtime — the
 * successor contract (docs/surface-document-plan.md). Runtime comparison
 * lives in the Batch page, not here.
 */
export const GENERATE_RUNTIME: SummonOutputRuntime = 'surface-document';

export const savedSurfacesKey = 'summon.savedSurfaces.v1';
export const maxSavedSurfaces = 8;

export const baseToolPack = createScopedDemoRegistry({ onSummon: () => {} }, [
  'log',
  'counter',
  'choose',
  'submit',
  'search',
  'ai',
  'github_lookup',
  'analysis',
  'compute_score',
  'publish_summary',
  'summon',
]).toContract().pack;

export const childToolNames = baseToolPack.tools
  .map((tool) => tool.name)
  .filter((name) => name !== 'summon');

export const layoutPresets = new Map<string, SummonLayout>([
  [
    'card-structured',
    {
      id: 'card-structured',
      slots: [
        { id: 'header', purpose: 'short title, context, and the main takeaway' },
        { id: 'content', purpose: 'the useful details, data, reasoning, or plan' },
        { id: 'actions', purpose: 'one or two concise next actions or controls' },
      ],
    },
  ],
]);

export const scenarioCategoryOrder = [
  'Host resources',
  'Static',
  'Host actions',
  'Worker',
  'Approval',
  'Arrow behavior',
  'Design tokens',
  'Layout',
  'Composition',
  'Diagnostics',
  'Fingerprint',
];
