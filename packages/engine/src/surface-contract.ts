import {
  defaultTriggersForKind,
  type ActionStateKeys,
  type CapabilityKind,
  type CapabilityStateKeys,
  type CapabilityTrigger,
} from './capability-contract.js';
import type { ContractIssue } from './contracts.js';
import type {
  CapabilityPack,
  ComponentPack,
  ComponentSizing,
  ScriptPolicy,
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
  scriptPolicy: ScriptPolicy;
}

export interface SurfaceContractTool {
  name: string;
  kind: CapabilityKind;
  description: string;
  triggers: CapabilityTrigger[];
  argsSchema: string;
  stateShape: string;
  stateKeys?: CapabilityStateKeys;
  actionStateKeys?: ActionStateKeys;
  resultSchema?: string;
  defaultDataShape?: string;
  surface: {
    data: SurfaceData;
    authority: SurfaceAuthority;
  };
}

export interface SurfaceContractComponent {
  name: string;
  description: string;
  propsSchema: string;
  sizing?: ComponentSizing;
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
  components: SurfaceContractComponent[];
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
    capabilities: options.capabilities,
    components: options.components,
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
      scriptPolicy: compiledPolicy.scriptPolicy,
    },
    tools: formatTools(compiledPolicy.capabilities),
    components: formatComponents(compiledPolicy.components),
    layout: formatLayout(layout ?? null),
    issues: compiledPolicy.issues,
  };
}

function formatTools(pack: CapabilityPack | null): SurfaceContractTool[] {
  return (pack?.intents ?? []).map((intent) => {
    const kind = intent.kind ?? 'action';
    const tool: SurfaceContractTool = {
      name: intent.name,
      kind,
      description: intent.description,
      triggers: intent.triggers?.length
        ? [...intent.triggers]
        : defaultTriggersForKind(kind),
      argsSchema: intent.argsSchema,
      stateShape: intent.stateShape,
      surface: {
        data: intent.surface?.data ?? (kind === 'resource' ? 'host-resource' : 'embedded'),
        authority: intent.surface?.authority ?? (kind === 'resource' ? 'read' : 'host-action'),
      },
    };
    if (intent.stateKeys) tool.stateKeys = { ...intent.stateKeys };
    if (intent.actionStateKeys) tool.actionStateKeys = { ...intent.actionStateKeys };
    if (intent.resultSchema) tool.resultSchema = intent.resultSchema;
    if (intent.defaultDataShape) tool.defaultDataShape = intent.defaultDataShape;
    return tool;
  });
}

function formatComponents(pack: ComponentPack | null): SurfaceContractComponent[] {
  return (pack?.components ?? []).map((component) => {
    const formatted: SurfaceContractComponent = {
      name: component.name,
      description: component.description,
      propsSchema: component.propsSchema,
      surface: {
        data: component.surface?.data ?? 'embedded',
        authority: component.surface?.authority ?? 'none',
      },
    };
    if (component.sizing) formatted.sizing = { ...component.sizing };
    return formatted;
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
