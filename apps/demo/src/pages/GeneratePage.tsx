import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SummonSurface, type SummonSurfaceHandle } from '@anarchitecture/summon-react';
import { consumeSurfaceStream, type SurfaceStreamContext, type SurfaceStreamResult } from '@anarchitecture/summon/browser';
import {
  createSurfaceEnvelope,
  parseSurfaceEnvelope,
  type SurfaceEnvelope,
} from '@anarchitecture/summon/envelope';
import {
  deriveSurfacePlanControls,
  normalizeSurfacePlan,
  parseTokenValues,
  SectionAccumulator,
  SURFACE_AUTHORITY_VALUES,
  SURFACE_DATA_VALUES,
  SURFACE_PERSISTENCE_VALUES,
  SURFACE_PURPOSE_VALUES,
  SURFACE_RUNTIME_VALUES,
  type CapabilityPack,
  type ComponentPack,
  type ProtocolLine,
  type ScriptPolicy,
  type SummonLayout,
  type SurfaceCeiling,
  type SurfaceContractView,
  type SurfacePlan,
} from '@anarchitecture/summon/engine';
import type { ApprovalDecision, ApprovalRequest, SurfacePolicy } from '@anarchitecture/summon';
import type { DevtoolsEvent } from '@anarchitecture/summon/devtools';
import defaultTokensSource from '@anarchitecture/summon/tokens.css?raw';
import { AppNav, LogView, PageHeader, Pane } from '../components/chrome.js';
import {
  createGhostShowcaseScenario,
  createScopedDemoRegistry,
  narrowCapabilityPack,
  SHOWCASE_SCENARIOS,
  type ActiveContract,
  type Mode,
  type ShowcaseScenario,
} from '../showcase.js';
import {
  baseDemoComponentPack,
  createDemoComponentRegistry,
  narrowComponentPack,
} from '../components.js';

interface DirectionInfo {
  id: string;
  name: string;
  description: string;
  tokensCss: string;
}

interface GhostRootInfo {
  id: string;
  defaultTargetPath?: string;
  defaultBaseDirectionId?: string | null;
}

interface ModelProviderInfo {
  id: string;
  name: string;
  configured: boolean;
  model: string;
  utilityModel: string;
  models: ModelCatalogEntry[];
  utilityModels: ModelCatalogEntry[];
  defaults?: ModelProviderDefaults;
  controls?: ModelProviderControls;
  missingEnv?: string;
}

interface ModelCatalogEntry {
  id: string;
  label: string;
  status: 'stable' | 'preview' | 'latest' | 'legacy';
  tier: 'fast' | 'balanced' | 'frontier';
  maxOutputTokens: number;
  description?: string;
  anthropicThinking?: 'optional' | 'always';
}

interface ModelProviderControls {
  customModels: boolean;
  maxOutputTokens: { default: number; presets: number[] };
  repairMaxOutputTokens: { default: number; presets: number[] };
  anthropicThinking?: { default: 'adaptive' | 'off'; options: Array<'adaptive' | 'off'> };
  effort?: { default: 'low' | 'medium' | 'high'; options: Array<'low' | 'medium' | 'high'> };
}

interface ModelProviderDefaults {
  generationModel: string;
  utilityModel: string;
  modelOptions: ModelOptions;
}

interface ModelOptions {
  maxOutputTokens?: number;
  repairMaxOutputTokens?: number;
  anthropicThinking?: 'adaptive' | 'off';
  effort?: 'low' | 'medium' | 'high';
}

interface ModelSelectionPayload {
  modelProvider?: string;
  generationModel?: string;
  utilityModel?: string;
  customModel?: boolean;
  modelOptions?: ModelOptions;
}

type FragmentMode = 'section' | 'block-v0' | 'html-node-v0';

interface StreamOptions {
  prompt: string;
  active: ActiveContract;
  directionId: string | null;
  ghostTargetPath: string;
  ghostBaseDirectionId: string | null;
  layout?: SummonLayout | null;
  fragmentMode?: FragmentMode;
  signal: AbortSignal;
  edit?: {
    baseRevision: number;
    sections: { id: string; html: string }[];
    targetSections?: string[];
  };
}

interface StreamResult extends SurfaceStreamResult {
  surfacePlan: SurfacePlan | null;
  shape: string | null;
}

interface LogEntry {
  cls: string;
  text: string;
}

interface ApprovalCard {
  request: ApprovalRequest;
}

interface ChildSurfaceModel {
  id: number;
  prompt: string;
  title?: string;
  directionId: string | null;
  tokensSource: string;
  modelSelection: ModelSelectionPayload;
  agentBroker: boolean;
}

const savedSurfacesKey = 'summon.savedSurfaces.v1';
const maxSavedSurfaces = 8;
const baseCapabilityPack = createScopedDemoRegistry({ onSummon: () => {} }, [
  'log',
  'counter',
  'choose',
  'submit',
  'search',
  'ai',
  'github_lookup',
  'analysis',
  'compute_score',
  'publish_summary',
  'summon',
]).toContract().pack;
const baseComponentPack = baseDemoComponentPack();
const childCapabilityNames = baseCapabilityPack.intents
  .map((intent) => intent.name)
  .filter((name) => name !== 'summon');

const layoutPresets = new Map<string, SummonLayout>([
  [
    'card-structured',
    {
      id: 'card-structured',
      slots: [
        { id: 'header', purpose: 'short title, context, and the main takeaway' },
        { id: 'content', purpose: 'the useful details, data, reasoning, or plan' },
        { id: 'actions', purpose: 'one or two concise next actions or controls' },
      ],
    },
  ],
]);

const demoSurfaceCeiling: SurfaceCeiling = {
  runtimes: ['static', 'declarative', 'scripted', 'worker'],
  data: ['embedded', 'host-resource', 'worker'],
  authorities: ['none', 'read', 'host-action', 'approval-gated'],
  persistences: ['replayable'],
};

const scenarioCategoryOrder = [
  'Host data',
  'Read-only',
  'Host action',
  'Worker',
  'Approval',
  'Runtime',
  'Tokens',
  'Layout',
  'Composition',
  'Diagnostics',
  'Ghost',
];

function describeScenario(scenario: ShowcaseScenario): { category: string; description: string } {
  if (scenario.id.startsWith('ghost-')) {
    return {
      category: 'Ghost',
      description: 'Environment-specific Ghost memory root with host-allowed controls.',
    };
  }
  switch (scenario.id) {
    case 'host-resource-search':
      return { category: 'Host data', description: 'Host-owned data resource with explicit read authority.' };
    case 'host-ai-brainstorm':
      return { category: 'Host data', description: 'Host-owned AI resource with loading, error, and response states.' };
    case 'github-profile-lookup':
      return { category: 'Host data', description: 'Host-owned external lookup with proxied image data and read authority.' };
    case 'component-islands':
      return { category: 'Host action', description: 'Host-rendered component islands with sandbox placeholders.' };
    case 'static-summary':
      return { category: 'Read-only', description: 'Static generated UI with embedded data and no host actions.' };
    case 'declarative-form':
    case 'decision-picker':
      return { category: 'Host action', description: 'Declarative controls routed through host-owned handlers.' };
    case 'worker-analysis':
      return { category: 'Worker', description: 'Background worker data plus host-action authority.' };
    case 'approval-publish':
      return { category: 'Approval', description: 'Publish workflow guarded by an approval-gated host action.' };
    case 'scripted-interactive':
      return { category: 'Runtime', description: 'Scripted runtime allowed by explicit script policy.' };
    case 'token-override':
      return { category: 'Tokens', description: 'Token override request that repaints through host CSS.' };
    case 'layout-card':
      return { category: 'Layout', description: 'Host layout slots constrain the generated card shape.' };
    case 'sibling-summon':
      return { category: 'Composition', description: 'Parent surface can summon a sibling sandbox with narrowed host tools.' };
    case 'repair-diagnostics':
      return { category: 'Diagnostics', description: 'Validation retry generation with diagnostics.' };
    default:
      return { category: 'Showcase', description: 'Surface-configured Summon generation scenario.' };
  }
}

function compactPlanText(plan: SurfacePlan): string {
  return [
    displayPlanPart(plan.purpose),
    displayPlanPart(plan.runtime),
    displayPlanPart(plan.data),
    displayPlanPart(plan.authority),
  ].join(' · ');
}

function planText(plan: SurfacePlan): string {
  return [
    displayPlanPart(plan.purpose),
    displayPlanPart(plan.runtime),
    displayPlanPart(plan.data),
    displayPlanPart(plan.authority),
    displayPlanPart(plan.persistence),
  ].join(' · ');
}

function displayPlanPart(value: string): string {
  switch (value) {
    case 'host-resource':
      return 'host data';
    case 'host-action':
      return 'host action';
    case 'approval-gated':
      return 'approval required';
    default:
      return value.replace(/-/g, ' ');
  }
}

function scenarioUsesFixedPolicy(scenario: ShowcaseScenario): boolean {
  return scenario.surfacePolicy.tier === 'scripted';
}

function capabilityPackFor(active: ActiveContract): CapabilityPack {
  return narrowCapabilityPack(baseCapabilityPack, active.capabilityNames);
}

function componentPackFor(active: ActiveContract): ComponentPack | null {
  return active.componentNames?.length
    ? narrowComponentPack(baseComponentPack, active.componentNames)
    : null;
}

function agentBrokerRequestFor(active: ActiveContract): { enabled: true } | undefined {
  return active.agentBroker ? { enabled: true } : undefined;
}

function explicitSurfaceRequestFor(active: ActiveContract): Pick<StreamOptionsPayload, 'surfacePolicy' | 'surfacePlan'> {
  if (active.surfacePolicy) return { surfacePolicy: active.surfacePolicy };
  return { surfacePlan: active.surfacePlan };
}

type StreamOptionsPayload = {
  surfacePolicy?: SurfacePolicy;
  surfacePlan?: SurfacePlan;
};

function surfaceRequestFor(active: ActiveContract): StreamOptionsPayload {
  const agent = agentBrokerRequestFor(active);
  if (agent) return {};
  return explicitSurfaceRequestFor(active);
}

function ghostSelectionValue(rootId: string): string {
  return `ghost:${rootId}`;
}

function ghostRootFromSelection(selection: string | null): string | null {
  return selection?.startsWith('ghost:') ? selection.slice('ghost:'.length) : null;
}

function defaultGhostBaseDirectionId(directions: DirectionInfo[]): string | null {
  return directions.find((direction) => direction.id === 'ghost')?.id ?? directions[0]?.id ?? null;
}

function tokenOverridesFor(preset: string): Record<string, string> | undefined {
  if (preset !== 'accent-blue') return undefined;
  return {
    'color-accent': '#0f8cff',
    'color-accent-fg': '#ffffff',
  };
}

function summarizeValidationMeta(value: unknown): string {
  const summary = value as { blocked?: unknown; warnings?: unknown } | undefined;
  const blocked = typeof summary?.blocked === 'number' ? summary.blocked : 0;
  const warnings = typeof summary?.warnings === 'number' ? summary.warnings : 0;
  return `${blocked}/${warnings}`;
}

function summarizeRepairMeta(value: unknown): string {
  const summary = value as { queued?: unknown; repaired?: unknown; failed?: unknown } | undefined;
  const queued = typeof summary?.queued === 'number' ? summary.queued : 0;
  const repaired = typeof summary?.repaired === 'number' ? summary.repaired : 0;
  const failed = typeof summary?.failed === 'number' ? summary.failed : 0;
  return `${repaired}/${queued}${failed ? ` failed=${failed}` : ''}`;
}

function summarizeStreamGraphMeta(value: unknown): string {
  const summary = value as
    | { health?: { complete?: unknown; missingDeclared?: unknown[]; blockedCount?: unknown; repairedCount?: unknown } }
    | undefined;
  const complete = summary?.health?.complete === true;
  const missing = Array.isArray(summary?.health?.missingDeclared) ? summary.health.missingDeclared.length : 0;
  const blocked = typeof summary?.health?.blockedCount === 'number' ? summary.health.blockedCount : 0;
  const repaired = typeof summary?.health?.repairedCount === 'number' ? summary.health.repairedCount : 0;
  return `${complete ? 'complete' : 'open'} · missing=${missing} blocked=${blocked} retried=${repaired}`;
}

function parseSurfaceContractView(value: unknown): SurfaceContractView | null {
  if (!value || typeof value !== 'object') return null;
  const contract = value as Partial<SurfaceContractView>;
  if (!contract.surface || typeof contract.surface !== 'object') return null;
  if (!Array.isArray(contract.tools) || !Array.isArray(contract.components)) return null;
  if (!Array.isArray(contract.issues)) return null;
  return contract as SurfaceContractView;
}

function agentIntentText(value: unknown): string {
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  const item = value as Record<string, unknown>;
  const parts = [
    typeof item.purpose === 'string' ? item.purpose : null,
    typeof item.interaction === 'string' ? item.interaction : null,
    typeof item.dataNeed === 'string' ? item.dataNeed : null,
    typeof item.sideEffect === 'string' ? item.sideEffect : null,
  ].filter((part): part is string => Boolean(part));
  const grants = Array.isArray(item.requestedCapabilities)
    ? item.requestedCapabilities.filter((name): name is string => typeof name === 'string')
    : [];
  const components = Array.isArray(item.requestedComponents)
    ? item.requestedComponents.filter((name): name is string => typeof name === 'string')
    : [];
  const access = [
    grants.length ? `tools=${grants.join(',')}` : '',
    components.length ? `components=${components.join(',')}` : '',
  ].filter(Boolean).join(' ');
  return `${parts.join(' · ') || 'intent'}${access ? ` · ${access}` : ''}`;
}

function agentPolicyText(value: unknown): string {
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  const item = value as Record<string, unknown>;
  const policy = item.surfacePolicy && typeof item.surfacePolicy === 'object'
    ? item.surfacePolicy as Record<string, unknown>
    : null;
  const source = typeof item.source === 'string' ? item.source : 'broker';
  const tier = typeof policy?.tier === 'string' ? policy.tier : 'policy';
  const purpose = typeof policy?.purpose === 'string' ? policy.purpose : 'inform';
  const fallback = item.fallback === true ? ' · fallback' : '';
  const rejectedCapabilities = Array.isArray(item.rejectedCapabilities) ? item.rejectedCapabilities.length : 0;
  const rejectedComponents = Array.isArray(item.rejectedComponents) ? item.rejectedComponents.length : 0;
  const rejected = rejectedCapabilities + rejectedComponents;
  return `${source} · ${tier}/${purpose}${fallback}${rejected ? ` · rejected=${rejected}` : ''}`;
}

function applyTokenOverrideCss(baseCss: string, applied: Array<{ token: string; value: string }>): string {
  if (applied.length === 0) return baseCss;
  const replacements = new Map(applied.map((entry) => [entry.token, entry.value]));
  const defined = parseTokenValues(baseCss);
  let css = baseCss.replace(/(--([a-zA-Z0-9_-]+)\s*:\s*)([^;]+)(;)/g, (full, prefix, token, _value, suffix) => {
    const next = replacements.get(token);
    return next ? `${prefix}${next}${suffix}` : full;
  });
  const missing = applied.filter((entry) => !defined.has(entry.token));
  if (missing.length > 0) {
    css += `\n:root {\n${missing.map((entry) => `  --${entry.token}: ${entry.value};`).join('\n')}\n}\n`;
  }
  return css;
}

function parseAppliedTokenOverrides(value: unknown): Array<{ token: string; value: string }> {
  const raw = value as { applied?: unknown } | undefined;
  if (!Array.isArray(raw?.applied)) return [];
  return raw.applied.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const obj = entry as Record<string, unknown>;
    if (typeof obj.token !== 'string' || typeof obj.value !== 'string') return [];
    return [{ token: obj.token, value: obj.value }];
  });
}

function loadSavedSurfaces(): SurfaceEnvelope[] {
  try {
    const raw = window.localStorage.getItem(savedSurfacesKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.flatMap((item) => {
          const envelope = parseSurfaceEnvelope(item);
          return envelope ? [envelope] : [];
        })
      : [];
  } catch {
    return [];
  }
}

function writeSavedSurfaces(items: SurfaceEnvelope[]) {
  window.localStorage.setItem(savedSurfacesKey, JSON.stringify(items.slice(0, maxSavedSurfaces)));
}

async function* chunksWithByteCounts(
  streamBody: ReadableStream<Uint8Array>,
  onBytes: (bytes: number) => void,
): AsyncGenerator<Uint8Array, void, void> {
  const reader = streamBody.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return;
      if (!value) continue;
      onBytes(value.byteLength);
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

function parseModelCatalog(raw: unknown): ModelCatalogEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): ModelCatalogEntry[] => {
    if (!entry || typeof entry !== 'object') return [];
    const item = entry as Record<string, unknown>;
    if (
      typeof item.id !== 'string' ||
      typeof item.label !== 'string' ||
      typeof item.maxOutputTokens !== 'number'
    ) {
      return [];
    }
    return [{
      id: item.id,
      label: item.label,
      status: item.status === 'preview' || item.status === 'latest' || item.status === 'legacy'
        ? item.status
        : 'stable',
      tier: item.tier === 'frontier' || item.tier === 'balanced' ? item.tier : 'fast',
      maxOutputTokens: item.maxOutputTokens,
      description: typeof item.description === 'string' ? item.description : undefined,
      anthropicThinking: item.anthropicThinking === 'always' || item.anthropicThinking === 'optional'
        ? item.anthropicThinking
        : undefined,
    }];
  });
}

function parseProviderDefaults(raw: unknown): ModelProviderDefaults | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const item = raw as Record<string, unknown>;
  if (typeof item.generationModel !== 'string' || typeof item.utilityModel !== 'string') return undefined;
  const modelOptions = item.modelOptions && typeof item.modelOptions === 'object'
    ? item.modelOptions as ModelOptions
    : {};
  return {
    generationModel: item.generationModel,
    utilityModel: item.utilityModel,
    modelOptions,
  };
}

function parseTokenControl(raw: unknown): { default: number; presets: number[] } | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.default !== 'number') return null;
  return {
    default: item.default,
    presets: Array.isArray(item.presets)
      ? item.presets.filter((value): value is number => typeof value === 'number')
      : [item.default],
  };
}

function parseProviderControls(raw: unknown): ModelProviderControls | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const item = raw as Record<string, unknown>;
  const maxOutputTokens = parseTokenControl(item.maxOutputTokens);
  const repairMaxOutputTokens = parseTokenControl(item.repairMaxOutputTokens);
  if (!maxOutputTokens || !repairMaxOutputTokens) return undefined;
  const thinkingOptions = Array.isArray((item.anthropicThinking as Record<string, unknown> | undefined)?.options)
    ? ((item.anthropicThinking as { options?: unknown[] }).options ?? []).filter((value): value is 'adaptive' | 'off' => value === 'adaptive' || value === 'off')
    : [];
  const effortOptions = Array.isArray((item.effort as Record<string, unknown> | undefined)?.options)
    ? ((item.effort as { options?: unknown[] }).options ?? []).filter((value): value is 'low' | 'medium' | 'high' => value === 'low' || value === 'medium' || value === 'high')
    : [];
  return {
    customModels: item.customModels !== false,
    maxOutputTokens,
    repairMaxOutputTokens,
    anthropicThinking: {
      default: (item.anthropicThinking as { default?: unknown } | undefined)?.default === 'off' ? 'off' : 'adaptive',
      options: thinkingOptions.length ? thinkingOptions : ['adaptive', 'off'],
    },
    effort: {
      default: ['low', 'medium', 'high'].includes(String((item.effort as { default?: unknown } | undefined)?.default))
        ? (item.effort as { default: 'low' | 'medium' | 'high' }).default
        : 'medium',
      options: effortOptions.length ? effortOptions : ['low', 'medium', 'high'],
    },
  };
}

function parseModelProviders(payload: unknown): { defaultProvider: string | null; providers: ModelProviderInfo[] } {
  if (!payload || typeof payload !== 'object') return { defaultProvider: null, providers: [] };
  const item = payload as { defaultProvider?: unknown; providers?: unknown };
  return {
    defaultProvider: typeof item.defaultProvider === 'string' ? item.defaultProvider : null,
    providers: Array.isArray(item.providers)
      ? item.providers.flatMap((provider): ModelProviderInfo[] => {
          if (!provider || typeof provider !== 'object') return [];
          const raw = provider as Record<string, unknown>;
          if (
            typeof raw.id !== 'string' ||
            typeof raw.name !== 'string' ||
            typeof raw.model !== 'string' ||
            typeof raw.utilityModel !== 'string'
          ) {
            return [];
          }
          return [{
            id: raw.id,
            name: raw.name,
            configured: raw.configured === true,
            model: raw.model,
            utilityModel: raw.utilityModel,
            models: parseModelCatalog(raw.models),
            utilityModels: parseModelCatalog(raw.utilityModels),
            defaults: parseProviderDefaults(raw.defaults),
            controls: parseProviderControls(raw.controls),
            missingEnv: typeof raw.missingEnv === 'string' ? raw.missingEnv : undefined,
          }];
        })
      : [],
  };
}

function fallbackCatalog(id: string, label: string): ModelCatalogEntry[] {
  return [{
    id,
    label,
    status: 'stable',
    tier: 'balanced',
    maxOutputTokens: 64000,
  }];
}

function formatDevtoolsEvent(ev: DevtoolsEvent | ExtraDevtoolsEvent): string {
  switch (ev.kind) {
    case 'sandbox-spawned':
      return `${ev.sandboxId.slice(0, 8)}... allowed=[${ev.grantedIntents.join(',') || '-'}]`;
    case 'sandbox-ready':
    case 'sandbox-disposed':
      return `${ev.sandboxId.slice(0, 8)}...`;
    case 'sandbox-fatal':
      return `${ev.sandboxId.slice(0, 8)}... ${ev.reason}`;
    case 'intent-emitted':
      return `host tool ${ev.intent} ${JSON.stringify(ev.args).slice(0, 80)}`;
    case 'intent-rejected':
      return `${ev.reason}`;
    case 'intent-dispatched':
      return `host dispatch ${ev.intent} #${ev.id.slice(-6)}`;
    case 'intent-settled':
      return `host settled ${ev.intent} #${ev.id.slice(-6)} ${ev.ok ? 'ok' : `fail: ${ev.error ?? ''}`} (${ev.durationMs}ms)`;
    case 'state-pushed':
      return Object.keys(ev.patch).join(', ') || 'empty';
    case 'component-sync':
      return `${ev.components.length} trusted component${ev.components.length === 1 ? '' : 's'}`;
    case 'component-error':
      return `${ev.componentName ?? ev.componentId ?? 'component'} ${ev.code ?? 'error'}: ${ev.reason}`;
    case 'render':
      return `${ev.bytes.toLocaleString()} B`;
    case 'protocol-line':
      return `${ev.line.op} ${ev.line.path}`;
    case 'protocol-parse-error':
      return ev.raw.slice(0, 80);
    case 'stream-lifecycle':
      return ev.phase === 'start' ? 'start' : `end ok=${ev.ok}`;
    case 'stream-graph':
      return `sections=${ev.sections.length} missing=${ev.health.missingDeclared.length} skipped=${ev.health.skippedCount} retried=${ev.health.repairedCount}`;
    case 'surface-plan':
      return planText(ev.plan as SurfacePlan);
    case 'surface-contract':
      return `${ev.contract.tools?.length ?? 0} tools · ${ev.contract.components?.length ?? 0} components`;
  }
}

function displayEventKind(kind: string): string {
  switch (kind) {
    case 'intent-emitted':
      return 'host tool';
    case 'intent-rejected':
      return 'request rejected';
    case 'intent-dispatched':
      return 'host dispatch';
    case 'intent-settled':
      return 'host settled';
    case 'stream-graph':
      return 'stream diagnostics';
    default:
      return kind.replace(/^(sandbox|protocol|stream)-/, '').replace(/-/g, ' ');
  }
}

type ExtraDevtoolsEvent =
  | { kind: 'protocol-line'; at: number; line: ProtocolLine }
  | { kind: 'protocol-parse-error'; at: number; raw: string }
  | { kind: 'stream-lifecycle'; at: number; phase: 'start' | 'end'; ok?: boolean }
  | { kind: 'stream-graph'; at: number; health: SurfaceStreamResult['streamGraph']['health']; sections: Array<{ id: string; declared: boolean; present: boolean; revision: number; bytes: number }> }
  | { kind: 'surface-plan'; at: number; plan: SurfacePlan }
  | { kind: 'surface-contract'; at: number; contract: SurfaceContractView };

export function GeneratePage() {
  const surfaceRef = useRef<SummonSurfaceHandle>(null);
  const accRef = useRef(new SectionAccumulator());
  const abortRef = useRef<AbortController | null>(null);
  const modeRef = useRef<Mode>('interactive');
  const approvalResolvers = useRef(new Map<string, (decision: ApprovalDecision) => void>());
  const summonedCountRef = useRef(0);

  const [directions, setDirections] = useState<DirectionInfo[]>([]);
  const [ghostRoots, setGhostRoots] = useState<GhostRootInfo[]>([]);
  const [modelProviders, setModelProviders] = useState<ModelProviderInfo[]>([]);
  const [defaultModelProviderId, setDefaultModelProviderId] = useState<string | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState(SHOWCASE_SCENARIOS[0]?.id ?? '');
  const [prompt, setPrompt] = useState(SHOWCASE_SCENARIOS[0]?.prompt ?? '');
  const [mode, setMode] = useState<Mode>(SHOWCASE_SCENARIOS[0]?.mode ?? 'interactive');
  const [surfacePlan, setSurfacePlan] = useState<SurfacePlan>(SHOWCASE_SCENARIOS[0]!.surfacePlan);
  const [layoutId, setLayoutId] = useState('');
  const [fragmentMode, setFragmentMode] = useState<FragmentMode>('section');
  const [tokenPreset, setTokenPreset] = useState('');
  const [agentBrokerEnabled, setAgentBrokerEnabled] = useState(true);
  const [repairEnabled, setRepairEnabled] = useState(false);
  const [customContractEnabled, setCustomContractEnabled] = useState(false);
  const [directionId, setDirectionId] = useState<string | null>(null);
  const [ghostTarget, setGhostTarget] = useState('.');
  const [ghostBaseDirectionId, setGhostBaseDirectionId] = useState<string | null>(null);
  const [modelProviderId, setModelProviderId] = useState('');
  const [generationModel, setGenerationModel] = useState('');
  const [utilityModel, setUtilityModel] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [maxOutputTokens, setMaxOutputTokens] = useState(64000);
  const [repairMaxOutputTokens, setRepairMaxOutputTokens] = useState(12000);
  const [anthropicThinking, setAnthropicThinking] = useState<'adaptive' | 'off'>('adaptive');
  const [modelEffort, setModelEffort] = useState<'low' | 'medium' | 'high'>('medium');
  const [activeTokensSourceOverride, setActiveTokensSourceOverride] = useState<string | null>(null);
  const [surfaceTokensSource, setSurfaceTokensSource] = useState(defaultTokensSource);
  const [runtimeCapabilityNames, setRuntimeCapabilityNames] = useState<string[] | null>(null);
  const [runtimeComponentNames, setRuntimeComponentNames] = useState<string[] | null>(null);
  const [status, setStatus] = useState('idle');
  const [bytes, setBytes] = useState(0);
  const [showWelcome, setShowWelcome] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [devEvents, setDevEvents] = useState<Array<DevtoolsEvent | ExtraDevtoolsEvent>>([]);
  const [currentEffectiveSurfacePlan, setCurrentEffectiveSurfacePlan] = useState<SurfacePlan | null>(null);
  const [currentShape, setCurrentShape] = useState<string | null>(null);
  const [currentValidationSummary, setCurrentValidationSummary] = useState<string | null>(null);
  const [currentRepairSummary, setCurrentRepairSummary] = useState<string | null>(null);
  const [currentStreamHealth, setCurrentStreamHealth] = useState<string | null>(null);
  const [currentSurfaceContractView, setCurrentSurfaceContractView] = useState<SurfaceContractView | null>(null);
  const [currentAgentIntentSummary, setCurrentAgentIntentSummary] = useState<string | null>(null);
  const [currentAgentPolicySummary, setCurrentAgentPolicySummary] = useState<string | null>(null);
  const [artifactRevision, setArtifactRevision] = useState(0);
  const artifactRevisionRef = useRef(0);
  const [editTargets, setEditTargets] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [savedSurfaces, setSavedSurfaces] = useState<SurfaceEnvelope[]>([]);
  const [diagnosticsTab, setDiagnosticsTab] = useState<'stream' | 'devtools' | 'history' | 'safety'>('stream');
  const [approvalCards, setApprovalCards] = useState<ApprovalCard[]>([]);
  const [children, setChildren] = useState<ChildSurfaceModel[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    artifactRevisionRef.current = artifactRevision;
  }, [artifactRevision]);

  useEffect(() => {
    setSavedSurfaces(loadSavedSurfaces());
    let active = true;
    async function loadWorkbenchData() {
      try {
        const res = await fetch('/api/model-providers');
        if (res.ok) {
          const parsed = parseModelProviders(await res.json());
          if (active) {
            setModelProviders(parsed.providers);
            setDefaultModelProviderId(parsed.defaultProvider);
          }
        }
      } catch {
        if (active) {
          setModelProviders([]);
          setDefaultModelProviderId(null);
        }
      }
      try {
        const res = await fetch('/api/directions');
        const payload = res.ok ? await res.json() as DirectionInfo[] : [];
        if (active) {
          setDirections(Array.isArray(payload) ? payload : []);
        }
      } catch {
        if (active) setDirections([]);
      }
      try {
        const res = await fetch('/api/ghost-roots');
        const payload = res.ok ? await res.json() as GhostRootInfo[] : [];
        if (active) setGhostRoots(Array.isArray(payload) ? payload : []);
      } catch {
        if (active) setGhostRoots([]);
      }
    }
    void loadWorkbenchData();
    return () => {
      active = false;
    };
  }, []);

  const showcaseScenarios = useMemo(
    () => [
      ...SHOWCASE_SCENARIOS,
      ...ghostRoots.map((root) => createGhostShowcaseScenario(root.id)),
    ],
    [ghostRoots],
  );
  const selectedScenario = useMemo(
    () => showcaseScenarios.find((scenario) => scenario.id === selectedScenarioId) ?? showcaseScenarios[0]!,
    [selectedScenarioId, showcaseScenarios],
  );
  const selectedProvider = useMemo(
    () => modelProviders.find((provider) => provider.id === modelProviderId) ?? null,
    [modelProviderId, modelProviders],
  );

  useEffect(() => {
    if (modelProviders.length === 0) {
      setModelProviderId('');
      return;
    }
    const configuredDefault = defaultModelProviderId
      ? modelProviders.find((provider) => provider.id === defaultModelProviderId && provider.configured)
      : null;
    const firstConfigured = modelProviders.find((provider) => provider.configured);
    const next = configuredDefault?.id ?? firstConfigured?.id ?? '';
    setModelProviderId((current) => current || next);
  }, [defaultModelProviderId, modelProviders]);

  useEffect(() => {
    if (!selectedProvider) {
      setGenerationModel('');
      setUtilityModel('');
      setMaxOutputTokens(64000);
      setRepairMaxOutputTokens(12000);
      return;
    }
    const generationDefault = selectedProvider.defaults?.generationModel ?? selectedProvider.model;
    const utilityDefault = selectedProvider.defaults?.utilityModel ?? selectedProvider.utilityModel;
    setGenerationModel((current) => current || generationDefault);
    setUtilityModel((current) => current || utilityDefault);
    setMaxOutputTokens(selectedProvider.controls?.maxOutputTokens.default ?? selectedProvider.defaults?.modelOptions.maxOutputTokens ?? 64000);
    setRepairMaxOutputTokens(selectedProvider.controls?.repairMaxOutputTokens.default ?? selectedProvider.defaults?.modelOptions.repairMaxOutputTokens ?? 12000);
    setAnthropicThinking(selectedProvider.controls?.anthropicThinking?.default ?? 'adaptive');
    setModelEffort(selectedProvider.controls?.effort?.default ?? 'medium');
  }, [selectedProvider]);

  useEffect(() => {
    if (ghostBaseDirectionId || directions.length === 0) return;
    setGhostBaseDirectionId(defaultGhostBaseDirectionId(directions));
  }, [directions, ghostBaseDirectionId]);

  const tokensFor = useCallback((id: string | null): string => {
    if (!id) return defaultTokensSource;
    if (ghostRootFromSelection(id)) {
      const base = ghostBaseDirectionId ?? defaultGhostBaseDirectionId(directions);
      return directions.find((direction) => direction.id === base)?.tokensCss ?? defaultTokensSource;
    }
    return directions.find((direction) => direction.id === id)?.tokensCss ?? defaultTokensSource;
  }, [directions, ghostBaseDirectionId]);

  const logLine = useCallback((cls: string, text: string) => {
    setLogs((items) => [...items, { cls, text }]);
  }, []);

  const appendDevEvent = useCallback((event: DevtoolsEvent | ExtraDevtoolsEvent) => {
    setDevEvents((items) => [...items.slice(-799), event]);
  }, []);

  const handleSurfaceIntentRejected = useCallback((reason: string) => {
    logLine('op-error', `rejected: ${reason}`);
  }, [logLine]);

  const handleSurfaceHandlerError = useCallback((intent: string, error: Error) => {
    logLine('op-error', `host handler error (${intent}): ${error.message}`);
  }, [logLine]);

  const handleSurfaceComponentError = useCallback((error: { componentName?: string; componentId?: string; reason: string }) => {
    logLine('op-error', `component ${error.componentName ?? error.componentId ?? '?'}: ${error.reason}`);
  }, [logLine]);

  const clearRuntimeState = useCallback(() => {
    accRef.current = new SectionAccumulator();
    setArtifactRevision(0);
    artifactRevisionRef.current = 0;
    setActiveTokensSourceOverride(null);
    setCurrentEffectiveSurfacePlan(null);
    setCurrentShape(null);
    setCurrentValidationSummary(null);
    setCurrentRepairSummary(null);
    setCurrentStreamHealth(null);
    setCurrentSurfaceContractView(null);
    setCurrentAgentIntentSummary(null);
    setCurrentAgentPolicySummary(null);
  }, []);

  const settleApproval = useCallback((id: string, decision: ApprovalDecision) => {
    const resolve = approvalResolvers.current.get(id);
    approvalResolvers.current.delete(id);
    resolve?.(decision);
    setApprovalCards((cards) => cards.filter((card) => card.request.id !== id));
  }, []);

  const clearApprovals = useCallback((reason: string) => {
    const ids = [...approvalResolvers.current.keys()];
    for (const id of ids) {
      settleApproval(id, { status: 'denied', reason });
    }
    if (ids.length > 0) logLine('op-error', reason);
  }, [logLine, settleApproval]);

  const requestHostApproval = useCallback((request: ApprovalRequest): Promise<ApprovalDecision> => {
    logLine('op-meta', `approval pending: ${request.summary}`);
    return new Promise((resolve) => {
      approvalResolvers.current.set(request.id, resolve);
      setApprovalCards((cards) => [{ request }, ...cards.filter((card) => card.request.id !== request.id)]);
    });
  }, [logLine]);

  const readModelSelection = useCallback((): ModelSelectionPayload => {
    const selection: ModelSelectionPayload = {};
    if (modelProviderId) selection.modelProvider = modelProviderId;
    if (generationModel === '__custom__') {
      const custom = customModel.trim();
      if (custom) {
        selection.generationModel = custom;
        selection.customModel = true;
      }
    } else if (generationModel) {
      selection.generationModel = generationModel;
    }
    if (utilityModel) selection.utilityModel = utilityModel;
    const options: ModelOptions = {};
    if (Number.isFinite(maxOutputTokens)) options.maxOutputTokens = maxOutputTokens;
    if (Number.isFinite(repairMaxOutputTokens)) options.repairMaxOutputTokens = repairMaxOutputTokens;
    if (selectedProvider?.id === 'anthropic') {
      options.anthropicThinking = anthropicThinking;
      options.effort = modelEffort;
    }
    if (Object.keys(options).length > 0) selection.modelOptions = options;
    return selection;
  }, [
    anthropicThinking,
    customModel,
    generationModel,
    maxOutputTokens,
    modelEffort,
    modelProviderId,
    repairMaxOutputTokens,
    selectedProvider,
    utilityModel,
  ]);

  const modelProviderIdRef = useRef(modelProviderId);
  const readModelSelectionRef = useRef(readModelSelection);

  useEffect(() => {
    modelProviderIdRef.current = modelProviderId;
    readModelSelectionRef.current = readModelSelection;
  }, [modelProviderId, readModelSelection]);

  const activeContract = useMemo<ActiveContract>(() => {
    const modelSelection = readModelSelection();
    const agentBroker = agentBrokerEnabled && !customContractEnabled && !scenarioUsesFixedPolicy(selectedScenario);
    const overrides = tokenOverridesFor(tokenPreset);
    const repair = repairEnabled
      ? selectedScenario.repair ?? { enabled: true, maxAttempts: 1, maxTargets: 2 }
      : undefined;
    return {
      scenarioId: selectedScenario.id,
      prompt: prompt.trim() || selectedScenario.prompt,
      mode,
      capabilityNames: runtimeCapabilityNames ?? selectedScenario.capabilityNames,
      componentNames: runtimeComponentNames ?? selectedScenario.componentNames,
      agentBroker,
      ...(!agentBroker && !customContractEnabled ? { surfacePolicy: selectedScenario.surfacePolicy } : {}),
      surfacePlan,
      scriptPolicy: deriveSurfacePlanControls(surfacePlan).scriptPolicy,
      ...(layoutId ? { layoutId } : {}),
      ...(overrides ? { tokenOverrides: overrides } : {}),
      ...(repair ? { repair } : {}),
      directionId,
      modelProvider: modelSelection.modelProvider ?? null,
      ...(modelSelection.generationModel ? { generationModel: modelSelection.generationModel } : {}),
      ...(modelSelection.utilityModel ? { utilityModel: modelSelection.utilityModel } : {}),
      ...(modelSelection.customModel ? { customModel: true } : {}),
      ...(modelSelection.modelOptions ? { modelOptions: modelSelection.modelOptions } : {}),
    };
  }, [
    agentBrokerEnabled,
    customContractEnabled,
    directionId,
    layoutId,
    mode,
    prompt,
    readModelSelection,
    repairEnabled,
    runtimeCapabilityNames,
    runtimeComponentNames,
    selectedScenario,
    surfacePlan,
    tokenPreset,
  ]);

  const capabilityRegistry = useMemo(() => {
    if (activeContract.mode !== 'interactive') return null;
    let localSummonCount = summonedCountRef.current;
    return createScopedDemoRegistry({
      modelProvider: () => modelProviderIdRef.current || null,
      modelSelection: () => readModelSelectionRef.current(),
      onLog: (message) => logLine('op-add', message),
      onError: (message) => logLine('op-error', message),
      onApprovalRequest: requestHostApproval,
      onSummon: ({ args, push }) => {
        const child: ChildSurfaceModel = {
          id: Date.now(),
          prompt: args.prompt,
          title: args.title || undefined,
          directionId,
          tokensSource: activeTokensSourceOverride ?? tokensFor(directionId),
          modelSelection: readModelSelectionRef.current(),
          agentBroker: activeContract.agentBroker === true,
        };
        setChildren((items) => [...items, child]);
        localSummonCount += 1;
        summonedCountRef.current = localSummonCount;
        push({ summonedCount: localSummonCount, lastSummoned: args.prompt, summonError: null });
        logLine('op-meta', `summon sibling: ${args.prompt.slice(0, 80)}`);
      },
    }, activeContract.capabilityNames);
  }, [
    activeContract.agentBroker,
    activeContract.capabilityNames,
    activeContract.mode,
    activeTokensSourceOverride,
    directionId,
    logLine,
    requestHostApproval,
    tokensFor,
  ]);

  const capabilityContract = useMemo(() => capabilityRegistry?.toContract() ?? null, [capabilityRegistry]);
  const componentRegistry = useMemo(() => createDemoComponentRegistry(), []);
  const grantedComponents = useMemo(
    () => activeContract.componentNames?.length
      ? narrowComponentPack(baseComponentPack, activeContract.componentNames).components
      : [],
    [activeContract.componentNames],
  );

  function resetForScenarioChange() {
    abortRef.current?.abort();
    clearApprovals('Approval request was replaced');
    setLogs([]);
    setDevEvents([]);
    setStatus('idle');
    setBytes(0);
    setShowWelcome(true);
    setRuntimeCapabilityNames(null);
    setRuntimeComponentNames(null);
    setChildren([]);
    summonedCountRef.current = 0;
    clearRuntimeState();
  }

  function applyScenario(id: string) {
    const scenario = showcaseScenarios.find((item) => item.id === id) ?? showcaseScenarios[0]!;
    setSelectedScenarioId(scenario.id);
    setPrompt(scenario.prompt);
    setMode(scenario.mode);
    setSurfacePlan(scenario.surfacePlan);
    setLayoutId(scenario.layoutId ?? '');
    setTokenPreset(scenario.tokenOverrides ? 'accent-blue' : '');
    setRepairEnabled(Boolean(scenario.repair?.enabled));
    const fallbackDirectionId = directions[0]?.id ?? null;
    const desiredDirectionId = scenario.directionId ?? fallbackDirectionId;
    setDirectionId(desiredDirectionId ?? null);
    if (scenario.id.startsWith('ghost-')) {
      const rootId = scenario.id.slice('ghost-'.length);
      const root = ghostRoots.find((item) => item.id === rootId);
      setGhostTarget(root?.defaultTargetPath || '.');
      setGhostBaseDirectionId(root?.defaultBaseDirectionId ?? defaultGhostBaseDirectionId(directions));
    }
    resetForScenarioChange();
    logLine('op-meta', `scenario -> ${scenario.label}`);
  }

  const applyLineTo = useCallback((line: ProtocolLine, context: SurfaceStreamContext) => {
    if (line.op === 'meta' && line.path === '/error') {
      logLine('op-error', `error: ${String(line.value)}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/mode-upgraded') {
      logLine('op-meta', 'mode auto-upgraded -> interactive');
      setMode('interactive');
      modeRef.current = 'interactive';
      return;
    }
    if (line.op === 'meta' && line.path === '/agent-intent') {
      const summary = agentIntentText(line.value);
      setCurrentAgentIntentSummary(summary);
      logLine('op-meta', `agent intent -> ${summary}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/agent-policy-resolution') {
      const summary = agentPolicyText(line.value);
      setCurrentAgentPolicySummary(summary);
      logLine('op-meta', `agent policy -> ${summary}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/surface-plan') {
      const plan = normalizeSurfacePlan(line.value);
      if (plan) {
        setCurrentEffectiveSurfacePlan(plan);
        appendDevEvent({ kind: 'surface-plan', at: Date.now(), plan });
        logLine('op-meta', `surface -> ${plan.purpose}/${plan.runtime}/${plan.data}/${plan.authority}/${plan.persistence}`);
      } else {
        logLine('op-meta', `surface -> invalid ${JSON.stringify(line.value)}`);
      }
      return;
    }
    if (line.op === 'meta' && line.path === '/surface-contract') {
      const contract = parseSurfaceContractView(line.value);
      if (contract) {
        setCurrentSurfaceContractView(contract);
        appendDevEvent({ kind: 'surface-contract', at: Date.now(), contract });
        logLine('op-meta', `surface contract -> ${contract.tools.length} tools, ${contract.components.length} components`);
      }
      return;
    }
    if (line.op === 'meta' && line.path === '/shape') {
      const shape = typeof line.value === 'string' ? line.value : '';
      if (shape) setCurrentShape(shape);
      logLine('op-meta', `shape -> ${shape || JSON.stringify(line.value)}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/experimental-fragments') {
      logLine('op-meta', `fragments -> ${JSON.stringify(line.value)}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/token-overrides') {
      const applied = parseAppliedTokenOverrides(line.value);
      const css = applyTokenOverrideCss(tokensFor(directionId), applied);
      setActiveTokensSourceOverride(css);
      setSurfaceTokensSource(css);
      const composed = accRef.current.hasAnySection() ? accRef.current.compose() : '';
      window.setTimeout(() => surfaceRef.current?.render(composed), 0);
      const rejected = Array.isArray((line.value as { rejected?: unknown } | undefined)?.rejected)
        ? ((line.value as { rejected?: unknown[] }).rejected ?? []).length
        : 0;
      logLine('op-meta', `token overrides -> applied=${applied.length}; rejected=${rejected}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/ghost-context') {
      const value = line.value as { product?: unknown; source?: unknown; targetPath?: unknown; layers?: unknown; baseDirectionId?: unknown; styleSource?: unknown } | undefined;
      const product = typeof value?.product === 'string' ? value.product : 'Ghost';
      const source = typeof value?.source === 'string' ? value.source : 'root';
      const targetPath = typeof value?.targetPath === 'string' ? value.targetPath : '.';
      const layers = Array.isArray(value?.layers) ? value.layers.filter((layer): layer is string => typeof layer === 'string') : [];
      const base = typeof value?.baseDirectionId === 'string' ? value.baseDirectionId : 'none';
      const style = typeof value?.styleSource === 'string' ? value.styleSource : 'unknown';
      logLine('op-meta', `ghost context -> ${product}; source=${source}; target=${targetPath}; layers=${layers.join(' > ') || '.'}; base=${base}; style=${style}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/ghost-token-source') {
      const value = line.value as { kind?: unknown; source?: unknown; css?: unknown; warnings?: unknown; baseDirectionId?: unknown } | undefined;
      if (typeof value?.css === 'string') {
        setActiveTokensSourceOverride(value.css);
        setSurfaceTokensSource(value.css);
        const composed = accRef.current.hasAnySection() ? accRef.current.compose() : '';
        window.setTimeout(() => surfaceRef.current?.render(composed), 0);
      }
      const source = typeof value?.source === 'string' ? value.source : 'unknown';
      const kind = typeof value?.kind === 'string' ? value.kind : 'unknown';
      const base = typeof value?.baseDirectionId === 'string' ? `; base=${value.baseDirectionId}` : '';
      logLine('op-meta', `ghost tokens -> ${kind} (${source})${base}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/ghost-review-packet') {
      const value = line.value as { baseDirectionId?: unknown; styleSource?: unknown; declaredSections?: unknown; validation?: { blocked?: unknown; warnings?: unknown } } | undefined;
      const base = typeof value?.baseDirectionId === 'string' ? value.baseDirectionId : 'none';
      const style = typeof value?.styleSource === 'string' ? value.styleSource : 'unknown';
      const sections = Array.isArray(value?.declaredSections) ? value.declaredSections.filter((section): section is string => typeof section === 'string') : [];
      const blocked = typeof value?.validation?.blocked === 'number' ? value.validation.blocked : 0;
      const warnings = typeof value?.validation?.warnings === 'number' ? value.validation.warnings : 0;
      logLine('op-meta', `ghost review packet -> base=${base}; style=${style}; sections=${sections.join(', ') || 'none'}; validation=${blocked}/${warnings}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/validation-summary') {
      setCurrentValidationSummary(summarizeValidationMeta(line.value));
      logLine('op-meta', `validation -> ${JSON.stringify(line.value)}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/repair-summary') {
      setCurrentRepairSummary(summarizeRepairMeta(line.value));
      logLine('op-meta', `validation retry -> ${JSON.stringify(line.value)}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/stream-graph-summary') {
      setCurrentStreamHealth(summarizeStreamGraphMeta(line.value));
      logLine('op-meta', `stream diagnostics -> ${JSON.stringify(line.value)}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/status') {
      setStatus(String(line.value));
      return;
    }
    if (line.op === 'meta' && line.path === '/thinking') {
      const text = typeof line.value === 'string' ? line.value : JSON.stringify(line.value);
      logLine('op-meta', `. ${text.slice(0, 160)}${text.length > 160 ? '...' : ''}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/protocol-skip') {
      logLine('op-meta', `skip ${JSON.stringify(line.value)}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/screen-synthesized') {
      const value = line.value as { sections?: unknown } | undefined;
      const sections = Array.isArray(value?.sections) ? value.sections.filter((section): section is string => typeof section === 'string') : [];
      logLine('op-meta', `screen synthesized -> ${sections.join(', ') || '(none)'}`);
      return;
    }
    if (line.op === 'meta') {
      logLine('op-meta', `meta ${line.path} = ${JSON.stringify(line.value)}`);
      return;
    }
    if (line.op === 'set') {
      const changed = context.applyResult?.changed ?? false;
      logLine('op-set', `set ${line.path} = ${JSON.stringify(line.value)}`);
      if (changed) {
        artifactRevisionRef.current += 1;
        setArtifactRevision(artifactRevisionRef.current);
      }
      return;
    }
    if (line.op === 'add') {
      const changed = context.applyResult?.changed ?? false;
      const preview = (line.html ?? '').slice(0, 120).replace(/\s+/g, ' ');
      logLine('op-add', `add ${line.path} (${(line.html ?? '').length} chars): ${preview}${(line.html ?? '').length > 120 ? '...' : ''}`);
      if (changed) {
        artifactRevisionRef.current += 1;
        setArtifactRevision(artifactRevisionRef.current);
      }
    }
  }, [appendDevEvent, directionId, logLine, tokensFor]);

  const streamGenerationInto = useCallback(async (opts: StreamOptions): Promise<StreamResult> => {
    const active = opts.active;
    const ghostRootId = ghostRootFromSelection(opts.directionId);
    const capabilityPack = capabilityPackFor(active);
    const components = componentPackFor(active);
    const surfaceRequest = surfaceRequestFor(active);
    const agent = agentBrokerRequestFor(active);

    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: opts.prompt,
        ...(active.modelProvider ? { modelProvider: active.modelProvider } : {}),
        ...(active.generationModel ? { generationModel: active.generationModel } : {}),
        ...(active.utilityModel ? { utilityModel: active.utilityModel } : {}),
        ...(active.customModel ? { customModel: true } : {}),
        ...(active.modelOptions ? { modelOptions: active.modelOptions } : {}),
        ...(ghostRootId
          ? {
              ghost: {
                rootId: ghostRootId,
                targetPath: opts.ghostTargetPath,
                ...(opts.ghostBaseDirectionId ? { baseDirectionId: opts.ghostBaseDirectionId } : {}),
              },
            }
          : { directionId: opts.directionId }),
        mode: modeRef.current,
        capabilities: capabilityPack,
        ...(components ? { components } : {}),
        surfaceCeiling: demoSurfaceCeiling,
        ...(agent ? { agent } : {}),
        scriptPolicy: active.scriptPolicy,
        ...(opts.fragmentMode !== 'section' && !opts.edit ? { fragmentMode: opts.fragmentMode } : {}),
        ...surfaceRequest,
        ...(active.tokenOverrides ? { tokenOverrides: active.tokenOverrides } : {}),
        ...(opts.layout ? { layout: opts.layout } : {}),
        ...(opts.edit ? { edit: opts.edit } : {}),
        ...(active.repair ? { repair: active.repair } : {}),
      }),
      signal: opts.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
    }
    if (!response.body) throw new Error('no response body');

    let byteTotal = 0;
    let surfacePlanFromStream: SurfacePlan | null = null;
    let shapeFromStream: string | null = null;
    const result = await consumeSurfaceStream(chunksWithByteCounts(response.body, (count) => {
      byteTotal += count;
      setBytes(byteTotal);
    }), {
      mode: () => modeRef.current,
      accumulator: accRef.current,
      shouldApplyLine: (line) => {
        if (
          opts.edit &&
          line.op !== 'meta' &&
          accRef.current.hasAnySection() &&
          artifactRevisionRef.current !== opts.edit.baseRevision
        ) {
          logLine('op-meta', `stale edit discarded (base rev ${opts.edit.baseRevision}, current rev ${artifactRevisionRef.current})`);
          return 'stop';
        }
        return 'apply';
      },
      onLine: (line, context) => {
        appendDevEvent({ kind: 'protocol-line', at: Date.now(), line });
        if (line.op !== 'meta') applyLineTo(line, context);
      },
      onMeta: (line, context) => {
        if (line.path === '/surface-plan') surfacePlanFromStream = normalizeSurfacePlan(line.value);
        if (line.path === '/shape' && typeof line.value === 'string') shapeFromStream = line.value;
        applyLineTo(line, context);
      },
      onParseError: (raw) => {
        appendDevEvent({ kind: 'protocol-parse-error', at: Date.now(), raw });
        logLine('raw', `. ${raw.slice(0, 120)}`);
      },
      onGraph: (snapshot) => {
        appendDevEvent({
          kind: 'stream-graph',
          at: Date.now(),
          health: snapshot.health,
          sections: snapshot.sections.map(({ id, declared, present, revision, bytes }) => ({
            id,
            declared,
            present,
            revision,
            bytes,
          })),
        });
      },
      onRenderHtml: (html) => {
        surfaceRef.current?.render(html);
      },
      onNodePatch: (patch) => {
        surfaceRef.current?.patchNode(patch);
      },
    });

    return {
      ...result,
      surfacePlan: surfacePlanFromStream,
      shape: shapeFromStream,
    };
  }, [appendDevEvent, applyLineTo, logLine]);

  const readLayout = useCallback((): SummonLayout | null => {
    const layout = layoutPresets.get(layoutId);
    return layout ? { id: layout.id, slots: layout.slots.map((slot) => ({ ...slot })) } : null;
  }, [layoutId]);

  const updateSavedSurfaces = useCallback((items: SurfaceEnvelope[]) => {
    writeSavedSurfaces(items);
    setSavedSurfaces(loadSavedSurfaces());
  }, []);

  const saveSurfaceEnvelope = useCallback((runPrompt: string, result: StreamResult) => {
    if (!result.surfacePlan || !accRef.current.hasAnySection()) return;
    const envelope = createSurfaceEnvelope({
      prompt: runPrompt,
      surfacePlan: result.surfacePlan,
      protocolLines: result.protocolLines,
      html: accRef.current.compose(),
      validationIssues: result.validationIssues,
      streamGraph: result.streamGraph,
      grants: {
        intents: capabilityRegistry?.intents() ?? [],
        capabilities: capabilityContract?.validationCapabilities,
        components: grantedComponents,
      },
      metadata: {
        directionId,
        layoutId: readLayout()?.id ?? null,
        shape: result.shape,
        mode,
      },
      tokenCss: activeTokensSourceOverride ?? tokensFor(directionId),
    });
    updateSavedSurfaces([
      envelope,
      ...loadSavedSurfaces().filter((item) => item.id !== envelope.id),
    ]);
  }, [
    activeTokensSourceOverride,
    capabilityContract,
    capabilityRegistry,
    directionId,
    grantedComponents,
    mode,
    readLayout,
    tokensFor,
    updateSavedSurfaces,
  ]);

  const replayCurrentArtifact = useCallback(() => {
    if (!accRef.current.hasAnySection()) return;
    const html = accRef.current.compose();
    window.setTimeout(() => surfaceRef.current?.render(html), 0);
    window.setTimeout(() => surfaceRef.current?.render(html), 100);
  }, []);

  async function generate(runPrompt: string) {
    abortRef.current?.abort();
    const abort = new AbortController();
    const runTokensSource = activeTokensSourceOverride ?? tokensFor(directionId);
    abortRef.current = abort;
    clearApprovals('Approval request was replaced');
    setChildren([]);
    summonedCountRef.current = 0;
    setRuntimeCapabilityNames(null);
    setRuntimeComponentNames(null);
    setLogs([]);
    setDevEvents([]);
    clearRuntimeState();
    setSurfaceTokensSource(runTokensSource);
    setShowWelcome(false);
    setRunning(true);
    setStatus('streaming');
    setBytes(0);
    appendDevEvent({ kind: 'stream-lifecycle', at: Date.now(), phase: 'start' });

    try {
      const result = await streamGenerationInto({
        prompt: runPrompt,
        active: activeContract,
        directionId,
        ghostTargetPath: ghostTarget.trim() || '.',
        ghostBaseDirectionId: ghostBaseDirectionId ?? defaultGhostBaseDirectionId(directions),
        layout: readLayout(),
        fragmentMode,
        signal: abort.signal,
      });
      if (!currentValidationSummary) setCurrentValidationSummary('0/0');
      if (!currentRepairSummary) setCurrentRepairSummary(activeContract.repair?.enabled ? '0/0' : 'off');
      setCurrentStreamHealth((current) => current ?? `${result.streamGraph.health.complete ? 'complete' : 'open'} · missing=${result.streamGraph.health.missingDeclared.length} blocked=${result.streamGraph.health.blockedCount} retried=${result.streamGraph.health.repairedCount}`);
      setStatus('done');
      saveSurfaceEnvelope(runPrompt, result);
      replayCurrentArtifact();
      appendDevEvent({ kind: 'stream-lifecycle', at: Date.now(), phase: 'end', ok: true });
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setStatus('aborted');
        appendDevEvent({ kind: 'stream-lifecycle', at: Date.now(), phase: 'end', ok: false });
      } else {
        const message = err instanceof Error ? err.message : String(err);
        logLine('op-error', `stream error: ${message}`);
        setStatus('error');
        appendDevEvent({ kind: 'stream-lifecycle', at: Date.now(), phase: 'end', ok: false });
      }
    } finally {
      setRunning(false);
    }
  }

  async function editArtifact() {
    if (!accRef.current.hasAnySection() || !editPrompt.trim()) return;
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    const baseRevision = artifactRevisionRef.current;
    const targets = editTargets
      .split(/[,\s]+/)
      .map((target) => target.trim())
      .filter(Boolean);
    setRunning(true);
    setStatus('editing');
    setBytes(0);
    appendDevEvent({ kind: 'stream-lifecycle', at: Date.now(), phase: 'start' });
    try {
      const result = await streamGenerationInto({
        prompt: editPrompt.trim(),
        active: {
          ...activeContract,
          agentBroker: false,
          surfacePolicy: activeContract.surfacePolicy,
        },
        directionId,
        ghostTargetPath: ghostTarget.trim() || '.',
        ghostBaseDirectionId: ghostBaseDirectionId ?? defaultGhostBaseDirectionId(directions),
        layout: readLayout(),
        signal: abort.signal,
        edit: {
          baseRevision,
          sections: accRef.current.snapshot().sections,
          targetSections: targets.length ? Array.from(new Set(targets)) : undefined,
        },
      });
      setCurrentStreamHealth((current) => current ?? `${result.streamGraph.health.complete ? 'complete' : 'open'} · missing=${result.streamGraph.health.missingDeclared.length} blocked=${result.streamGraph.health.blockedCount} retried=${result.streamGraph.health.repairedCount}`);
      setStatus('done');
      replayCurrentArtifact();
      appendDevEvent({ kind: 'stream-lifecycle', at: Date.now(), phase: 'end', ok: true });
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setStatus('aborted');
      } else {
        const message = err instanceof Error ? err.message : String(err);
        logLine('op-error', `edit error: ${message}`);
        setStatus('error');
      }
      appendDevEvent({ kind: 'stream-lifecycle', at: Date.now(), phase: 'end', ok: false });
    } finally {
      setRunning(false);
    }
  }

  function replaySurface(envelope: SurfaceEnvelope) {
    abortRef.current?.abort();
    clearApprovals('Approval request was replaced');
    setLogs([]);
    setDevEvents([]);
    accRef.current = new SectionAccumulator();
    for (const line of envelope.protocolLines) {
      if (line.op !== 'meta') accRef.current.applyDetailed(line);
    }
    artifactRevisionRef.current = accRef.current.snapshot().sections.length;
    setArtifactRevision(artifactRevisionRef.current);
    setActiveTokensSourceOverride(envelope.tokenCss ?? null);
    setSurfaceTokensSource(envelope.tokenCss ?? defaultTokensSource);
    setMode(deriveSurfacePlanControls(envelope.surfacePlan).mode);
    modeRef.current = deriveSurfacePlanControls(envelope.surfacePlan).mode;
    setSurfacePlan(envelope.surfacePlan);
    setCurrentEffectiveSurfacePlan(envelope.surfacePlan);
    setCurrentShape(envelope.metadata.shape ?? null);
    setCurrentValidationSummary(`${envelope.validationIssues.filter((issue) => issue.severity === 'block').length}/${envelope.validationIssues.filter((issue) => issue.severity === 'warn').length}`);
    setCurrentStreamHealth(envelope.streamGraph
      ? `${envelope.streamGraph.health.complete ? 'complete' : 'open'} · missing=${envelope.streamGraph.health.missingDeclared.length} blocked=${envelope.streamGraph.health.blockedCount} retried=${envelope.streamGraph.health.repairedCount}`
      : null);
    setCurrentSurfaceContractView(null);
    setRuntimeCapabilityNames(envelope.grants.intents);
    setRuntimeComponentNames(envelope.grants.components?.map((component) => component.name) ?? null);
    setShowWelcome(false);
    setStatus('replayed');
    setBytes(new TextEncoder().encode(envelope.html).byteLength);
    window.setTimeout(() => surfaceRef.current?.render(envelope.html), 0);
    appendDevEvent({ kind: 'surface-plan', at: Date.now(), plan: envelope.surfacePlan });
    appendDevEvent({ kind: 'stream-lifecycle', at: Date.now(), phase: 'end', ok: true });
    logLine('op-meta', `replayed ${envelope.surfacePlan.purpose}/${envelope.surfacePlan.runtime}`);
  }

  const groupedScenarios = useMemo(() => {
    const grouped = new Map<string, ShowcaseScenario[]>();
    for (const scenario of showcaseScenarios) {
      const { category } = describeScenario(scenario);
      const items = grouped.get(category) ?? [];
      items.push(scenario);
      grouped.set(category, items);
    }
    const orderedCategories = [
      ...scenarioCategoryOrder.filter((category) => grouped.has(category)),
      ...Array.from(grouped.keys()).filter((category) => !scenarioCategoryOrder.includes(category)),
    ];
    return orderedCategories.map((category) => ({ category, scenarios: grouped.get(category) ?? [] }));
  }, [showcaseScenarios]);

  const scenarioPresentation = describeScenario(selectedScenario);
  const providerModels = selectedProvider?.models.length
    ? selectedProvider.models
    : selectedProvider
      ? fallbackCatalog(selectedProvider.model, selectedProvider.model)
      : [];
  const utilityModels = selectedProvider?.utilityModels.length
    ? selectedProvider.utilityModels
    : selectedProvider
      ? fallbackCatalog(selectedProvider.utilityModel, selectedProvider.utilityModel)
      : [];
  const scriptPolicy = deriveSurfacePlanControls(surfacePlan).scriptPolicy;
  const statusText = bytes ? `${status} · ${bytes.toLocaleString()} B` : status;
  const hasArtifact = artifactRevision > 0 || accRef.current.hasAnySection();
  const contractRows = buildContractRows({
    active: activeContract,
    selectedScenario,
    modelProviders,
    currentAgentIntentSummary,
    currentAgentPolicySummary,
    currentEffectiveSurfacePlan,
    currentShape,
    currentStreamHealth,
    currentSurfaceContractView,
    currentRepairSummary,
    currentValidationSummary,
  });
  const firstEventAt = devEvents[0]?.at ?? null;
  const devtoolsTally = useMemo(() => {
    if (devEvents.length === 0) return 'no events';
    const counts: Record<string, number> = {};
    for (const ev of devEvents) counts[ev.kind] = (counts[ev.kind] ?? 0) + 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([kind, count]) => `${displayEventKind(kind)} ${count}`)
      .join(' · ');
  }, [devEvents]);

  return (
    <>
      <AppNav active="generate" />
      <PageHeader
        title="Generate"
        lede="Scenario-led generative UI workbench"
        className="generate-header"
      />

      <div className="generate-shell">
        <aside className="scenario-rail" aria-label="Scenario library">
          <div className="rail-heading">
            <span>Scenario Library</span>
            <span id="scenario-count">{showcaseScenarios.length}</span>
          </div>
          <label className="field-label" htmlFor="scenario">Preset</label>
          <select
            id="scenario"
            className="pill-select scenario-select"
            title="Showcase scenario"
            value={selectedScenario.id}
            onChange={(event) => applyScenario(event.target.value)}
          >
            {showcaseScenarios.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>{scenario.label}</option>
            ))}
          </select>
          <div id="scenario-list" className="scenario-list">
            {groupedScenarios.map((group) => (
              <section key={group.category} className="scenario-group">
                <h3>{group.category}</h3>
                {group.scenarios.map((scenario) => {
                  const presentation = describeScenario(scenario);
                  const active = scenario.id === selectedScenario.id;
                  const componentCount = scenario.componentNames?.length ?? 0;
                  return (
                    <button
                      key={scenario.id}
                      type="button"
                      className={active ? 'scenario-card active' : 'scenario-card'}
                      data-scenario-id={scenario.id}
                      aria-pressed={active ? 'true' : 'false'}
                      onClick={() => applyScenario(scenario.id)}
                    >
                      <span className="scenario-card-title">{scenario.label}</span>
                      <span className="scenario-card-desc">{presentation.description}</span>
                      <span className="scenario-card-meta">
                        {compactPlanText(scenario.surfacePlan)} · {scenario.capabilityNames.length} host tools{componentCount ? ` · ${componentCount} components` : ''}
                      </span>
                    </button>
                  );
                })}
              </section>
            ))}
          </div>
        </aside>

        <main className="generation-stage">
          <section className="stage-context" aria-label="Selected scenario">
            <div>
              <div className="stage-eyebrow" id="scenario-active-category">{scenarioPresentation.category}</div>
              <h2 id="scenario-active-title">{selectedScenario.label}</h2>
              <p id="scenario-active-desc">{scenarioPresentation.description}</p>
            </div>
            <div className="stage-fingerprint">
              <span id="scenario-active-fingerprint">{compactPlanText(selectedScenario.surfacePlan)}</span>
              <strong id="scenario-active-grants">
                {selectedScenario.capabilityNames.length} host tools{selectedScenario.componentNames?.length ? ` · ${selectedScenario.componentNames.length} trusted components` : ''}
              </strong>
            </div>
          </section>

          <form id="form" className="prompt-card" onSubmit={(event) => {
            event.preventDefault();
            const value = prompt.trim();
            if (value) void generate(value);
          }}>
            <label className="field-label" htmlFor="prompt">Prompt</label>
            <div className="prompt-input">
              <textarea
                id="prompt"
                placeholder="describe a UI or choose a showcase scenario..."
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
              />
              <button id="go" type="submit" className="prompt-submit" disabled={running || !prompt.trim()}>Run</button>
            </div>
          </form>

          <div className="result-toolbar" id="result-toolbar" hidden={!hasArtifact}>
            <div>
              <span className="toolbar-label">Surface</span>
              <strong id="result-summary">{hasArtifact ? `${status} · ${compactPlanText(currentEffectiveSurfacePlan ?? surfacePlan)}` : 'Awaiting run'}</strong>
            </div>
            <div className="toolbar-actions">
              <button id="rerun" type="button" disabled={running || !prompt.trim()} onClick={() => void generate(prompt.trim())}>Re-run</button>
              <button id="open-history" type="button" onClick={() => setDiagnosticsTab('history')}>History</button>
            </div>
          </div>

          <div className="edit-card" id="edit-card" hidden={!hasArtifact}>
            <input id="edit-targets" type="text" placeholder="section ids, e.g. hero, details" value={editTargets} onChange={(event) => setEditTargets(event.target.value)} />
            <textarea id="edit-prompt" placeholder="describe the edit..." value={editPrompt} onChange={(event) => setEditPrompt(event.target.value)} />
            <button id="edit-go" type="button" className="edit-submit" disabled={running || !hasArtifact || !editPrompt.trim()} onClick={() => void editArtifact()}>Patch</button>
          </div>

          <Pane title="Sandbox" status={<span id="iframe-status">{statusText}</span>} className="pane-result sandbox-stage">
            <div className="iframe-wrap">
              <SummonSurface
                ref={surfaceRef}
                id="sandbox"
                className="h-640"
                title="Summon generate sandbox"
                html=""
                tokensSource={surfaceTokensSource}
                capabilityRegistry={capabilityRegistry}
                componentRegistry={componentRegistry}
                grantedCapabilities={capabilityContract?.validationCapabilities}
                artifactComponents={grantedComponents}
                onEvent={appendDevEvent}
                onIntentRejected={handleSurfaceIntentRejected}
                onHandlerError={handleSurfaceHandlerError}
                onComponentError={handleSurfaceComponentError}
              />
              {showWelcome ? (
                <div className="iframe-welcome" id="welcome">
                  <div className="welcome-text" id="welcome-text">{selectedScenario.label} awaits generated UI.</div>
                </div>
              ) : null}
            </div>
          </Pane>

          <div id="children" className="children-stack" aria-label="Summoned sibling sandboxes">
            {children.map((child) => (
              <ChildSurface
                key={child.id}
                child={child}
                onClose={() => setChildren((items) => items.filter((item) => item.id !== child.id))}
              />
            ))}
          </div>
        </main>

        <aside className="contract-inspector" aria-label="Contract inspector">
          <div className="inspector-heading">
            <span>Surface Inspector</span>
            <span id="inspector-status">{currentSurfaceContractView ? 'contract' : currentEffectiveSurfacePlan ? 'effective' : 'pending'}</span>
          </div>
          <div className="contract-summary" id="contract-summary">
            {contractRows.map((row) => (
              <div key={row.key} className={`contract-row ${row.tone}`} data-contract-row={row.key} title={row.value}>
                <span className="contract-row-label">{row.label}</span>
                <strong className="contract-row-value">{row.value}</strong>
              </div>
            ))}
          </div>

          <section className="run-settings" aria-label="Run settings">
            <div className="settings-grid">
              <label>
                <span className="field-label">Provider</span>
                <select id="model-provider" className="pill-select" title="Model provider" value={modelProviderId} disabled={modelProviders.length === 0} onChange={(event) => {
                  setModelProviderId(event.target.value);
                  setGenerationModel('');
                  setUtilityModel('');
                }}>
                  {modelProviders.length === 0 ? <option value="">Server default</option> : null}
                  {modelProviders.map((provider) => (
                    <option key={provider.id} value={provider.id} disabled={!provider.configured} title={provider.configured ? `${provider.model} for generation; ${provider.utilityModel} for utility calls` : `Set ${provider.missingEnv ?? 'provider key'}`}>
                      {provider.configured ? provider.name : `${provider.name} (missing key)`}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="field-label">Model</span>
                <select id="generation-model" className="pill-select" title="Generation model" value={generationModel} disabled={!selectedProvider} onChange={(event) => setGenerationModel(event.target.value)}>
                  {providerModels.map((model) => (
                    <option key={model.id} value={model.id} title={model.description ?? model.id}>
                      {model.label} · {model.tier}{model.status === 'stable' ? '' : ` · ${model.status}`}
                    </option>
                  ))}
                  {selectedProvider?.controls?.customModels !== false ? <option value="__custom__">Custom model...</option> : null}
                </select>
              </label>
              <label id="custom-model-field" hidden={generationModel !== '__custom__'}>
                <span className="field-label">Custom model</span>
                <input id="custom-model" className="ghost-target" type="text" placeholder="provider-model-id" title="Custom generation model id" value={customModel} onChange={(event) => setCustomModel(event.target.value)} />
              </label>
              <label>
                <span className="field-label">Utility</span>
                <select id="utility-model" className="pill-select" title="Utility model for shape and host demo calls" value={utilityModel} disabled={!selectedProvider} onChange={(event) => setUtilityModel(event.target.value)}>
                  {utilityModels.map((model) => (
                    <option key={model.id} value={model.id}>{model.label} · {model.tier}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="field-label">Max output</span>
                <select id="max-output-tokens" className="pill-select" title="Generation output token cap" value={maxOutputTokens} onChange={(event) => setMaxOutputTokens(Number(event.target.value))}>
                  {numberOptions(selectedProvider?.controls?.maxOutputTokens.presets, maxOutputTokens).map((value) => <option key={value} value={value}>{value.toLocaleString()}</option>)}
                </select>
              </label>
              <label>
                <span className="field-label">Repair cap</span>
                <select id="repair-max-output-tokens" className="pill-select" title="Repair output token cap" value={repairMaxOutputTokens} onChange={(event) => setRepairMaxOutputTokens(Number(event.target.value))}>
                  {numberOptions(selectedProvider?.controls?.repairMaxOutputTokens.presets, repairMaxOutputTokens).map((value) => <option key={value} value={value}>{value.toLocaleString()}</option>)}
                </select>
              </label>
              <label id="anthropic-thinking-field" hidden={selectedProvider?.id !== 'anthropic'}>
                <span className="field-label">Thinking</span>
                <select id="anthropic-thinking" className="pill-select" title="Anthropic thinking mode" value={anthropicThinking} onChange={(event) => setAnthropicThinking(event.target.value as 'adaptive' | 'off')}>
                  {(selectedProvider?.controls?.anthropicThinking?.options ?? ['adaptive', 'off']).map((value) => <option key={value} value={value}>{value === 'adaptive' ? 'Adaptive' : 'Off'}</option>)}
                </select>
              </label>
              <label id="model-effort-field" hidden={selectedProvider?.id !== 'anthropic'}>
                <span className="field-label">Effort</span>
                <select id="model-effort" className="pill-select" title="Anthropic effort" value={modelEffort} onChange={(event) => setModelEffort(event.target.value as 'low' | 'medium' | 'high')}>
                  {(selectedProvider?.controls?.effort?.options ?? ['low', 'medium', 'high']).map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label>
                <span className="field-label">Direction</span>
                <select id="direction" className="pill-select" title="Design direction" value={directionId ?? ''} onChange={(event) => {
                  const next = event.target.value || null;
                  setDirectionId(next);
                  setActiveTokensSourceOverride(null);
                  setShowWelcome(true);
                }}>
                  {directions.length === 0 && ghostRoots.length === 0 ? <option value="">Default (no direction)</option> : null}
                  {directions.map((direction) => <option key={direction.id} value={direction.id} title={direction.description}>{direction.name}</option>)}
                  {ghostRoots.map((root) => <option key={root.id} value={ghostSelectionValue(root.id)}>Ghost · {root.id}</option>)}
                </select>
              </label>
              <label>
                <span className="field-label">Layout</span>
                <select id="layout" className="pill-select" title="Host layout" value={layoutId} onChange={(event) => setLayoutId(event.target.value)}>
                  <option value="">Free layout</option>
                  <option value="card-structured">Card: header/content/actions</option>
                </select>
              </label>
              <label>
                <span className="field-label">Fragment unit</span>
                <select id="fragment-unit" className="pill-select" title="Streaming fragment unit" value={fragmentMode} onChange={(event) => setFragmentMode(event.target.value as FragmentMode)}>
                  <option value="section">Sections</option>
                  <option value="block-v0">Blocks (experimental)</option>
                  <option value="html-node-v0">HTML nodes (experimental)</option>
                </select>
              </label>
              <label>
                <span className="field-label">Scripts</span>
                <select id="script-policy" className="pill-select" title="Script policy" value={scriptPolicy} disabled>
                  <option value="forbid">Scripts forbidden</option>
                  <option value="allow">Scripts allowed</option>
                </select>
              </label>
              <label>
                <span className="field-label">Tokens</span>
                <select id="token-preset" className="pill-select" title="Token override preset" value={tokenPreset} disabled={Boolean(ghostRootFromSelection(directionId))} onChange={(event) => setTokenPreset(event.target.value)}>
                  <option value="">Base tokens</option>
                  <option value="accent-blue">Accent override</option>
                </select>
              </label>
            </div>

            <div className="settings-row">
              <div className="mode-group" title="Mode">
                <label><input type="radio" name="mode" value="static" checked={mode === 'static'} onChange={() => setMode('static')} /><span>Static</span></label>
                <label><input type="radio" name="mode" value="interactive" checked={mode === 'interactive'} onChange={() => setMode('interactive')} /><span>Interactive</span></label>
              </div>
              <label className="repair-toggle" title="Infer surface policy from the prompt within host ceilings">
                <input id="agent-broker-enabled" type="checkbox" checked={agentBrokerEnabled} disabled={customContractEnabled || scenarioUsesFixedPolicy(selectedScenario)} onChange={(event) => setAgentBrokerEnabled(event.target.checked)} />
                <span>Agent broker</span>
              </label>
              <label className="repair-toggle" title="Enable validation retry">
                <input id="repair-enabled" type="checkbox" checked={repairEnabled} onChange={(event) => setRepairEnabled(event.target.checked)} />
                <span>Validation retry</span>
              </label>
            </div>

            <div className="ghost-controls">
              <label>
                <span className="field-label">Ghost target</span>
                <input id="ghost-target" className="ghost-target" type="text" value={ghostTarget} disabled={!ghostRootFromSelection(directionId)} placeholder="Ghost target path" title="Ghost target path" onChange={(event) => setGhostTarget(event.target.value)} />
              </label>
              <label>
                <span className="field-label">Ghost base</span>
                <select id="ghost-base-direction" className="pill-select" title="Ghost base direction" value={ghostBaseDirectionId ?? ''} disabled={!ghostRootFromSelection(directionId) || directions.length === 0} onChange={(event) => setGhostBaseDirectionId(event.target.value || null)}>
                  {directions.map((direction) => <option key={direction.id} value={direction.id}>{direction.name}</option>)}
                </select>
              </label>
            </div>
          </section>

          <section className="custom-contract">
            <label className="custom-contract-toggle">
              <input id="custom-contract-enabled" type="checkbox" checked={customContractEnabled} onChange={(event) => {
                const enabled = event.target.checked;
                setCustomContractEnabled(enabled);
                if (!enabled) setSurfacePlan(selectedScenario.surfacePlan);
              }} />
              <span>Custom Surface Config</span>
            </label>
            <div id="custom-contract-panel" className="custom-contract-panel" hidden={!customContractEnabled}>
              <div className="surface-controls" aria-label="Surface config controls">
                <select id="surface-purpose" className="pill-select" title="Surface purpose" value={surfacePlan.purpose} onChange={(event) => setSurfacePlan((plan) => ({ ...plan, purpose: event.target.value as SurfacePlan['purpose'] }))}>
                  {SURFACE_PURPOSE_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
                <select id="surface-runtime" className="pill-select" title="Surface runtime" value={surfacePlan.runtime} onChange={(event) => setSurfacePlan((plan) => ({ ...plan, runtime: event.target.value as SurfacePlan['runtime'] }))}>
                  {SURFACE_RUNTIME_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
                <select id="surface-data" className="pill-select" title="Surface data" value={surfacePlan.data} onChange={(event) => setSurfacePlan((plan) => ({ ...plan, data: event.target.value as SurfacePlan['data'] }))}>
                  {SURFACE_DATA_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
                <select id="surface-authority" className="pill-select" title="Surface authority" value={surfacePlan.authority} onChange={(event) => setSurfacePlan((plan) => ({ ...plan, authority: event.target.value as SurfacePlan['authority'] }))}>
                  {SURFACE_AUTHORITY_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
                <select id="surface-persistence" className="pill-select" title="Surface persistence" value={surfacePlan.persistence} onChange={(event) => setSurfacePlan((plan) => ({ ...plan, persistence: event.target.value as SurfacePlan['persistence'] }))}>
                  {SURFACE_PERSISTENCE_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>
            </div>
          </section>
        </aside>
      </div>

      <section className="diagnostics-dock" aria-label="Diagnostics">
        <div className="diagnostics-tabs" role="tablist" aria-label="Diagnostics tabs">
          <button id="tab-stream" type="button" className={diagnosticsTab === 'stream' ? 'active' : ''} data-diagnostics-tab="stream" aria-selected={diagnosticsTab === 'stream'} onClick={() => setDiagnosticsTab('stream')}>Stream <span id="stream-tail">{statusText}</span></button>
          <button id="tab-devtools" type="button" className={diagnosticsTab === 'devtools' ? 'active' : ''} data-diagnostics-tab="devtools" aria-selected={diagnosticsTab === 'devtools'} onClick={() => setDiagnosticsTab('devtools')}>Devtools <span id="devtools-tally">{devtoolsTally}</span></button>
          <button id="tab-history" type="button" className={diagnosticsTab === 'history' ? 'active' : ''} data-diagnostics-tab="history" aria-selected={diagnosticsTab === 'history'} onClick={() => setDiagnosticsTab('history')}>History <span id="saved-count">{savedSurfaces.length}</span></button>
          <button id="tab-safety" type="button" className={diagnosticsTab === 'safety' ? 'active' : ''} data-diagnostics-tab="safety" aria-selected={diagnosticsTab === 'safety'} onClick={() => setDiagnosticsTab('safety')}>Safety</button>
        </div>

        <div className="diagnostics-panel active" id="diagnostics-stream" data-diagnostics-panel="stream" hidden={diagnosticsTab !== 'stream'}>
          <LogView id="log">
            {logs.map((entry, index) => <div key={index} className={entry.cls}>{entry.text}</div>)}
          </LogView>
        </div>
        <div className="diagnostics-panel" id="diagnostics-devtools" data-diagnostics-panel="devtools" hidden={diagnosticsTab !== 'devtools'}>
          <LogView id="devtools-log" className="devtools-log">
            {devEvents.map((event, index) => (
              <div key={index} className={`ev ev-${event.kind}`}>
                <span className="ev-time">{firstEventAt === null ? '+0000ms' : `+${(event.at - firstEventAt).toString().padStart(4, ' ')}ms`}</span>
                <span className="ev-kind">{event.kind}</span>
                <span className="ev-summary">{formatDevtoolsEvent(event)}</span>
              </div>
            ))}
          </LogView>
        </div>
        <div className="diagnostics-panel" id="diagnostics-history" data-diagnostics-panel="history" hidden={diagnosticsTab !== 'history'}>
          <div className="saved-surfaces" id="saved-surfaces">
            <div id="saved-list" className="saved-list">
              {savedSurfaces.length === 0 ? (
                <div className="saved-item">
                  <div>
                    <div className="saved-item-title">No saved surfaces yet</div>
                    <div className="saved-item-meta">Completed runs appear here.</div>
                  </div>
                </div>
              ) : savedSurfaces.map((item) => {
                const complete = item.streamGraph?.health.complete ? 'complete' : 'open';
                return (
                  <div key={item.id} className="saved-item">
                    <div>
                      <div className="saved-item-title" title={item.prompt}>{item.prompt}</div>
                      <div className="saved-item-meta">
                        {compactPlanText(item.surfacePlan)} · hostTools={item.grants.intents.length} · validation={item.validationIssues.length} · {complete} · {new Date(item.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                    <button type="button" onClick={() => replaySurface(item)}>Replay</button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="diagnostics-panel" id="diagnostics-safety" data-diagnostics-panel="safety" hidden={diagnosticsTab !== 'safety'}>
          <div className="safety-links" aria-label="Safety checks">
            <a href="/adversarial">Adversarial</a>
            <a href="/strict">Strict input</a>
            <a href="/fatal">Fatal boot</a>
          </div>
        </div>
      </section>

      {approvalCards.length > 0 ? (
        <div className="approval-stack">
          {approvalCards.map(({ request }) => (
            <section key={request.id} className="approval-card" data-approval-id={request.id}>
              <span>{request.capability}</span>
              <strong>{request.summary}</strong>
              <p>Request {request.id}</p>
              {request.details ? <pre>{formatApprovalDetails(request.details)}</pre> : null}
              <div className="approval-actions">
                <button type="button" onClick={() => {
                  logLine('op-error', `approval denied: ${request.id}`);
                  settleApproval(request.id, { status: 'denied', reason: 'Demo approval denied' });
                }}>Deny</button>
                <button type="button" className="approval-approve" onClick={() => {
                  logLine('op-add', `approval approved: ${request.id}`);
                  settleApproval(request.id, 'approved');
                }}>Approve</button>
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </>
  );
}

function buildContractRows({
  active,
  selectedScenario,
  modelProviders,
  currentAgentIntentSummary,
  currentAgentPolicySummary,
  currentEffectiveSurfacePlan,
  currentShape,
  currentStreamHealth,
  currentSurfaceContractView,
  currentRepairSummary,
  currentValidationSummary,
}: {
  active: ActiveContract;
  selectedScenario: ShowcaseScenario;
  modelProviders: ModelProviderInfo[];
  currentAgentIntentSummary: string | null;
  currentAgentPolicySummary: string | null;
  currentEffectiveSurfacePlan: SurfacePlan | null;
  currentShape: string | null;
  currentStreamHealth: string | null;
  currentSurfaceContractView: SurfaceContractView | null;
  currentRepairSummary: string | null;
  currentValidationSummary: string | null;
}) {
  const requested = active.surfacePlan;
  const broker = active.agentBroker
    ? currentAgentPolicySummary ?? currentAgentIntentSummary ?? 'planning on run'
    : scenarioUsesFixedPolicy(selectedScenario)
      ? 'fixed scripted policy'
      : 'manual surface config';
  const contract = currentSurfaceContractView;
  const hostTools = contract
    ? contract.tools.map((tool) => tool.name).join(', ') || 'none'
    : active.capabilityNames.length ? active.capabilityNames.join(', ') : 'none';
  const components = contract
    ? contract.components.map((component) => component.name).join(', ') || 'none'
    : active.componentNames?.length ? active.componentNames.join(', ') : 'none';
  const toolCount = contract?.tools.length ?? active.capabilityNames.length;
  const componentCount = contract?.components.length ?? active.componentNames?.length ?? 0;
  const validation = currentValidationSummary ?? 'pending';
  const stream = currentStreamHealth ?? 'pending';
  const effectivePlan = contract?.surface.plan ?? currentEffectiveSurfacePlan;
  const effective = effectivePlan ? planText(effectivePlan) : 'pending';
  const provider = modelProviders.find((item) => item.id === active.modelProvider);
  const selectedModel = active.generationModel
    ?? provider?.defaults?.generationModel
    ?? provider?.model
    ?? 'server default';
  const selectedUtility = active.utilityModel
    ?? provider?.defaults?.utilityModel
    ?? provider?.utilityModel
    ?? 'server default';
  return [
    ['provider', 'Model provider', provider ? `${provider.name} · ${selectedModel}` : 'server default', provider ? 'neutral' : 'pending'],
    ['utility', 'Utility model', selectedUtility, provider ? 'neutral' : 'pending'],
    ['broker', 'Agent broker', broker, active.agentBroker ? currentAgentPolicySummary ? 'good' : 'neutral' : 'pending'],
    ['requested', 'Requested surface config', active.agentBroker ? 'brokered from prompt' : planText(requested), 'neutral'],
    ['effective', 'Effective safety plan', effective, effectivePlan ? 'good' : 'pending'],
    ['grants', 'Allowed host tools', `${toolCount}: ${hostTools}`, toolCount ? 'neutral' : 'pending'],
    ['components', 'Trusted components', `${componentCount}: ${components}`, componentCount ? 'good' : 'pending'],
    ['runtime', 'Runtime', `${contract?.surface.mode ?? active.mode} · scripts ${contract?.surface.scriptPolicy ?? active.scriptPolicy}`, (contract?.surface.scriptPolicy ?? active.scriptPolicy) === 'allow' ? 'warn' : 'neutral'],
    ['validation', 'Validation', validation, validation !== 'pending' && !validation.startsWith('0/') ? 'warn' : validation === 'pending' ? 'pending' : 'good'],
    ['stream', 'Stream diagnostics', stream, stream.startsWith('complete') ? 'good' : stream === 'pending' ? 'pending' : 'warn'],
    ['repair', 'Validation retry', active.repair?.enabled ? (currentRepairSummary ?? 'on') : 'off', active.repair?.enabled ? 'warn' : 'pending'],
    ['tokens', 'Tokens', active.tokenOverrides ? 'override' : 'base', active.tokenOverrides ? 'good' : 'pending'],
    ['shape', 'Shape', currentShape ?? 'pending', currentShape ? 'neutral' : 'pending'],
  ].map(([key, label, value, tone]) => ({ key, label, value, tone })) as Array<{
    key: string;
    label: string;
    value: string;
    tone: string;
  }>;
}

function numberOptions(presets: number[] | undefined, selected: number): number[] {
  return Array.from(new Set([...(presets ?? []), selected]))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
}

function formatApprovalDetails(details: unknown): string {
  if (details === undefined || details === null) return '';
  if (typeof details === 'string') return details;
  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
}

function ChildSurface({
  child,
  onClose,
}: {
  child: ChildSurfaceModel;
  onClose: () => void;
}) {
  const surfaceRef = useRef<SummonSurfaceHandle>(null);
  const [status, setStatus] = useState('streaming');
  const registry = useMemo(
    () => createScopedDemoRegistry({
      modelProvider: () => child.modelSelection.modelProvider ?? null,
      modelSelection: () => child.modelSelection,
      onError: (message) => setStatus(`error: ${message.slice(0, 40)}`),
    }, childCapabilityNames),
    [child.modelSelection],
  );
  const contract = useMemo(() => registry.toContract(), [registry]);

  useEffect(() => {
    const abort = new AbortController();
    const acc = new SectionAccumulator();
    async function runChild() {
      try {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: child.prompt,
            ...(child.directionId ? { directionId: child.directionId } : { directionId: '' }),
            ...child.modelSelection,
            mode: 'interactive',
            capabilities: contract.pack,
            ...(child.agentBroker ? { agent: { enabled: true } } : {}),
          }),
          signal: abort.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (!response.body) throw new Error('no response body');
        await consumeSurfaceStream(response.body, {
          mode: 'interactive',
          accumulator: acc,
          onMeta: (line) => {
            if (line.path === '/status') setStatus(String(line.value));
          },
          onRenderHtml: (html) => surfaceRef.current?.render(html),
          onNodePatch: (patch) => surfaceRef.current?.patchNode(patch),
        });
        setStatus('done');
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        const message = err instanceof Error ? err.message : String(err);
        setStatus(`error: ${message.slice(0, 60)}`);
      }
    }
    void runChild();
    return () => abort.abort();
  }, [child, contract.pack]);

  return (
    <section className="child-pane">
      <header>
        <span className="child-title">{child.title ?? 'Summoned'}</span>
        <span className="child-prompt" title={child.prompt}>{child.prompt}</span>
        <span className="child-status">{status}</span>
        <button type="button" className="child-close" aria-label="Close summoned UI" onClick={onClose}>x</button>
      </header>
      <SummonSurface
        ref={surfaceRef}
        title={`Summoned: ${child.title ?? child.prompt.slice(0, 40)}`}
        html=""
        tokensSource={child.tokensSource}
        capabilityRegistry={registry}
        grantedCapabilities={contract.validationCapabilities}
      />
    </section>
  );
}
