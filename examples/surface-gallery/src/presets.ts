import {
  deriveSurfacePlanControls,
  type ScriptPolicy,
  type SurfaceCeiling,
  type SurfacePlan,
  type SurfacePlanMode,
} from '@anarchitecture/summon';

export interface GalleryPreset {
  id: string;
  title: string;
  category: string;
  description: string;
  prompt: string;
  mode: SurfacePlanMode;
  surfacePlan: SurfacePlan;
  scriptPolicy: ScriptPolicy;
  capabilityNames: string[];
  componentNames?: string[];
  surfaceCeiling: SurfaceCeiling;
}

function ceilingFor(plan: SurfacePlan): SurfaceCeiling {
  return {
    purposes: [plan.purpose],
    runtimes: [plan.runtime],
    data: [plan.data],
    authorities: [plan.authority],
    persistences: [plan.persistence],
  };
}

function preset(input: Omit<GalleryPreset, 'scriptPolicy' | 'surfaceCeiling'>): GalleryPreset {
  return {
    ...input,
    scriptPolicy: deriveSurfacePlanControls(input.surfacePlan).scriptPolicy,
    surfaceCeiling: ceilingFor(input.surfacePlan),
  };
}

export const GALLERY_PRESETS: GalleryPreset[] = [
  preset({
    id: 'static-brief',
    title: 'Static Brief',
    category: 'Read-only',
    description: 'A rich generated brief with embedded data and no executable authority.',
    prompt:
      'compare renting versus buying a small coffee cart for a first-time weekend pop-up operator. Make it concrete, skimmable, and decision-oriented.',
    mode: 'static',
    capabilityNames: [],
    surfacePlan: {
      purpose: 'compare',
      runtime: 'static',
      data: 'embedded',
      authority: 'none',
      persistence: 'replayable',
    },
  }),
  preset({
    id: 'search-explorer',
    title: 'Search Explorer',
    category: 'Host data',
    description: 'Generated search UI reads through a host-owned data resource.',
    prompt:
      'build a weeknight dinner explorer where i can search for recipes, see loading and error states, browse results, and pick one to inspect.',
    mode: 'interactive',
    capabilityNames: ['search'],
    surfacePlan: {
      purpose: 'explore',
      runtime: 'declarative',
      data: 'host-resource',
      authority: 'read',
      persistence: 'replayable',
    },
  }),
  preset({
    id: 'decision-picker',
    title: 'Decision Picker',
    category: 'Host action',
    description: 'A comparison surface can save a choice through a host-granted action.',
    prompt:
      'help me choose between three launch announcement approaches for a small developer tool. Compare tradeoffs and let me save the best option.',
    mode: 'interactive',
    capabilityNames: ['choose'],
    surfacePlan: {
      purpose: 'compare',
      runtime: 'declarative',
      data: 'embedded',
      authority: 'host-action',
      persistence: 'replayable',
    },
  }),
  preset({
    id: 'approval-flow',
    title: 'Approval Flow',
    category: 'Approval',
    description: 'Generated publish UI can request approval, but the host owns the decision.',
    prompt:
      'build a publish review panel for a product update summary. Make the draft easy to review and include one approval-gated publish action.',
    mode: 'interactive',
    capabilityNames: ['publish_summary'],
    surfacePlan: {
      purpose: 'operate',
      runtime: 'declarative',
      data: 'embedded',
      authority: 'approval-gated',
      persistence: 'replayable',
    },
  }),
  preset({
    id: 'component-island-dashboard',
    title: 'Component Island Dashboard',
    category: 'Trusted components',
    description: 'The model authors layout; trusted host components render outside the iframe.',
    prompt:
      'build a compact launch readiness dashboard. Use host-rendered MetricCard, TrendSparkline, and ApprovalStatus components for the key signals, then write the surrounding interpretation and actions.',
    mode: 'interactive',
    capabilityNames: ['choose'],
    componentNames: ['MetricCard', 'TrendSparkline', 'ApprovalStatus'],
    surfacePlan: {
      purpose: 'review',
      runtime: 'declarative',
      data: 'embedded',
      authority: 'host-action',
      persistence: 'replayable',
    },
  }),
  preset({
    id: 'worker-analysis',
    title: 'Worker Analysis',
    category: 'Background work',
    description: 'Host-owned worker-style resources compute data and push safe state back.',
    prompt:
      'create a risk analysis surface for launching a paid beta next month. Let me run a background readiness analysis and compute a small score.',
    mode: 'interactive',
    capabilityNames: ['analysis', 'compute_score'],
    surfacePlan: {
      purpose: 'review',
      runtime: 'worker',
      data: 'worker',
      authority: 'host-action',
      persistence: 'replayable',
    },
  }),
];

export function findPreset(id: string): GalleryPreset {
  return GALLERY_PRESETS.find((preset) => preset.id === id) ?? GALLERY_PRESETS[0]!;
}

export function planText(plan: SurfacePlan): string {
  return `${plan.purpose}/${plan.runtime}/${plan.data}/${plan.authority}/${plan.persistence}`;
}
