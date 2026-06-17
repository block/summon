import {
  defaultTriggersForKind,
  type ActionStateKeys,
  type ToolKind,
  type ToolStateKeys,
  type ToolTrigger,
} from './tool-contract.js';
import type { ContractIssue } from './contracts.js';
import type {
  ToolPack,
  SummonLayout,
} from './prompt.js';
import {
  compileSurfacePolicy,
  type CompileSurfacePolicyOptions,
  type CompiledSurfacePolicy,
  type NormalizedSurfacePolicy,
  type SurfacePolicy,
} from './surface-policy.js';
import type {
  SurfaceAuthority,
  SurfaceData,
  SurfacePlan,
  SurfacePlanMode,
} from './surface-plan.js';

export interface SurfaceContractSurface {
  policy: NormalizedSurfacePolicy;
  plan: SurfacePlan;
  mode: SurfacePlanMode;
}

export interface SurfaceContractTool {
  name: string;
  kind: ToolKind;
  description: string;
  triggers: ToolTrigger[];
  argsSchema: string;
  stateShape: string;
  stateKeys?: ToolStateKeys;
  actionStateKeys?: ActionStateKeys;
  resultSchema?: string;
  defaultDataShape?: string;
  surface: {
    data: SurfaceData;
    authority: SurfaceAuthority;
  };
}

export interface SurfaceContractLayout {
  id: string;
  slots: Array<{
    id: string;
    purpose: string;
  }>;
}

export interface SurfaceContractView {
  surface: SurfaceContractSurface;
  tools: SurfaceContractTool[];
  layout: SurfaceContractLayout | null;
  issues: ContractIssue[];
}

export interface CompileSurfaceContractViewOptions extends CompileSurfacePolicyOptions {
  layout?: SummonLayout | SurfaceContractLayout | null;
}

export function compileSurfaceContractView(
  policy: SurfacePolicy | unknown,
  options: CompileSurfaceContractViewOptions = {},
): SurfaceContractView {
  const compiled = compileSurfacePolicy(policy, {
    tools: options.tools,
  });
  return surfaceContractViewFromCompiledPolicy(compiled, options.layout ?? null);
}

export function surfaceContractViewFromCompiledPolicy(
  compiledPolicy: CompiledSurfacePolicy,
  layout?: SummonLayout | SurfaceContractLayout | null,
): SurfaceContractView {
  return {
    surface: {
      policy: compiledPolicy.policy,
      plan: compiledPolicy.surfacePlan,
      mode: compiledPolicy.mode,
    },
    tools: formatTools(compiledPolicy.tools),
    layout: formatLayout(layout ?? null),
    issues: compiledPolicy.issues,
  };
}

function formatTools(pack: ToolPack | null): SurfaceContractTool[] {
  return (pack?.tools ?? []).map((spec) => {
    const kind = spec.kind ?? 'action';
    const tool: SurfaceContractTool = {
      name: spec.name,
      kind,
      description: spec.description,
      triggers: spec.triggers?.length
        ? [...spec.triggers]
        : defaultTriggersForKind(kind),
      argsSchema: spec.argsSchema,
      stateShape: spec.stateShape,
      surface: {
        data: spec.surface?.data ?? (kind === 'resource' ? 'host-resource' : 'embedded'),
        authority: spec.surface?.authority ?? (kind === 'resource' ? 'read' : 'host-action'),
      },
    };
    if (spec.stateKeys) tool.stateKeys = { ...spec.stateKeys };
    if (spec.actionStateKeys) tool.actionStateKeys = { ...spec.actionStateKeys };
    if (spec.resultSchema) tool.resultSchema = spec.resultSchema;
    if (spec.defaultDataShape) tool.defaultDataShape = spec.defaultDataShape;
    return tool;
  });
}

function formatLayout(layout: SummonLayout | SurfaceContractLayout | null): SurfaceContractLayout | null {
  if (!layout) return null;
  return {
    id: layout.id,
    slots: layout.slots.map((slot) => ({
      id: slot.id,
      purpose: slot.purpose,
    })),
  };
}
