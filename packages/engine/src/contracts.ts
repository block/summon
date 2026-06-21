import type { ProtocolLine } from './protocol.js';
import {
  SUMMON_FIXED_INSTRUCTIONS,
  SUMMON_STRUCTURED_ARROW_BUNDLE_INSTRUCTIONS,
  buildToolsBlock,
  buildDirectionBlock,
  buildLayoutBlock,
  buildSurfaceContractBlock,
  type ToolPack,
  type DirectionInput,
  type SummonLayout,
} from './prompt.js';
import {
  parseDefinedTokens,
  validateDirection,
  type DirectionOpts,
} from './direction-validator.js';
import {
  defaultTriggersForKind,
  hasCompleteResourceStateKeys,
} from './tool-contract.js';
import { formatTokenContract } from './token-contract.js';
import type { SurfaceContractView } from './surface-contract.js';
import {
  buildSurfacePlanBlock,
  type SurfacePlan,
} from './surface-plan.js';
import type {
  ValidationTool,
  ValidationContext,
} from './runtime-validator.js';

export type ContractIssueSource =
  | 'protocol'
  | 'html'
  | 'token'
  | 'direction'
  | 'tool'
  | 'layout'
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

export type GhostGenerationSource = 'root' | 'catalog';

export type GhostTokenSourceKind =
  | 'ghost-config'
  | 'fingerprint-catalog'
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

export interface CompiledToolContract {
  pack: ToolPack;
  promptBlock: ContractPromptBlock | null;
  toolNames: string[];
  validationTools: ValidationTool[];
  initialState: Record<string, unknown>;
  issues: ContractIssue[];
}

export interface SystemContractInput {
  mode: ValidationContext['mode'];
  direction?: DirectionContractInput | null;
  ghost?: GhostGenerationContext | null;
  layout?: SummonLayout | null;
  editBlock?: string | null;
  experimentalPromptBlock?: ContractPromptBlock | null;
  tools?: ToolPack | null;
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
      return ['Use Arrow event handlers inside the template and call granted host tools with `callTool()` from `host-bridge:summon`.'];
    case 'static-script':
      return ['Remove script tags in static mode, or express the UI without interactivity.'];
    case 'script-not-granted':
    case 'surface-script-policy-removed':
      return ['Return an Arrow artifact that uses `reactive()`, Arrow event handlers, and `host-bridge:summon` instead of generated script tags.'];
    case 'unknown-tool':
    case 'tool-trigger-not-granted':
      return ['Use only the granted tools and triggers listed in the Tools block.'];
    case 'invalid-args-json':
      return ['Build tool args as plain objects in the Arrow event handler before calling `callTool()`.'];
    case 'unknown-resource':
    case 'non-resource-tool':
    case 'resource-state-keys-incomplete':
      return ['Use only data resources listed under Available data resources.'];
    case 'resource-loading-not-rendered':
      return ['Copy the listed resource loading key into Arrow `reactive()` state and render a visible loading affordance from it.'];
    case 'resource-error-not-rendered':
      return ['Copy the listed resource error key into Arrow `reactive()` state and render visible host error text from it.'];
    case 'resource-data-not-rendered':
      return ['Copy the listed resource data key into Arrow `reactive()` state and render result rows only from host data.'];
    case 'resource-empty-not-rendered':
      return ['Copy the listed empty-state key into Arrow `reactive()` state and render no-results copy only from that key.'];
    case 'action-pending-not-rendered':
      return ['Copy the listed pending key into Arrow `reactive()` state and render a busy label or disabled-looking state from it.'];
    case 'action-error-not-rendered':
      return ['Copy the listed action error key into Arrow `reactive()` state and render visible host error text from it.'];
    case 'unsafe-attr-binding':
    case 'bad-attr-binding-placement':
      return ['Use normal quoted Arrow attributes and sanitize dynamic values before rendering them.'];
    case 'unsupported-arrow-open-tag-expression':
      return [
        'Remove bare `${...}` expressions from opening tags. Do not write `<button ${() => "disabled"}>` or `<section ${dynamicAttrs}>`.',
        'Put dynamic values inside named, quoted attributes instead, such as `disabled="${() => state.loading}"`, `class="${() => state.active ? \'active\' : \'\'}"`, or `aria-expanded="${() => state.open ? \'true\' : \'false\'}"`.',
        'If the expression creates child content, move it between tags: `<button>${() => state.label}</button>`.',
      ];
    case 'invalid-arrow-bundle-entry':
      return [
        'Return exactly one Arrow entry file under source: either "main.ts" or "main.js", not both and not neither.',
        'If both entry files were returned, keep the complete Arrow implementation in one file and remove the other entry file. Optional CSS may remain in "main.css".',
      ];
    case 'invalid-arrow-source-syntax':
      return [
        'Fix the TypeScript/JavaScript syntax error in the Arrow entry file before returning the bundle.',
        'Check nested template literals carefully: quote generated copy, escape accidental backticks, and keep apostrophes inside double-quoted strings when needed.',
        'Return the full corrected source file, not a patch or Markdown fence.',
      ];
    case 'host-owned-meta':
      return ['Remove host-owned meta lines; the host emits /surface-policy, /surface-plan, and /surface-contract before artifact delivery.'];
    case 'surface-policy-invalid':
    case 'surface-policy-unknown-grant':
    case 'surface-policy-tier-exceeded':
    case 'surface-policy-tier-requirement':
      return ['Fix the host-selected SurfacePolicy before generation; models cannot widen grants or tiers.'];
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

export function compileToolContract(
  pack: ToolPack | null | undefined,
): CompiledToolContract {
  const normalized: ToolPack = pack ?? { tools: [] };
  const initialState: Record<string, unknown> = {};
  const validationTools: ValidationTool[] = normalized.tools.map((spec) => {
    const tool: ValidationTool = {
      name: spec.name,
      kind: spec.kind,
      triggers: spec.triggers?.length
        ? spec.triggers
        : defaultTriggersForKind(spec.kind ?? 'action'),
    };
    if (spec.stateKeys) tool.stateKeys = spec.stateKeys;
    if (spec.actionStateKeys) tool.actionStateKeys = spec.actionStateKeys;
    if (spec.surface) tool.surface = spec.surface;
    if (spec.kind === 'resource' && hasCompleteResourceStateKeys(spec.stateKeys)) {
      initialState[spec.stateKeys.loading] = false;
      initialState[spec.stateKeys.data] = spec.defaultData ?? null;
      initialState[spec.stateKeys.error] = null;
      if (spec.stateKeys.empty) initialState[spec.stateKeys.empty] = false;
    }
    if ((spec.kind ?? 'action') === 'action' && spec.actionStateKeys) {
      initialState[spec.actionStateKeys.pending] = false;
      initialState[spec.actionStateKeys.done] = false;
      initialState[spec.actionStateKeys.error] = null;
    }
    return tool;
  });

  return {
    pack: normalized,
    promptBlock: normalized.tools.length > 0
      ? {
          id: 'tools',
          text: buildToolsBlock(normalized),
          cache: 'ephemeral',
        }
      : null,
    toolNames: normalized.tools.map((tool) => tool.name),
    validationTools,
    initialState,
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
  const activeSurfacePlan = input.surfaceContract?.surface.plan ?? input.surfacePlan ?? null;

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

  const ghostBlockText = input.ghost?.prompt;
  if (ghostBlockText) {
    promptBlocks.push({
      id: 'ghost',
      text: ghostBlockText,
      cache: 'ephemeral',
    });
  }

  if (input.layout) {
    promptBlocks.push({
      id: `layout:${input.layout.id}`,
      text: buildLayoutBlock(input.layout),
      cache: 'ephemeral',
    });
  }

  if (input.experimentalPromptBlock) {
    promptBlocks.push(input.experimentalPromptBlock);
  }

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

  const tool = compileToolContract(input.tools);
  if (tool.promptBlock) promptBlocks.push(tool.promptBlock);
  issues.push(...tool.issues);


  promptBlocks.push({
    id: 'output-contract',
    text: SUMMON_STRUCTURED_ARROW_BUNDLE_INSTRUCTIONS,
    cache: 'none',
  });

  return {
    promptBlocks,
    issues,
    startupLines,
    surfaceContract: input.surfaceContract ?? undefined,
    validationContext: {
      mode: input.mode,
      allowedTools: tool.toolNames,
      tools: tool.validationTools,
      surfacePlan: activeSurfacePlan ?? undefined,
      definedTokens: activeTokensCss ? parseDefinedTokens(activeTokensCss) : undefined,
    },
  };
}
