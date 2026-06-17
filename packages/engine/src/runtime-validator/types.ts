import type {
  ActionStateKeys,
  CapabilityKind,
  CapabilityStateKeys,
  CapabilityTrigger,
} from '../capability-contract.js';
import type { ScriptPolicy } from '../prompt.js';
import type { CapabilitySurface, ComponentSurface, SurfacePlan } from '../surface-plan.js';
import type { ValidationLimits } from '../validation-limits.js';

export interface ValidationContext {
  mode: 'static' | 'interactive';
  scriptPolicy?: ScriptPolicy;
  allowedIntents?: Iterable<string>;
  capabilities?: Iterable<ValidationCapability>;
  components?: Iterable<ValidationComponent>;
  definedTokens?: ReadonlySet<string>;
  surfacePlan?: SurfacePlan;
  limits?: Partial<ValidationLimits>;
}

export interface ValidationCapability {
  name: string;
  kind?: CapabilityKind;
  triggers?: CapabilityTrigger[];
  stateKeys?: CapabilityStateKeys;
  actionStateKeys?: ActionStateKeys;
  surface?: CapabilitySurface;
}

export interface ValidationComponent {
  name: string;
  surface?: ComponentSurface;
}
