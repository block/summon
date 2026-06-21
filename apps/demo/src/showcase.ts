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
    label: 'Dinner finder',
    prompt:
      "i'm tired and have chicken, pasta, and spinach — help me search for weeknight dinner ideas i can compare",
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
    label: 'Gift ideas',
    prompt:
      "brainstorm birthday gift ideas for my sister — she's 32, into pottery and hiking, and i want something thoughtful",
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
    label: 'GitHub profile',
    prompt:
      'look up a GitHub username and help me understand the profile, followers, and public repo signal from the returned data',
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
    label: 'Launch readiness',
    prompt:
      'help me review whether our small product launch is ready, compare the main signals, and choose the final recommendation',
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
    label: 'IRA explainer',
    prompt: 'explain Roth vs traditional IRA for someone new to retirement saving and show when each one makes sense',
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
    label: 'Announcement pick',
    prompt:
      'help me choose between three launch announcement approaches for a small developer tool, compare tradeoffs, and save the best fit',
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
    label: 'Lunch order',
    prompt:
      'collect a team lunch order for eight people, including dietary notes, and let me submit the final order',
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
    label: 'Blocker score',
    prompt:
      'analyze launch readiness for instant payouts, compute a score, and show me the biggest blockers to resolve',
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
    label: 'Publish approval',
    prompt:
      'prepare a release note i can review, then ask for approval before publishing it to the team update log',
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
    label: 'Weekend vote',
    prompt:
      'help me and my partner vote on weekend activities, compare the options, track votes, and make the final pick less awkward',
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
    id: 'offer-picker',
    label: 'Offer picker',
    prompt:
      'compare three customer retention offers, make the preferred one easy to choose, and show the saved selection clearly',
    mode: 'interactive',
    toolNames: ['choose'],
    surfacePolicy: { tier: 'declarative', purpose: 'explore', grants: ['choose'] },
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
    id: 'layout-card',
    label: 'Project intake',
    prompt:
      'create a project intake card where i can submit owner, deadline, risk, and requested next step',
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
    label: 'Recipe prep',
    prompt:
      'help me search for dinner ideas and spin up a separate prep guide for the recipe i decide to cook',
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
      'compare three possible directions for a small project update, explain the tradeoffs, and let me save the best fit',
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
    directionId: `fingerprint:${rootId}`,
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
