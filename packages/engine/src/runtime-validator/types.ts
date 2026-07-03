import type {
  ActionStateKeys,
  ToolKind,
  ToolStateKeys,
  ToolTrigger,
} from '../tool-contract.js';
import type { ToolSurface, SurfacePlan } from '../surface-plan.js';
import type { ValidationLimits } from '../validation-limits.js';

export interface ValidationContext {
  mode: 'static' | 'interactive';
  allowedTools?: Iterable<string>;
  tools?: Iterable<ValidationTool>;
  definedTokens?: ReadonlySet<string>;
  surfacePlan?: SurfacePlan;
  limits?: Partial<ValidationLimits>;
}

export interface ValidationTool {
  name: string;
  kind?: ToolKind;
  triggers?: ToolTrigger[];
  stateKeys?: ToolStateKeys;
  actionStateKeys?: ActionStateKeys;
  surface?: ToolSurface;
}
