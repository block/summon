import type { SurfacePolicy } from '@anarchitecture/summon';

export interface GalleryPreset {
  id: string;
  title: string;
  category: string;
  description: string;
  prompt: string;
  surfacePolicy: SurfacePolicy;
}

export const GALLERY_PRESETS: GalleryPreset[] = [
  {
    id: 'static-brief',
    title: 'Static Brief',
    category: 'Read-only',
    description: 'A rich generated brief with embedded data and no executable authority.',
    prompt:
      'compare renting versus buying a small coffee cart for a first-time weekend pop-up operator. Make it concrete, skimmable, and decision-oriented.',
    surfacePolicy: {
      tier: 'static',
      purpose: 'compare',
    },
  },
  {
    id: 'search-explorer',
    title: 'Search Explorer',
    category: 'Host data',
    description: 'Generated search UI reads through a host-owned data resource.',
    prompt:
      'build a weeknight dinner explorer where i can search for recipes, see loading and error states, browse results, and pick one to inspect.',
    surfacePolicy: {
      tier: 'declarative',
      purpose: 'explore',
      grants: ['search'],
    },
  },
  {
    id: 'decision-picker',
    title: 'Decision Picker',
    category: 'Host action',
    description: 'A comparison surface can save a choice through a host-allowed action.',
    prompt:
      'help me choose between three launch announcement approaches for a small developer tool. Compare tradeoffs and let me save the best option.',
    surfacePolicy: {
      tier: 'declarative',
      purpose: 'compare',
      grants: ['choose'],
    },
  },
  {
    id: 'approval-flow',
    title: 'Approval Flow',
    category: 'Approval',
    description: 'Generated publish UI can request approval, but the host owns the decision.',
    prompt:
      'build a publish review panel for a product update summary. Make the draft easy to review and include one approval-gated publish action.',
    surfacePolicy: {
      tier: 'approval',
      purpose: 'operate',
      grants: ['publish_summary'],
    },
  },
  {
    id: 'component-island-dashboard',
    title: 'Component Island Dashboard',
    category: 'Trusted components',
    description: 'The model authors layout; trusted host components render outside the iframe.',
    prompt:
      'build a compact launch readiness dashboard. Use host-rendered MetricCard, TrendSparkline, and ApprovalStatus components for the key signals, then write the surrounding interpretation and actions.',
    surfacePolicy: {
      tier: 'declarative',
      purpose: 'review',
      grants: ['choose'],
      components: ['MetricCard', 'TrendSparkline', 'ApprovalStatus'],
    },
  },
  {
    id: 'worker-analysis',
    title: 'Worker Analysis',
    category: 'Background work',
    description: 'Host-owned worker-style resources compute data and push safe state back.',
    prompt:
      'create a risk analysis surface for launching a paid beta next month. Let me run a background readiness analysis and compute a small score.',
    surfacePolicy: {
      tier: 'worker',
      purpose: 'review',
      grants: ['analysis', 'compute_score'],
    },
  },
];

export function findPreset(id: string): GalleryPreset {
  return GALLERY_PRESETS.find((preset) => preset.id === id) ?? GALLERY_PRESETS[0]!;
}

export function policyGrants(policy: SurfacePolicy): string[] {
  return policy.grants ?? [];
}

export function policyComponents(policy: SurfacePolicy): string[] {
  return policy.components ?? [];
}

export function policyText(policy: SurfacePolicy): string {
  const grants = policyGrants(policy);
  const components = policyComponents(policy);
  const grantText = grants.length > 0 ? grants.join(',') : 'none';
  const componentText = components.length > 0 ? components.join(',') : 'none';
  return `${policy.tier} · allowed host tools ${grantText} · trusted components ${componentText}`;
}
