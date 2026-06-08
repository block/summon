import {
  DEFAULT_SURFACE_CEILING,
  constrainSurfacePlan,
  deriveSurfacePlanControls,
  inferSurfacePlan,
  normalizeSurfaceCeiling,
  normalizeSurfacePlan,
  surfacePlanWithinCeiling,
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
  let surfacePlan = explicitAccepted
    ? explicit!
    : inferSurfacePlan({
        prompt: input.prompt,
        mode: input.mode,
        scriptPolicy: input.scriptPolicy,
        capabilities: input.capabilities,
      });

  surfacePlan = constrainSurfacePlan(surfacePlan, ceiling);

  if (input.mode === 'static') {
    surfacePlan = {
      ...surfacePlan,
      runtime: 'static',
      data: 'embedded',
      authority: 'none',
    };
  }

  const { mode, scriptPolicy } = deriveSurfacePlanControls(surfacePlan);
  return { mode, scriptPolicy, surfacePlan, ceiling, explicitAccepted };
}
