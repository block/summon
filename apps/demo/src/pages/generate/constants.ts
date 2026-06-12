import type { SummonLayout, SurfaceCeiling } from '@anarchitecture/summon/engine';
import { baseDemoComponentPack } from '../../components.js';
import { createScopedDemoRegistry } from '../../showcase.js';

export const savedSurfacesKey = 'summon.savedSurfaces.v1';
export const maxSavedSurfaces = 8;

export const baseCapabilityPack = createScopedDemoRegistry({ onSummon: () => {} }, [
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

export const baseComponentPack = baseDemoComponentPack();

export const childCapabilityNames = baseCapabilityPack.intents
  .map((intent) => intent.name)
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

export const demoSurfaceCeiling: SurfaceCeiling = {
  runtimes: ['static', 'declarative', 'scripted', 'worker'],
  data: ['embedded', 'host-resource', 'worker'],
  authorities: ['none', 'read', 'host-action', 'approval-gated'],
  persistences: ['replayable'],
};

export const scenarioCategoryOrder = [
  'Host data',
  'Read-only',
  'Host action',
  'Worker',
  'Approval',
  'Runtime',
  'Tokens',
  'Layout',
  'Composition',
  'Diagnostics',
  'Ghost',
];
