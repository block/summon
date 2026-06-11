import type { ProtocolLine } from './protocol.js';
import {
  SUMMON_FIXED_INSTRUCTIONS,
  buildCapabilitiesBlock,
  buildComponentsBlock,
  buildDirectionBlock,
  buildLayoutBlock,
  buildOverrideBlock,
  buildPosturesBlock,
  buildSurfaceContractBlock,
  type CapabilityPack,
  type ComponentPack,
  type DirectionInput,
  type PostureRegistry,
  type ScriptPolicy,
  type SummonLayout,
  type TokenOverride,
} from './prompt.js';
import {
  parseDefinedTokens,
  validateDirection,
  type DirectionOpts,
} from './direction-validator.js';
import {
  defaultTriggersForKind,
  hasCompleteResourceStateKeys,
} from './capability-contract.js';
import { formatTokenContract } from './token-contract.js';
import type { SurfaceContractView } from './surface-contract.js';
import {
  buildSurfacePlanBlock,
  surfacePlanScriptPolicy,
  type SurfacePlan,
} from './surface-plan.js';
import type {
  ValidationComponent,
  ValidationCapability,
  ValidationContext,
} from './runtime-validator.js';

export type ContractIssueSource =
  | 'protocol'
  | 'html'
  | 'token'
  | 'direction'
  | 'capability'
  | 'layout'
  | 'edit'
  | 'repair'
  | 'system';

export type ContractIssueSeverity = 'block' | 'warn';

export interface ContractIssue {
  source: ContractIssueSource;
  severity: ContractIssueSeverity;
  code: string;
  message: string;
  path?: string;
  hint?: string;
}

export interface ContractPromptBlock {
  id: string;
  text: string;
  cache: 'ephemeral' | 'none';
}

export type GhostGenerationSource = 'root' | 'resolved-context';

export type GhostTokenSourceKind =
  | 'ghost-config'
  | 'resolved-context'
  | 'base-direction'
  | 'summon-default';

export interface GhostGenerationContext {
  source?: GhostGenerationSource;
  prompt: string;
  product?: string;
  baseDirectionId?: string | null;
  tokenSource?: {
    kind: GhostTokenSourceKind;
    source: string;
    css: string;
    warnings: string[];
  };
  provenance?: unknown;
}

export interface CompiledTokenContract {
  promptVocabulary: string;
  definedTokens: Set<string>;
  liveOpportunistic: string[];
  issues: ContractIssue[];
}

export interface TokenContractInput {
  css?: string;
  opts?: DirectionOpts;
}

export interface DirectionContractInput extends DirectionInput {
  id?: string;
  tokensCss: string;
}

export interface CompiledDirectionContract {
  promptBlock: ContractPromptBlock;
  tokenContract: CompiledTokenContract;
  issues: ContractIssue[];
}

export interface CompiledCapabilityContract {
  pack: CapabilityPack;
  promptBlock: ContractPromptBlock | null;
  intentNames: string[];
  validationCapabilities: ValidationCapability[];
  initialState: Record<string, unknown>;
  issues: ContractIssue[];
}

export interface CapabilityContractOptions {
  scriptPolicy?: ScriptPolicy;
}

export interface CompiledComponentContract {
  pack: ComponentPack;
  promptBlock: ContractPromptBlock | null;
  validationComponents: ValidationComponent[];
  issues: ContractIssue[];
}

export interface SystemContractInput {
  mode: ValidationContext['mode'];
  direction?: DirectionContractInput | null;
  ghost?: GhostGenerationContext | null;
  /** @deprecated Use `ghost` with a first-class GhostGenerationContext. */
  ghostPrompt?: string | null;
  layout?: SummonLayout | null;
  editBlock?: string | null;
  capabilities?: CapabilityPack | null;
  components?: ComponentPack | null;
  scriptPolicy?: ScriptPolicy;
  tokenOverrides?: TokenOverride[];
  postures?: PostureRegistry | null;
  surfacePlan?: SurfacePlan | null;
  surfaceContract?: SurfaceContractView | null;
  activeTokensCss?: string | null;
}

export interface CompiledSystemContracts {
  promptBlocks: ContractPromptBlock[];
  validationContext: ValidationContext;
  startupLines: ProtocolLine[];
  surfaceContract?: SurfaceContractView;
  issues: ContractIssue[];
}

export function contractIssue(input: ContractIssue): ContractIssue {
  return input;
}

export function withIssueSeverity(
  issue: ContractIssue,
  severity: ContractIssueSeverity,
): ContractIssue {
  return { ...issue, severity };
}

export function hintsForContractIssue(issue: ContractIssue): string[] {
  if (issue.hint) return [issue.hint];
  switch (issue.code) {
    case 'external-url':
      return ['Inline assets as data URLs or remove the external reference.'];
    case 'unsafe-tag':
      return ['Use plain HTML elements; remove iframe/object/embed/link/meta/base-like tags.'];
    case 'inline-handler':
      return ['Replace inline handlers with data-summon attributes or scoped addEventListener calls.'];
    case 'static-script':
      return ['Remove script tags in static mode, or express the UI without interactivity.'];
    case 'script-not-granted':
      return ['Use declarative data-summon attributes only, or ask the host to compile a scripted SurfacePlan with scriptPolicy: "allow".'];
    case 'unknown-intent':
    case 'intent-trigger-not-granted':
      return ['Use only the granted capabilities and triggers listed in the Capabilities block.'];
    case 'invalid-args-json':
      return ['Make data-summon-args a valid JSON object on one line.'];
    case 'unknown-resource':
    case 'non-resource-capability':
    case 'resource-state-keys-incomplete':
      return ['Use only data resources listed under Available data resources.'];
    case 'resource-loading-not-rendered':
      return ['Add visible UI bound to the data resource loading state, for example `data-summon-show="$alias.loading"`.'];
    case 'resource-error-not-rendered':
      return ['Add visible UI bound to the data resource error state, for example `data-summon-show="$alias.error" data-summon-bind="$alias.error"`.'];
    case 'resource-data-not-rendered':
      return ['Wrap result UI in `data-summon-show="$alias.data"` and bind or foreach under the data resource alias.'];
    case 'resource-empty-not-rendered':
      return ['Add visible no-results UI bound to the data resource empty state, for example `data-summon-show="$alias.empty"`.'];
    case 'action-pending-not-rendered':
      return ['Disable the triggering control with `data-summon-attr-disabled="<pendingKey>"` or show a pending message.'];
    case 'action-error-not-rendered':
      return ['Add visible host error UI with `data-summon-show="<errorKey>" data-summon-bind="<errorKey>"`.'];
    case 'unsafe-attr-binding':
    case 'bad-attr-binding-placement':
      return ['Use only safe data-summon-attr-* bindings on supported elements.'];
    case 'host-owned-meta':
      return ['Remove host-owned meta lines; the host emits /surface-policy, /surface-plan, and /surface-contract before model output.'];
    case 'surface-policy-invalid':
    case 'surface-policy-unknown-grant':
    case 'surface-policy-unknown-component':
    case 'surface-policy-tier-exceeded':
    case 'surface-policy-tier-requirement':
      return ['Fix the host-selected SurfacePolicy before generation; models cannot widen grants, components, or tiers.'];
    default:
      return ['Emit one valid replacement line for the same target path.'];
  }
}

export function compileTokenContract(input: TokenContractInput = {}): CompiledTokenContract {
  const definedTokens = input.css ? parseDefinedTokens(input.css) : new Set<string>();
  const validation = input.css
    ? validateDirection(input.css, input.opts)
    : { liveOpportunistic: [], errors: [], warnings: [] };
  const issues: ContractIssue[] = [
    ...validation.errors.map((message) => contractIssue({
      source: 'token',
      severity: 'block',
      code: 'token-contract-error',
      message,
    })),
    ...validation.warnings.map((message) => contractIssue({
      source: 'token',
      severity: 'warn',
      code: 'token-contract-warning',
      message,
    })),
  ];

  return {
    promptVocabulary: formatTokenContract(),
    definedTokens,
    liveOpportunistic: validation.liveOpportunistic,
    issues,
  };
}

export function compileDirectionContract(
  input: DirectionContractInput,
): CompiledDirectionContract {
  const tokenContract = compileTokenContract({
    css: input.tokensCss,
    opts: input.opts,
  });
  const issues = tokenContract.issues.map((issue) => ({
    ...issue,
    source: issue.severity === 'block' ? 'direction' as const : issue.source,
  }));
  return {
    tokenContract,
    issues,
    promptBlock: {
      id: input.id ? `direction:${input.id}` : 'direction',
      text: buildDirectionBlock({
        prompt: input.prompt,
        exemplars: input.exemplars,
        opts: input.opts,
        liveOpportunistic: tokenContract.liveOpportunistic,
        shape: input.shape,
        layout: input.layout,
      }),
      cache: 'ephemeral',
    },
  };
}

export function compileCapabilityContract(
  pack: CapabilityPack | null | undefined,
  options: CapabilityContractOptions = {},
): CompiledCapabilityContract {
  const normalized: CapabilityPack = pack ?? { intents: [] };
  const initialState: Record<string, unknown> = {};
  const validationCapabilities: ValidationCapability[] = normalized.intents.map((intent) => {
    const capability: ValidationCapability = {
      name: intent.name,
      kind: intent.kind,
      triggers: intent.triggers?.length
        ? intent.triggers
        : defaultTriggersForKind(intent.kind ?? 'action'),
    };
    if (intent.stateKeys) capability.stateKeys = intent.stateKeys;
    if (intent.actionStateKeys) capability.actionStateKeys = intent.actionStateKeys;
    if (intent.surface) capability.surface = intent.surface;
    if (intent.kind === 'resource' && hasCompleteResourceStateKeys(intent.stateKeys)) {
      initialState[intent.stateKeys.loading] = false;
      initialState[intent.stateKeys.data] = intent.defaultData ?? null;
      initialState[intent.stateKeys.error] = null;
      if (intent.stateKeys.empty) initialState[intent.stateKeys.empty] = false;
    }
    if ((intent.kind ?? 'action') === 'action' && intent.actionStateKeys) {
      initialState[intent.actionStateKeys.pending] = false;
      initialState[intent.actionStateKeys.done] = false;
      initialState[intent.actionStateKeys.error] = null;
    }
    return capability;
  });

  return {
    pack: normalized,
    promptBlock: normalized.intents.length > 0
      ? {
          id: 'capabilities',
          text: buildCapabilitiesBlock(normalized, {
            scriptPolicy: options.scriptPolicy,
          }),
          cache: 'ephemeral',
        }
      : null,
    intentNames: normalized.intents.map((intent) => intent.name),
    validationCapabilities,
    initialState,
    issues: [],
  };
}

export function compileComponentContract(
  pack: ComponentPack | null | undefined,
): CompiledComponentContract {
  const normalized: ComponentPack = pack ?? { components: [] };
  const validationComponents: ValidationComponent[] = normalized.components.map((component) => {
    const out: ValidationComponent = { name: component.name };
    if (component.surface) out.surface = component.surface;
    return out;
  });

  return {
    pack: normalized,
    promptBlock: normalized.components.length > 0
      ? {
          id: 'components',
          text: buildComponentsBlock(normalized),
          cache: 'ephemeral',
        }
      : null,
    validationComponents,
    issues: [],
  };
}

export function compileSystemContracts(
  input: SystemContractInput,
): CompiledSystemContracts {
  const promptBlocks: ContractPromptBlock[] = [
    {
      id: 'fixed',
      text: SUMMON_FIXED_INSTRUCTIONS,
      cache: 'ephemeral',
    },
  ];
  const issues: ContractIssue[] = [];
  const startupLines: ProtocolLine[] = [];

  let activeTokensCss = input.activeTokensCss ?? null;
  if (input.direction) {
    activeTokensCss = input.activeTokensCss ?? input.direction.tokensCss;
    const direction = compileDirectionContract({
      ...input.direction,
      tokensCss: activeTokensCss,
    });
    promptBlocks.push(direction.promptBlock);
    issues.push(...direction.issues);
  }

  const ghostPrompt = input.ghost?.prompt ?? input.ghostPrompt;
  if (ghostPrompt) {
    promptBlocks.push({
      id: 'ghost',
      text: ghostPrompt,
      cache: 'ephemeral',
    });
  }

  if (input.layout) {
    promptBlocks.push({
      id: `layout:${input.layout.id}`,
      text: buildLayoutBlock(input.layout),
      cache: 'ephemeral',
    });
    startupLines.push(layoutScreenProtocolLine(input.layout));
  }

  if (input.editBlock) {
    promptBlocks.push({
      id: 'edit',
      text: input.editBlock,
      cache: 'ephemeral',
    });
  }

  const activeSurfacePlan = input.surfaceContract?.surface.plan ?? input.surfacePlan ?? null;
  if (input.surfaceContract) {
    promptBlocks.push({
      id: 'surface-contract',
      text: buildSurfaceContractBlock(input.surfaceContract),
      cache: 'ephemeral',
    });
  } else if (activeSurfacePlan) {
    promptBlocks.push({
      id: 'surface-plan',
      text: buildSurfacePlanBlock(activeSurfacePlan),
      cache: 'ephemeral',
    });
  }

  const requestedScriptPolicy = input.scriptPolicy ??
    (activeSurfacePlan
      ? surfacePlanScriptPolicy(activeSurfacePlan)
      : 'forbid');
  const hasScriptedPlan = activeSurfacePlan?.runtime === 'scripted';
  if (hasScriptedPlan && requestedScriptPolicy !== 'allow') {
    issues.push(contractIssue({
      source: 'system',
      severity: 'block',
      code: 'surface-script-policy-mismatch',
      message: 'A scripted surface requires scriptPolicy: "allow"',
    }));
  }
  if (requestedScriptPolicy === 'allow' && !hasScriptedPlan) {
    issues.push(contractIssue({
      source: 'system',
      severity: 'block',
      code: 'surface-script-policy-mismatch',
      message: 'scriptPolicy: "allow" requires a scripted SurfacePlan',
    }));
  }
  const scriptPolicy: ScriptPolicy = requestedScriptPolicy === 'allow' && hasScriptedPlan
    ? 'allow'
    : 'forbid';
  const capability = compileCapabilityContract(input.capabilities, { scriptPolicy });
  if (capability.promptBlock) promptBlocks.push(capability.promptBlock);
  issues.push(...capability.issues);

  const component = compileComponentContract(input.components);
  if (component.promptBlock) promptBlocks.push(component.promptBlock);
  issues.push(...component.issues);

  if (input.tokenOverrides?.length) {
    promptBlocks.push({
      id: 'token-overrides',
      text: buildOverrideBlock(input.tokenOverrides),
      cache: 'ephemeral',
    });
  }

  if (input.postures?.postures.length) {
    promptBlocks.push({
      id: 'postures',
      text: buildPosturesBlock(input.postures),
      cache: 'ephemeral',
    });
  }

  return {
    promptBlocks,
    issues,
    startupLines,
    surfaceContract: input.surfaceContract ?? undefined,
    validationContext: {
      mode: input.mode,
      allowedIntents: capability.intentNames,
      capabilities: capability.validationCapabilities,
      components: component.validationComponents,
      scriptPolicy,
      surfacePlan: activeSurfacePlan ?? undefined,
      definedTokens: activeTokensCss ? parseDefinedTokens(activeTokensCss) : undefined,
    },
  };
}

function layoutScreenProtocolLine(layout: SummonLayout): ProtocolLine {
  return {
    op: 'set',
    path: '/screen',
    value: { sections: layout.slots.map((slot) => slot.id) },
  };
}
