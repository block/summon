import type {
  ToolPack,
  SurfacePlan,
  SurfacePlanMode,
  SurfaceScale,
} from '@decentralized-design/summon/engine';
import {
  ceilings,
  compileSurfacePolicy,
  type ToolRegistry,
  type SurfacePolicy,
} from '@decentralized-design/summon';
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
  scale?: SurfaceScale;
  fingerprintId?: string | null;
}

export interface ActiveContract {
  scenarioId: string;
  prompt: string;
  mode: Mode;
  toolNames: string[];
  agentWard?: boolean;
  surfacePolicy?: SurfacePolicy;
  surfacePlan: SurfacePlan;
  layoutId?: string;
  scale?: SurfaceScale;
  fingerprintId?: string | null;
  modelProvider?: string | null;
  generationModel?: string;
  utilityModel?: string;
  customModel?: boolean;
  modelOptions?: {
    maxOutputTokens?: number;
    anthropicThinking?: 'adaptive' | 'off';
    effort?: 'low' | 'medium' | 'high' | 'max';
  };
  modelProfiles?: Record<string, {
    modelProvider?: string;
    generationModel?: string;
    utilityModel?: string;
    customModel?: boolean;
    modelOptions?: {
      maxOutputTokens?: number;
      anthropicThinking?: 'adaptive' | 'off';
      effort?: 'low' | 'medium' | 'high' | 'max';
    };
  }>;
}

/**
 * Scenario definitions author only the policy; the plan is computed from it
 * at module load (compileSurfacePolicy is the single source of truth for
 * policy→plan derivation — no hand-maintained parallel copies).
 */
type ShowcaseScenarioDefinition = Omit<ShowcaseScenario, 'surfacePlan'>;

const SCENARIO_DEFINITIONS: ShowcaseScenarioDefinition[] = [
  {
    id: 'host-resource-search',
    label: 'Hike finder',
    prompt:
      "help me find a weekend hike near me — let me search by distance and difficulty and compare a couple options",
    mode: 'interactive',
    toolNames: ['search'],
    surfacePolicy: { ceiling: ceilings.declarative, purpose: 'explore', grants: ['search'] },
    },
  {
    id: 'host-ai-brainstorm',
    label: 'Coffee cart name',
    prompt:
      "brainstorm names for my new coffee cart — playful, easy to say, and not already a big chain",
    mode: 'interactive',
    toolNames: ['ai'],
    surfacePolicy: { ceiling: ceilings.declarative, purpose: 'explore', grants: ['ai'] },
    },
  {
    id: 'github-profile-lookup',
    label: 'GitHub profile',
    prompt:
      'look up a GitHub username and help me understand their profile, top repos, and how active they have been',
    mode: 'interactive',
    toolNames: ['github_lookup'],
    surfacePolicy: { ceiling: ceilings.declarative, purpose: 'explore', grants: ['github_lookup'] },
    },
  {
    id: 'surface-document-fidelity',
    label: 'Job offer call',
    prompt:
      'help me review two job offers, compare the main tradeoffs side by side, and choose the one to accept',
    mode: 'interactive',
    toolNames: ['choose'],
    surfacePolicy: {
      ceiling: ceilings.declarative,
      purpose: 'review',
      grants: ['choose'],
    },
    },
  {
    id: 'static-summary',
    label: '401k explainer',
    prompt: 'explain what a 401k match actually means for someone who has never had one, and show when it makes sense to max it out',
    mode: 'static',
    toolNames: [],
    surfacePolicy: { purpose: 'compare' },
    },
  {
    id: 'decision-picker',
    label: 'Phone plan pick',
    prompt:
      'help me choose between three phone plans for a family of four, compare tradeoffs, and save the best fit',
    mode: 'interactive',
    toolNames: ['choose'],
    surfacePolicy: { ceiling: ceilings.declarative, purpose: 'compare', grants: ['choose'] },
    },
  {
    id: 'declarative-form',
    label: 'Housewarming RSVPs',
    prompt:
      'collect RSVPs for my housewarming with headcount and plus-ones, and let me submit the final guest list',
    mode: 'interactive',
    toolNames: ['submit'],
    surfacePolicy: { ceiling: ceilings.declarative, purpose: 'collect', grants: ['submit'] },
    },
  {
    id: 'worker-analysis',
    label: 'Spending score',
    prompt:
      'analyze my past three months of spending, compute a savings-rate score, and show me the biggest leaks to fix',
    mode: 'interactive',
    toolNames: ['analysis', 'compute_score'],
    surfacePolicy: { ceiling: ceilings.worker, purpose: 'review', grants: ['analysis', 'compute_score'] },
    },
  {
    id: 'approval-publish',
    label: 'Publish approval',
    prompt:
      'draft a price increase email to my clients i can review, then ask for approval before publishing it',
    mode: 'interactive',
    toolNames: ['publish_summary'],
    surfacePolicy: { ceiling: ceilings.approval, purpose: 'operate', grants: ['publish_summary'] },
    },
  {
    id: 'local-state-motion',
    label: 'Chore vote',
    prompt:
      'help me and my roommate divide the chores fairly, compare the options, track votes, and make the final split less awkward',
    mode: 'interactive',
    toolNames: ['choose', 'counter'],
    surfacePolicy: { ceiling: ceilings.declarative, purpose: 'explore', grants: ['choose', 'counter'] },
    },
  {
    id: 'offer-picker',
    label: 'Savings picker',
    prompt:
      'compare three savings accounts on fees and rate, make the preferred one easy to choose, and show the saved selection clearly',
    mode: 'interactive',
    toolNames: ['choose'],
    surfacePolicy: { ceiling: ceilings.declarative, purpose: 'explore', grants: ['choose'] },
  },
  {
    id: 'layout-card',
    label: 'Freelance intake',
    prompt:
      'create a freelance request intake card where i can submit scope, budget, deadline, and next step',
    mode: 'interactive',
    toolNames: ['submit'],
    surfacePolicy: { ceiling: ceilings.declarative, purpose: 'collect', grants: ['submit'] },
    layoutId: 'card-structured',
    },
  {
    id: 'sibling-summon',
    label: 'Trip planner',
    prompt:
      'help me search for weekend getaway spots and spin up a separate packing guide for the trip i decide to take',
    mode: 'interactive',
    toolNames: ['search', 'summon'],
    surfacePolicy: { ceiling: ceilings.declarative, purpose: 'explore', grants: ['search', 'summon'] },
    },
];

function planForPolicy(policy: SurfacePolicy): SurfacePlan {
  return compileSurfacePolicy(policy, { tools: showcaseToolPack() }).surfacePlan;
}

let cachedToolPack: ToolPack | null = null;

function showcaseToolPack(): ToolPack {
  cachedToolPack ??= createDemoToolRegistry({ onSummon: () => {} }).toContract().pack;
  return cachedToolPack;
}

export const SHOWCASE_SCENARIOS: ShowcaseScenario[] = SCENARIO_DEFINITIONS.map(
  (definition) => ({
    ...definition,
    surfacePlan: planForPolicy(definition.surfacePolicy),
  }),
);

export function createGhostShowcaseScenario(rootId: string): ShowcaseScenario {
  const surfacePolicy: SurfacePolicy = {
    ceiling: ceilings.declarative,
    purpose: 'review',
    grants: ['choose'],
  };
  return {
    id: `ghost-${rootId}`,
    label: `Fingerprint: ${rootId}`,
    prompt:
      'compare three possible directions for a small project update, explain the tradeoffs, and let me save the best fit',
    mode: 'interactive',
    toolNames: ['choose'],
    surfacePolicy,
    surfacePlan: planForPolicy(surfacePolicy),
    fingerprintId: rootId,
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
