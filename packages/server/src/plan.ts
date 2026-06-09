import {
  DEFAULT_SURFACE_CEILING,
  constrainSurfacePlan,
  deriveSurfacePlanControls,
  normalizeSurfaceCeiling,
  normalizeSurfacePlan,
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
  let surfacePlan = explicitAccepted ? explicit! : defaultSurfacePlanForMode(input.mode);

  surfacePlan = constrainSurfacePlan(surfacePlan, ceiling);

  const { mode, scriptPolicy } = deriveSurfacePlanControls(surfacePlan);
  return { mode, scriptPolicy, surfacePlan, ceiling, explicitAccepted, source };
}

function defaultSurfacePlanForMode(mode: ResolveSurfaceGenerationPlanInput['mode']): SurfacePlan {
  if (mode === 'static') {
    return {
      purpose: 'inform',
      runtime: 'static',
      data: 'embedded',
      authority: 'none',
      persistence: 'replayable',
    };
  }

  return {
    purpose: 'inform',
    runtime: 'declarative',
    data: 'embedded',
    authority: 'none',
    persistence: 'replayable',
  };
}
