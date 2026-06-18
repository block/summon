import type {
  ToolPack,
  SurfacePlan,
  SurfacePlanMode,
} from '@anarchitecture/summon/engine';
import type { ToolRegistry, SurfacePolicy } from '@anarchitecture/summon';
import { createDemoToolRegistry, type DemoHandlerOptions } from './tools.js';

export type Mode = SurfacePlanMode;

export interface ShowcaseScenario {
  id: string;
  label: string;
  prompt: string;
  mode: Mode;
  toolNames: string[];
  surfacePolicy: SurfacePolicy;
  surfacePlan: SurfacePlan;
  layoutId?: string;
  tokenOverrides?: Record<string, string>;
  directionId?: string | null;
}

export interface ActiveContract {
  scenarioId: string;
  prompt: string;
  mode: Mode;
  toolNames: string[];
  agentBroker?: boolean;
  surfacePolicy?: SurfacePolicy;
  surfacePlan: SurfacePlan;
  layoutId?: string;
  tokenOverrides?: Record<string, string>;
  directionId?: string | null;
  modelProvider?: string | null;
  generationModel?: string;
  utilityModel?: string;
  customModel?: boolean;
  modelOptions?: {
    maxOutputTokens?: number;
    anthropicThinking?: 'adaptive' | 'off';
    effort?: 'low' | 'medium' | 'high';
  };
}

export const SHOWCASE_SCENARIOS: ShowcaseScenario[] = [
  {
    id: 'host-resource-search',
    label: 'Host resource search',
    prompt:
      'help me build a weeknight dinner finder where i can search for recipes and see loading, error, and real host data states clearly',
    mode: 'interactive',
    toolNames: ['search'],
    surfacePolicy: { tier: 'declarative', purpose: 'explore', grants: ['search'] },
      surfacePlan: {
        purpose: 'explore',
        runtime: 'arrow',
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
    toolNames: ['ai'],
    surfacePolicy: { tier: 'declarative', purpose: 'explore', grants: ['ai'] },
      surfacePlan: {
        purpose: 'explore',
        runtime: 'arrow',
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
    toolNames: ['github_lookup'],
    surfacePolicy: { tier: 'declarative', purpose: 'explore', grants: ['github_lookup'] },
      surfacePlan: {
        purpose: 'explore',
        runtime: 'arrow',
        data: 'host-resource',
        authority: 'read',
        persistence: 'replayable',
        network: 'none',
      },
    },
  {
    id: 'arrow-fidelity',
    label: 'Arrow launch dashboard',
    prompt:
      'build a compact launch-readiness dashboard with metric cards, a trend sparkline, launch status treatments, and a choose control for the final launch recommendation, all rendered directly in Arrow',
    mode: 'interactive',
    toolNames: ['choose'],
    surfacePolicy: {
      tier: 'declarative',
      purpose: 'review',
      grants: ['choose'],
    },
      surfacePlan: {
        purpose: 'review',
        runtime: 'arrow',
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
    toolNames: [],
    surfacePolicy: { tier: 'static', purpose: 'compare' },
      surfacePlan: {
        purpose: 'compare',
        runtime: 'arrow',
        data: 'embedded',
        authority: 'none',
        persistence: 'replayable',
        network: 'none',
      },
    },
  {
    id: 'decision-picker',
    label: 'Decision picker',
    prompt:
      'help me choose between three launch announcement approaches for a small developer tool. Compare tradeoffs and let me save the best option.',
    mode: 'interactive',
    toolNames: ['choose'],
    surfacePolicy: { tier: 'declarative', purpose: 'compare', grants: ['choose'] },
      surfacePlan: {
        purpose: 'compare',
        runtime: 'arrow',
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
    toolNames: ['submit'],
    surfacePolicy: { tier: 'declarative', purpose: 'collect', grants: ['submit'] },
      surfacePlan: {
        purpose: 'collect',
        runtime: 'arrow',
        data: 'embedded',
        authority: 'host-action',
        persistence: 'replayable',
        network: 'none',
      },
    },
  {
    id: 'worker-analysis',
    label: 'Worker analysis',
    prompt:
      'run host analysis for a product launch readiness topic, compute a score with a host-owned background worker, and show loading, error, and result states',
    mode: 'interactive',
    toolNames: ['analysis', 'compute_score'],
    surfacePolicy: { tier: 'worker', purpose: 'review', grants: ['analysis', 'compute_score'] },
      surfacePlan: {
        purpose: 'review',
        runtime: 'arrow',
        data: 'worker',
        authority: 'host-action',
        persistence: 'replayable',
        network: 'none',
      },
    },
  {
    id: 'approval-publish',
    label: 'Approval publish',
    prompt:
      'build a publish approval panel where i can review a titled summary, request host approval, and show pending, approved, denied, and error states',
    mode: 'interactive',
    toolNames: ['publish_summary'],
    surfacePolicy: { tier: 'approval', purpose: 'operate', grants: ['publish_summary'] },
      surfacePlan: {
        purpose: 'operate',
        runtime: 'arrow',
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
      'build an Arrow behavior lab for ranking launch options: use reusable option rows, a keyed list, computed local summary, tabs or disclosure, state-driven styling, subtle motion, and host-backed choose and counter controls',
    mode: 'interactive',
    toolNames: ['choose', 'counter'],
    surfacePolicy: { tier: 'declarative', purpose: 'explore', grants: ['choose', 'counter'] },
      surfacePlan: {
        purpose: 'explore',
        runtime: 'arrow',
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
    toolNames: ['choose'],
    surfacePolicy: { tier: 'declarative', purpose: 'explore', grants: ['choose'] },
    tokenOverrides: {
      'color-accent': '#0f8cff',
      'color-accent-fg': '#ffffff',
    },
      surfacePlan: {
        purpose: 'explore',
        runtime: 'arrow',
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
    toolNames: ['submit'],
    surfacePolicy: { tier: 'declarative', purpose: 'collect', grants: ['submit'] },
    layoutId: 'card-structured',
      surfacePlan: {
        purpose: 'collect',
        runtime: 'arrow',
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
    toolNames: ['search', 'summon'],
    surfacePolicy: { tier: 'declarative', purpose: 'explore', grants: ['search', 'summon'] },
      surfacePlan: {
        purpose: 'explore',
        runtime: 'arrow',
        data: 'host-resource',
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
    toolNames: ['choose'],
    surfacePolicy: { tier: 'declarative', purpose: 'review', grants: ['choose'] },
      surfacePlan: {
        purpose: 'review',
        runtime: 'arrow',
        data: 'embedded',
        authority: 'host-action',
        persistence: 'replayable',
        network: 'none',
      },
    directionId: `ghost:${rootId}`,
  };
}

export function narrowToolPack(
  pack: ToolPack,
  toolNames: readonly string[],
): ToolPack {
  const allowed = new Set(toolNames);
  const tools = pack.tools.filter((tool) => allowed.has(tool.name));
  const denied = pack.tools
    .map((tool) => tool.name)
    .filter((name) => !allowed.has(name));
  const patterns = (pack.patterns ?? []).filter((pattern) => {
    if (denied.some((name) => mentionsTool(pattern.code, name))) return false;
    return toolNames.some((name) => mentionsTool(pattern.code, name));
  });
  return {
    tools,
    ...(patterns.length > 0 ? { patterns } : {}),
  };
}

export function createScopedDemoRegistry(
  opts: DemoHandlerOptions,
  toolNames: readonly string[],
): ToolRegistry {
  const registry = createDemoToolRegistry(opts);
  const allowed = new Set(toolNames);
  const excluded = registry.tools().filter((name) => !allowed.has(name));
  return registry.without(excluded);
}

function mentionsTool(code: string, name: string): boolean {
  return (
    code.includes(`"${name}"`) ||
    code.includes(`'${name}'`) ||
    code.includes(`=${name}`) ||
    code.includes(`>${name}<`)
  );
}
