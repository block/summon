import {
  DEFAULT_SURFACE_CEILING,
  constrainSurfacePlan,
  normalizeSurfaceCeiling,
  normalizeSurfacePlan,
  surfacePlanScriptPolicy,
  surfacePlanWithinCeiling,
  type SurfacePlan,
} from '@summon-internal/engine';
import type {
  ResolvedSurfaceGenerationPlan,
  ResolveSurfaceGenerationPlanInput,
} from './types.js';

export function resolveSurfaceGenerationPlan(
  input: ResolveSurfaceGenerationPlanInput,
): ResolvedSurfaceGenerationPlan {
  const ceiling = normalizeSurfaceCeiling(input.rawSurfaceCeiling) ?? DEFAULT_SURFACE_CEILING;
  const explicit = normalizeSurfacePlan(input.rawSurfacePlan);
  const explicitAccepted = Boolean(explicit && surfacePlanWithinCeiling(explicit, ceiling));
  const source = explicitAccepted ? 'explicit' : 'default';
  let surfacePlan = explicitAccepted ? explicit! : defaultSurfacePlan();

  surfacePlan = constrainSurfacePlan(surfacePlan, ceiling);

  const mode = surfacePlanNeedsInteractivity(surfacePlan) ? 'interactive' : input.mode;
  const scriptPolicy = surfacePlanScriptPolicy(surfacePlan);
  return { mode, scriptPolicy, surfacePlan, ceiling, explicitAccepted, source };
}

function surfacePlanNeedsInteractivity(plan: SurfacePlan): boolean {
  return plan.data !== 'embedded' || plan.authority !== 'none';
}

function defaultSurfacePlan(): SurfacePlan {
  return {
    purpose: 'inform',
    runtime: 'arrow',
    data: 'embedded',
    authority: 'none',
    persistence: 'replayable',
    network: 'none',
  };
}
