import type {
  ActionStateKeys,
  CapabilityKind,
  CapabilityStateKeys,
  CapabilityTrigger,
} from '../capability-contract.js';
import type { ContractIssue } from '../contracts.js';
import type { ScriptPolicy } from '../prompt.js';
import type { CapabilitySurface, ComponentSurface, SurfacePlan } from '../surface-plan.js';
import type { ValidationLimits } from '../validation-limits.js';

export interface ValidationContext {
  mode: 'static' | 'interactive';
  scriptPolicy?: ScriptPolicy;
  experimentalFragmentMode?: 'section' | 'block-v0' | 'html-node-v0';
  allowedIntents?: Iterable<string>;
  capabilities?: Iterable<ValidationCapability>;
  components?: Iterable<ValidationComponent>;
  definedTokens?: ReadonlySet<string>;
  surfacePlan?: SurfacePlan;
  limits?: Partial<ValidationLimits>;
}

declare const compiledArtifactHtmlBrand: unique symbol;
declare const compiledHtmlNodePatchBrand: unique symbol;

export type CompiledArtifactHtml = string & {
  readonly [compiledArtifactHtmlBrand]: true;
};

export interface CompiledHtmlNodePatch {
  readonly [compiledHtmlNodePatchBrand]?: true;
  sectionId: string;
  nodeId: string;
  parentId?: string;
  html: CompiledArtifactHtml;
}

export interface ArtifactCompileResult {
  html: CompiledArtifactHtml;
  issues: ContractIssue[];
  compilerVersion: string;
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

export interface RuntimeCapability {
  name: string;
  kind: CapabilityKind;
  triggers: Set<CapabilityTrigger>;
  stateKeys?: CapabilityStateKeys;
  actionStateKeys?: ActionStateKeys;
  surface?: CapabilitySurface;
}

export interface ResourceUsage {
  name: string;
  alias: string;
  hasTrigger: boolean;
  hasLoadingBinding: boolean;
  hasErrorBinding: boolean;
  hasDataBinding: boolean;
  hasEmptyState: boolean;
  hasEmptyBinding: boolean;
}

export interface ResourceScope {
  name: string;
  alias: string;
  capability: RuntimeCapability;
  usage?: ResourceUsage;
}

export interface RuntimeComponent {
  name: string;
  surface?: ComponentSurface;
}

export interface TagFrame {
  tagName: string;
  resource?: ResourceScope;
}

export interface HtmlOpenToken {
  kind: 'open';
  tagName: string;
  attrs: Map<string, string>;
  selfClosing: boolean;
}

export interface HtmlCloseToken {
  kind: 'close';
  tagName: string;
}

export type HtmlTraversalToken = HtmlOpenToken | HtmlCloseToken;

export interface ParsedHtmlFragment {
  tokens: HtmlTraversalToken[];
  elements: HtmlOpenToken[];
  cssSources: string[];
  canonicalHtml: CompiledArtifactHtml;
}
