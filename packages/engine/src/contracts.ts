import type { ProtocolLine } from './protocol.js';
import {
  SUMMON_FIXED_SURFACE_DOCUMENT_INSTRUCTIONS,
  SUMMON_STRUCTURED_SURFACE_DOCUMENT_BUNDLE_INSTRUCTIONS,
  buildToolsBlock,
  buildLayoutBlock,
  buildScaleBlock,
  buildSurfaceContractBlock,
  type ToolPack,
  type SummonLayout,
  type SurfaceScale,
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
import type { SurfacePlan } from './surface-plan.js';
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
  | 'fingerprint-catalog';

export interface GhostGenerationContext {
  source?: GhostGenerationSource;
  prompt: string;
  product?: string;
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
  issues: ContractIssue[];
}

export interface TokenContractInput {
  css?: string;
  opts?: DirectionOpts;
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
  ghost?: GhostGenerationContext | null;
  layout?: SummonLayout | null;
  scale?: SurfaceScale | null;
  editBlock?: string | null;
  experimentalPromptBlock?: ContractPromptBlock | null;
  tools?: ToolPack | null;
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
    case 'unknown-tool':
    case 'tool-trigger-not-granted':
      return ['Use only the granted tools and triggers listed in the Tools block.'];
    case 'surface-document-html-inline-handler':
      return ['Keep main.html inert: remove inline on* attributes and attach listeners in optional main.js with addEventListener/on<event> on scoped DOM nodes.'];
    case 'surface-document-html-forbidden-tag':
      return ['Keep main.html inert: remove forbidden script/style/iframe/object/embed tags; put styling in main.css and governed behavior in optional main.js.'];
    case 'surface-document-html-javascript-url':
      return ['Remove javascript: URLs from main.html; use safe href values or wire behavior in main.js with callTool() when a granted host action exists.'];
    case 'surface-document-css-import':
      return ['Remove @import from main.css; include only local CSS that expresses the Ghost fingerprint.'];
    case 'surface-document-css-external-url':
      return ['Remove external, data:, or javascript: url() references from main.css; use local CSS, fingerprint tokens, or inline SVG in main.html.'];
    case 'surface-document-network-not-granted':
      return ['Remove fetch/XHR/WebSocket from main.js; call granted host tools with callTool(toolName, args) instead.'];
    case 'surface-document-unsupported-api':
      return ['Use only scoped Surface Document APIs in main.js: document.getElementById/querySelector, element querySelector, createElement/createTextNode, textContent, setAttribute/getAttribute/removeAttribute/hasAttribute, className/classList/dataset, style writes, append/removeChild/replaceChildren, addEventListener/on<event>, state(), region(), getState/onState, and callTool().'];
    case 'missing-surface-document-file':
    case 'missing-surface-document-bundle-html':
    case 'missing-surface-document-bundle-css':
      return ['Return a Surface Document bundle with source["main.html"] for inert structure and source["main.css"] for fingerprint styling; source["main.js"] is optional behavior only.'];
    case 'invalid-surface-document-bundle-schema':
      return ['Use schema "summon.surface-document-bundle/v1".'];
    case 'invalid-surface-document-source-syntax':
      return [
        'Fix the JavaScript syntax error in main.js before returning the bundle.',
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
    : { errors: [], warnings: [] };
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
    issues,
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
      text: SUMMON_FIXED_SURFACE_DOCUMENT_INSTRUCTIONS,
      cache: 'ephemeral',
    },
  ];
  const issues: ContractIssue[] = [];
  const startupLines: ProtocolLine[] = [];
  const activeSurfacePlan = input.surfaceContract?.surface.plan ?? null;

  const activeTokensCss = input.activeTokensCss ?? null;

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

  if (input.scale) {
    promptBlocks.push({
      id: 'scale',
      text: buildScaleBlock(input.scale),
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
  }

  const tool = compileToolContract(input.tools);
  if (tool.promptBlock) promptBlocks.push(tool.promptBlock);
  issues.push(...tool.issues);


  promptBlocks.push({
    id: 'output-contract',
    text: SUMMON_STRUCTURED_SURFACE_DOCUMENT_BUNDLE_INSTRUCTIONS,
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
