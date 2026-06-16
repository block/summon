import type {
  CapabilityPack,
  ScriptPolicy,
  SurfacePlan,
  SurfacePlanMode,
} from '@anarchitecture/summon/engine';
import type { CapabilityRegistry, SurfacePolicy } from '@anarchitecture/summon';
import { createDemoCapabilityRegistry, type DemoHandlerOptions } from './capabilities.js';

export type Mode = SurfacePlanMode;

export interface RepairOptions {
  enabled: boolean;
  maxAttempts?: number;
  maxTargets?: number;
}

export interface ShowcaseScenario {
  id: string;
  label: string;
  prompt: string;
  mode: Mode;
  capabilityNames: string[];
  componentNames?: string[];
  surfacePolicy: SurfacePolicy;
  surfacePlan: SurfacePlan;
  scriptPolicy?: ScriptPolicy;
  layoutId?: string;
  tokenOverrides?: Record<string, string>;
  repair?: RepairOptions;
  directionId?: string | null;
}

export interface ActiveContract {
  scenarioId: string;
  prompt: string;
  mode: Mode;
  capabilityNames: string[];
  componentNames?: string[];
  agentBroker?: boolean;
  surfacePolicy?: SurfacePolicy;
  surfacePlan: SurfacePlan;
  scriptPolicy: ScriptPolicy;
  layoutId?: string;
  tokenOverrides?: Record<string, string>;
  repair?: RepairOptions;
  directionId?: string | null;
  modelProvider?: string | null;
  generationModel?: string;
  utilityModel?: string;
  customModel?: boolean;
  modelOptions?: {
    maxOutputTokens?: number;
    repairMaxOutputTokens?: number;
    anthropicThinking?: 'adaptive' | 'off';
    effort?: 'low' | 'medium' | 'high';
  };
}

export const SHOWCASE_SCENARIOS: ShowcaseScenario[] = [
  {
    id: 'host-resource-search',
    label: 'Host Data Search',
    prompt:
      'help me build a weeknight dinner finder where i can search for recipes and see loading, error, and real host data states clearly',
    mode: 'interactive',
    capabilityNames: ['search'],
    surfacePolicy: { tier: 'declarative', purpose: 'explore', grants: ['search'] },
      surfacePlan: {
        purpose: 'explore',
        runtime: 'declarative',
        data: 'host-resource',
        authority: 'read',
        persistence: 'replayable',
        network: 'none',
      },
    },
  {
    id: 'host-ai-brainstorm',
    label: 'Host AI brainstorm',
    prompt:
      'build a brainstorm helper where i can ask host AI for birthday gift ideas and see loading, error, and response states clearly',
    mode: 'interactive',
    capabilityNames: ['ai'],
    surfacePolicy: { tier: 'declarative', purpose: 'explore', grants: ['ai'] },
      surfacePlan: {
        purpose: 'explore',
        runtime: 'declarative',
        data: 'host-resource',
        authority: 'read',
        persistence: 'replayable',
        network: 'none',
      },
    },
  {
    id: 'github-profile-lookup',
    label: 'GitHub profile lookup',
    prompt:
      'build a GitHub profile lookup where i can enter a username and see loading, error, avatar, follower, and repo states from host data',
    mode: 'interactive',
    capabilityNames: ['github_lookup'],
    surfacePolicy: { tier: 'declarative', purpose: 'explore', grants: ['github_lookup'] },
      surfacePlan: {
        purpose: 'explore',
        runtime: 'declarative',
        data: 'host-resource',
        authority: 'read',
        persistence: 'replayable',
        network: 'none',
      },
    },
  {
    id: 'component-islands',
    label: 'Trusted Components',
    prompt:
      'build a compact launch-readiness dashboard that uses host-rendered MetricCard, TrendSparkline, and ApprovalStatus component islands, plus a choose control for the final launch recommendation',
    mode: 'interactive',
    capabilityNames: ['choose'],
    componentNames: ['MetricCard', 'TrendSparkline', 'ApprovalStatus'],
    surfacePolicy: {
      tier: 'declarative',
      purpose: 'review',
      grants: ['choose'],
      components: ['MetricCard', 'TrendSparkline', 'ApprovalStatus'],
    },
      surfacePlan: {
        purpose: 'review',
        runtime: 'declarative',
        data: 'embedded',
        authority: 'host-action',
        persistence: 'replayable',
        network: 'none',
      },
    },
  {
    id: 'static-summary',
    label: 'Static summary',
    prompt: 'compare Roth vs traditional IRA for someone new to retirement saving',
    mode: 'static',
    capabilityNames: [],
    surfacePolicy: { tier: 'static', purpose: 'compare' },
      surfacePlan: {
        purpose: 'compare',
        runtime: 'static',
        data: 'embedded',
        authority: 'none',
        persistence: 'replayable',
        network: 'none',
      },
    },
  {
    id: 'decision-picker',
    label: 'Decision Picker',
    prompt:
      'help me choose between three launch announcement approaches for a small developer tool. Compare tradeoffs and let me save the best option.',
    mode: 'interactive',
    capabilityNames: ['choose'],
    surfacePolicy: { tier: 'declarative', purpose: 'compare', grants: ['choose'] },
      surfacePlan: {
        purpose: 'compare',
        runtime: 'declarative',
        data: 'embedded',
        authority: 'host-action',
        persistence: 'replayable',
        network: 'none',
      },
    },
  {
    id: 'declarative-form',
    label: 'Declarative form',
    prompt:
      'help me collect a team lunch order with required fields, submit validation, a success state, and field errors',
    mode: 'interactive',
    capabilityNames: ['submit'],
    surfacePolicy: { tier: 'declarative', purpose: 'collect', grants: ['submit'] },
      surfacePlan: {
        purpose: 'collect',
        runtime: 'declarative',
        data: 'embedded',
        authority: 'host-action',
        persistence: 'replayable',
        network: 'none',
      },
    },
  {
    id: 'worker-analysis',
    label: 'Worker Analysis',
    prompt:
      'run host analysis for a product launch readiness topic, compute a score with a host-owned background worker, and show loading, error, and result states',
    mode: 'interactive',
    capabilityNames: ['analysis', 'compute_score'],
    surfacePolicy: { tier: 'worker', purpose: 'review', grants: ['analysis', 'compute_score'] },
      surfacePlan: {
        purpose: 'review',
        runtime: 'worker',
        data: 'worker',
        authority: 'host-action',
        persistence: 'replayable',
        network: 'none',
      },
    },
  {
    id: 'approval-publish',
    label: 'Approval Publish',
    prompt:
      'build a publish approval panel where i can review a titled summary, request host approval, and show pending, approved, denied, and error states',
    mode: 'interactive',
    capabilityNames: ['publish_summary'],
    surfacePolicy: { tier: 'approval', purpose: 'operate', grants: ['publish_summary'] },
      surfacePlan: {
        purpose: 'operate',
        runtime: 'declarative',
        data: 'embedded',
        authority: 'approval-gated',
        persistence: 'replayable',
        network: 'none',
      },
    },
  {
    id: 'local-state-motion',
    label: 'Local state + motion',
    prompt:
      'build a scoring picker with tabs, disclosure, local highlighted selection, state-driven styling, and subtle motion using only declarative local state plus host-backed choose and counter controls',
    mode: 'interactive',
    capabilityNames: ['choose', 'counter'],
    surfacePolicy: { tier: 'declarative', purpose: 'explore', grants: ['choose', 'counter'] },
      surfacePlan: {
        purpose: 'explore',
        runtime: 'declarative',
        data: 'embedded',
        authority: 'host-action',
        persistence: 'replayable',
        network: 'none',
      },
    },
  {
    id: 'token-override',
    label: 'Token override',
    prompt:
      'build a compact option picker where I can choose an option with a prominent accent action and status badge, using only direction tokens for color',
    mode: 'interactive',
    capabilityNames: ['choose'],
    surfacePolicy: { tier: 'declarative', purpose: 'explore', grants: ['choose'] },
    tokenOverrides: {
      'color-accent': '#0f8cff',
      'color-accent-fg': '#ffffff',
    },
      surfacePlan: {
        purpose: 'explore',
        runtime: 'declarative',
        data: 'embedded',
        authority: 'host-action',
        persistence: 'replayable',
        network: 'none',
      },
      directionId: 'pulse',
  },
  {
    id: 'layout-card',
    label: 'Layout-constrained card',
    prompt:
      'create a compact project intake card where I can submit validated details, with a crisp header, useful content, and one or two action controls',
    mode: 'interactive',
    capabilityNames: ['submit'],
    surfacePolicy: { tier: 'declarative', purpose: 'collect', grants: ['submit'] },
    layoutId: 'card-structured',
      surfacePlan: {
        purpose: 'collect',
        runtime: 'declarative',
        data: 'embedded',
        authority: 'host-action',
        persistence: 'replayable',
        network: 'none',
      },
    },
  {
    id: 'sibling-summon',
    label: 'Sibling summon',
    prompt:
      'build a recipe explorer that can search for dinner ideas and includes a clear action to summon a separate prep guide for one result',
    mode: 'interactive',
    capabilityNames: ['search', 'summon'],
    surfacePolicy: { tier: 'declarative', purpose: 'explore', grants: ['search', 'summon'] },
      surfacePlan: {
        purpose: 'explore',
        runtime: 'declarative',
        data: 'host-resource',
        authority: 'host-action',
        persistence: 'replayable',
        network: 'none',
      },
    },
  {
    id: 'repair-diagnostics',
    label: 'Validation Retry Diagnostics',
    prompt:
      'build a compact onboarding checklist with validated submit controls and clear section structure; if a section is rejected, retry it within the same section',
    mode: 'interactive',
    capabilityNames: ['submit'],
    surfacePolicy: { tier: 'declarative', purpose: 'collect', grants: ['submit'] },
    repair: { enabled: true, maxAttempts: 1, maxTargets: 2 },
      surfacePlan: {
        purpose: 'collect',
        runtime: 'declarative',
        data: 'embedded',
        authority: 'host-action',
        persistence: 'replayable',
        network: 'none',
      },
    },
];

export function createGhostShowcaseScenario(rootId: string): ShowcaseScenario {
  return {
    id: `ghost-${rootId}`,
    label: `Fingerprint: ${rootId}`,
    prompt:
      'generate a review surface that follows this Ghost fingerprint package and lets me choose an approved direction with host-allowed controls',
    mode: 'interactive',
    capabilityNames: ['choose'],
    surfacePolicy: { tier: 'declarative', purpose: 'review', grants: ['choose'] },
      surfacePlan: {
        purpose: 'review',
        runtime: 'declarative',
        data: 'embedded',
        authority: 'host-action',
        persistence: 'replayable',
        network: 'none',
      },
    directionId: `ghost:${rootId}`,
  };
}

export function narrowCapabilityPack(
  pack: CapabilityPack,
  capabilityNames: readonly string[],
): CapabilityPack {
  const allowed = new Set(capabilityNames);
  const intents = pack.intents.filter((intent) => allowed.has(intent.name));
  const denied = pack.intents
    .map((intent) => intent.name)
    .filter((name) => !allowed.has(name));
  const patterns = (pack.patterns ?? []).filter((pattern) => {
    if (denied.some((name) => mentionsCapability(pattern.code, name))) return false;
    return capabilityNames.some((name) => mentionsCapability(pattern.code, name));
  });
  return {
    intents,
    ...(patterns.length > 0 ? { patterns } : {}),
  };
}

export function createScopedDemoRegistry(
  opts: DemoHandlerOptions,
  capabilityNames: readonly string[],
): CapabilityRegistry {
  const registry = createDemoCapabilityRegistry(opts);
  const allowed = new Set(capabilityNames);
  const excluded = registry.intents().filter((name) => !allowed.has(name));
  return registry.without(excluded);
}

function mentionsCapability(code: string, name: string): boolean {
  return (
    code.includes(`"${name}"`) ||
    code.includes(`'${name}'`) ||
    code.includes(`=${name}`) ||
    code.includes(`>${name}<`)
  );
}
