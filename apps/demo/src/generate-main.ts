import {
  consumeSurfaceStream,
  createComponentIslandRegistry,
  spawnSandbox,
  type ComponentIslandRegistry,
  type SandboxHandle,
  type SurfaceStreamContext,
  type SurfaceStreamResult,
} from '@anarchitecture/summon/browser';
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
  type SurfacePlan,
  type ValidationCapability,
  type ValidationComponent,
} from '@anarchitecture/summon/engine';
import {
  PolicyEngine,
  type SurfacePolicy,
} from '@anarchitecture/summon';
import { createEventStore, type DevtoolsEvent } from '@anarchitecture/summon/devtools';
import bootstrapSource from '@anarchitecture/summon/bootstrap.js?raw';
import defaultTokensSource from '@anarchitecture/summon/tokens.css?raw';
import {
  createGhostShowcaseScenario,
  createScopedDemoRegistry,
  narrowCapabilityPack,
  SHOWCASE_SCENARIOS,
  type ActiveContract,
  type Mode,
  type ShowcaseScenario,
} from './showcase.js';
import {
  baseDemoComponentPack,
  createDemoComponentRegistry,
  narrowComponentPack,
} from './components.js';

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
  missingEnv?: string;
}

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

const iframe = document.getElementById('sandbox') as HTMLIFrameElement;
const form = document.getElementById('form') as HTMLFormElement;
const promptEl = document.getElementById('prompt') as HTMLTextAreaElement;
const scenarioSel = document.getElementById('scenario') as HTMLSelectElement;
const scenarioCountEl = document.getElementById('scenario-count')!;
const scenarioListEl = document.getElementById('scenario-list')!;
const scenarioActiveCategoryEl = document.getElementById('scenario-active-category')!;
const scenarioActiveTitleEl = document.getElementById('scenario-active-title')!;
const scenarioActiveDescEl = document.getElementById('scenario-active-desc')!;
const scenarioActiveFingerprintEl = document.getElementById('scenario-active-fingerprint')!;
const scenarioActiveGrantsEl = document.getElementById('scenario-active-grants')!;
const modelProviderSel = document.getElementById('model-provider') as HTMLSelectElement;
const directionSel = document.getElementById('direction') as HTMLSelectElement;
const ghostTargetEl = document.getElementById('ghost-target') as HTMLInputElement;
const ghostBaseDirectionSel = document.getElementById('ghost-base-direction') as HTMLSelectElement;
const layoutSel = document.getElementById('layout') as HTMLSelectElement;
const scriptPolicySel = document.getElementById('script-policy') as HTMLSelectElement;
const tokenPresetSel = document.getElementById('token-preset') as HTMLSelectElement;
const repairEnabledEl = document.getElementById('repair-enabled') as HTMLInputElement;
const customContractEnabledEl = document.getElementById('custom-contract-enabled') as HTMLInputElement;
const customContractPanelEl = document.getElementById('custom-contract-panel')!;
const surfacePurposeSel = document.getElementById('surface-purpose') as HTMLSelectElement;
const surfaceRuntimeSel = document.getElementById('surface-runtime') as HTMLSelectElement;
const surfaceDataSel = document.getElementById('surface-data') as HTMLSelectElement;
const surfaceAuthoritySel = document.getElementById('surface-authority') as HTMLSelectElement;
const surfacePersistenceSel = document.getElementById('surface-persistence') as HTMLSelectElement;
const goBtn = document.getElementById('go') as HTMLButtonElement;
const rerunBtn = document.getElementById('rerun') as HTMLButtonElement;
const openHistoryBtn = document.getElementById('open-history') as HTMLButtonElement;
const resultToolbarEl = document.getElementById('result-toolbar')!;
const resultSummaryEl = document.getElementById('result-summary')!;
const editCardEl = document.getElementById('edit-card')!;
const editTargetsEl = document.getElementById('edit-targets') as HTMLInputElement;
const editPromptEl = document.getElementById('edit-prompt') as HTMLTextAreaElement;
const editGoBtn = document.getElementById('edit-go') as HTMLButtonElement;
const log = document.getElementById('log')!;
const statusEl = document.getElementById('iframe-status')!;
const streamTailEl = document.getElementById('stream-tail')!;
const welcomeEl = document.getElementById('welcome')!;
const welcomeTextEl = document.getElementById('welcome-text')!;
const contractSummaryEl = document.getElementById('contract-summary')!;
const inspectorStatusEl = document.getElementById('inspector-status')!;
const devtoolsLog = document.getElementById('devtools-log')!;
const devtoolsTally = document.getElementById('devtools-tally')!;
const childrenContainer = document.getElementById('children')!;
const savedCountEl = document.getElementById('saved-count')!;
const savedListEl = document.getElementById('saved-list')!;
const diagnosticsTabs = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-diagnostics-tab]'));
const diagnosticsPanels = Array.from(document.querySelectorAll<HTMLElement>('[data-diagnostics-panel]'));

// Single store covers the whole page session: sandbox lifecycle, intent flow,
// state pushes, protocol parsing. Cleared at the top of every generate() run
// so each prompt's trace is self-contained.
const events = createEventStore({ bufferSize: 800 });
const savedSurfacesKey = 'summon.savedSurfaces.v1';
const maxSavedSurfaces = 8;
const demoSurfaceCeiling: SurfaceCeiling = {
  runtimes: ['static', 'declarative', 'scripted', 'worker'],
  data: ['embedded', 'host-resource', 'worker'],
  authorities: ['none', 'read', 'host-action', 'approval-gated'],
  persistences: ['replayable'],
};

function readMode(): Mode {
  const checked = document.querySelector<HTMLInputElement>('input[name=mode]:checked');
  return (checked?.value as Mode) ?? 'static';
}
function readModelProviderId(): string | null {
  return modelProviderSel.value || defaultModelProviderId;
}
function readLayout(): SummonLayout | null {
  const layout = layoutPresets.get(layoutSel.value);
  return layout ? { id: layout.id, slots: layout.slots.map((slot) => ({ ...slot })) } : null;
}
function setMode(m: Mode) {
  const radio = document.querySelector<HTMLInputElement>(`input[name=mode][value="${m}"]`);
  if (radio) radio.checked = true;
  currentMode = m;
}
function showWelcome() { welcomeEl.classList.remove('hidden'); }
function hideWelcome() { welcomeEl.classList.add('hidden'); }

function logLine(cls: string, text: string) {
  const el = document.createElement('div');
  el.className = cls;
  el.textContent = text;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
}

let directions: DirectionInfo[] = [];
let ghostRoots: GhostRootInfo[] = [];
let modelProviders: ModelProviderInfo[] = [];
let defaultModelProviderId: string | null = null;
let showcaseScenarios: ShowcaseScenario[] = [...SHOWCASE_SCENARIOS];
let currentEffectiveSurfacePlan: SurfacePlan | null = null;
let currentShape: string | null = null;
let currentValidationSummary: string | null = null;
let currentRepairSummary: string | null = null;
let currentStreamHealth: string | null = null;
const acc = new SectionAccumulator();
let handle: SandboxHandle | null = null;
let policy: PolicyEngine | null = null;
let currentDirectionId: string | null = null;
let currentMode: Mode = 'static';
let abortController: AbortController | null = null;
let currentStatus = 'idle';
let currentBytes = 0;
let activeTokensSourceOverride: string | null = null;
let artifactRevision = 0;
let currentGrantedCapabilities: ValidationCapability[] | undefined;
let currentGrantedComponents: ValidationComponent[] | undefined;
let componentIslands: ComponentIslandRegistry | null = null;

/**
 * Lifetime cookie for summoned siblings. Each summon spawns its own iframe,
 * PolicyEngine, and AbortController; we remember enough to tear them down on
 * a fresh top-level generate() (and via the per-card close button).
 *
 * `summonedCount` is mirrored into the parent's policy state so a generated
 * UI can bind to it ("Opened 2 sub-views"). Reset whenever we dispose all.
 */
interface ChildHandle {
  pane: HTMLElement;
  dispose: () => void;
}
const children = new Set<ChildHandle>();
let summonedCount = 0;

// Capability pack is owned by apps/demo/src/capabilities.ts. Different host
// apps would import their own registry. The engine and server stay intent-agnostic.
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

interface ScenarioPresentation {
  category: string;
  description: string;
}

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

function describeScenario(scenario: ShowcaseScenario): ScenarioPresentation {
  if (scenario.id.startsWith('ghost-')) {
    return {
      category: 'Ghost',
      description: 'Environment-specific Ghost memory root with host-allowed controls.',
    };
  }
  switch (scenario.id) {
    case 'host-resource-search':
      return {
        category: 'Host data',
        description: 'Host-owned data resource with explicit read authority.',
      };
    case 'host-ai-brainstorm':
      return {
        category: 'Host data',
        description: 'Host-owned AI resource with loading, error, and response states.',
      };
    case 'github-profile-lookup':
      return {
        category: 'Host data',
        description: 'Host-owned external lookup with proxied image data and read authority.',
      };
    case 'static-summary':
      return {
        category: 'Read-only',
        description: 'Static generated UI with embedded data and no host actions.',
      };
    case 'declarative-form':
      return {
        category: 'Host action',
        description: 'Declarative form controls routed through host-owned submit.',
      };
    case 'worker-analysis':
      return {
        category: 'Worker',
        description: 'Background worker data plus host-action authority.',
      };
    case 'approval-publish':
      return {
        category: 'Approval',
        description: 'Publish workflow guarded by an approval-gated host action.',
      };
    case 'scripted-interactive':
      return {
        category: 'Runtime',
        description: 'Scripted runtime allowed by explicit script policy.',
      };
    case 'token-override':
      return {
        category: 'Tokens',
        description: 'Token override request that repaints through host CSS.',
      };
    case 'layout-card':
      return {
        category: 'Layout',
        description: 'Host layout slots constrain the generated card shape.',
      };
    case 'sibling-summon':
      return {
        category: 'Composition',
        description: 'Parent surface can summon a sibling sandbox with narrowed host tools.',
      };
    case 'repair-diagnostics':
      return {
        category: 'Diagnostics',
        description: 'Validation retry generation with diagnostics.',
      };
    default:
      return {
        category: 'Showcase',
        description: 'Surface-configured Summon generation scenario.',
      };
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

function paintStatus() {
  const text = currentBytes
    ? `${currentStatus} · ${currentBytes.toLocaleString()} B`
    : currentStatus;
  statusEl.textContent = text;
  streamTailEl.textContent = text;
  updateEditControls();
}

function updateResultToolbar() {
  const hasArtifact = acc.hasAnySection();
  resultToolbarEl.hidden = !hasArtifact;
  editCardEl.hidden = !hasArtifact;
  resultSummaryEl.textContent = hasArtifact
    ? `${currentStatus} · ${compactPlanText(currentEffectiveSurfacePlan ?? readSurfacePlan())}`
    : 'Awaiting run';
}

function updateEditControls() {
  const hasArtifact = acc.hasAnySection();
  updateResultToolbar();
  editGoBtn.disabled =
    !hasArtifact ||
    !editPromptEl.value.trim() ||
    currentStatus === 'streaming' ||
    currentStatus === 'thinking' ||
    currentStatus === 'writing' ||
    currentStatus === 'editing';
}

function readEditTargets(): string[] | undefined {
  const targets = editTargetsEl.value
    .split(/[,\s]+/)
    .map((target) => target.trim())
    .filter(Boolean);
  return targets.length > 0 ? Array.from(new Set(targets)) : undefined;
}

function populateSelect<T extends string>(select: HTMLSelectElement, values: T[]) {
  select.innerHTML = '';
  for (const value of values) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = value;
    select.append(opt);
  }
}

function populateSurfaceControls() {
  populateSelect(surfacePurposeSel, [...SURFACE_PURPOSE_VALUES]);
  populateSelect(surfaceRuntimeSel, [...SURFACE_RUNTIME_VALUES]);
  populateSelect(surfaceDataSel, [...SURFACE_DATA_VALUES]);
  populateSelect(surfaceAuthoritySel, [...SURFACE_AUTHORITY_VALUES]);
  populateSelect(surfacePersistenceSel, [...SURFACE_PERSISTENCE_VALUES]);
}

function populateScenarioSelect() {
  showcaseScenarios = [
    ...SHOWCASE_SCENARIOS,
    ...ghostRoots.map((root) => createGhostShowcaseScenario(root.id)),
  ];
  scenarioSel.innerHTML = '';
  for (const scenario of showcaseScenarios) {
    const opt = document.createElement('option');
    opt.value = scenario.id;
    opt.textContent = scenario.label;
    scenarioSel.append(opt);
  }
  scenarioCountEl.textContent = String(showcaseScenarios.length);
  renderScenarioLibrary();
}

function selectedScenario(): ShowcaseScenario {
  return showcaseScenarios.find((scenario) => scenario.id === scenarioSel.value) ?? showcaseScenarios[0]!;
}

function renderScenarioLibrary() {
  scenarioListEl.innerHTML = '';
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

  for (const category of orderedCategories) {
    const group = document.createElement('section');
    group.className = 'scenario-group';
    const heading = document.createElement('h3');
    heading.textContent = category;
    group.append(heading);
    for (const scenario of grouped.get(category) ?? []) {
      const presentation = describeScenario(scenario);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'scenario-card';
      card.dataset.scenarioId = scenario.id;
      card.setAttribute('aria-pressed', scenario.id === scenarioSel.value ? 'true' : 'false');
      const title = document.createElement('span');
      title.className = 'scenario-card-title';
      title.textContent = scenario.label;
      const desc = document.createElement('span');
      desc.className = 'scenario-card-desc';
      desc.textContent = presentation.description;
      const meta = document.createElement('span');
      meta.className = 'scenario-card-meta';
      meta.textContent = `${compactPlanText(scenario.surfacePlan)} · ${scenario.capabilityNames.length} host tools`;
      card.append(title, desc, meta);
      card.addEventListener('click', () => selectScenario(scenario.id));
      group.append(card);
    }
    scenarioListEl.append(group);
  }
  updateSelectedScenarioCard();
}

function updateSelectedScenarioCard() {
  for (const card of scenarioListEl.querySelectorAll<HTMLButtonElement>('.scenario-card')) {
    const active = card.dataset.scenarioId === scenarioSel.value;
    card.classList.toggle('active', active);
    card.setAttribute('aria-pressed', active ? 'true' : 'false');
  }
}

function updateScenarioPresentation(scenario: ShowcaseScenario) {
  const presentation = describeScenario(scenario);
  scenarioActiveCategoryEl.textContent = presentation.category;
  scenarioActiveTitleEl.textContent = scenario.label;
  scenarioActiveDescEl.textContent = presentation.description;
  scenarioActiveFingerprintEl.textContent = compactPlanText(scenario.surfacePlan);
  const componentCount = scenario.componentNames?.length ?? 0;
  scenarioActiveGrantsEl.textContent =
    `${scenario.capabilityNames.length} host tools${componentCount ? ` · ${componentCount} trusted components` : ''}`;
  welcomeTextEl.textContent = `${scenario.label} awaits generated UI.`;
  updateSelectedScenarioCard();
}

function selectScenario(id: string) {
  scenarioSel.value = id;
  applyScenario(selectedScenario());
  logLine('op-meta', `scenario → ${selectedScenario().label}`);
}

function setSurfaceControls(plan: SurfacePlan) {
  surfacePurposeSel.value = plan.purpose;
  surfaceRuntimeSel.value = plan.runtime;
  surfaceDataSel.value = plan.data;
  surfaceAuthoritySel.value = plan.authority;
  surfacePersistenceSel.value = plan.persistence;
  syncScriptPolicyControl(plan);
}

function syncScriptPolicyControl(plan: SurfacePlan = readSurfacePlan()) {
  scriptPolicySel.value = deriveSurfacePlanControls(plan).scriptPolicy;
}

function readSurfacePlan(): SurfacePlan {
  return {
    purpose: surfacePurposeSel.value as SurfacePlan['purpose'],
    runtime: surfaceRuntimeSel.value as SurfacePlan['runtime'],
    data: surfaceDataSel.value as SurfacePlan['data'],
    authority: surfaceAuthoritySel.value as SurfacePlan['authority'],
    persistence: surfacePersistenceSel.value as SurfacePlan['persistence'],
  };
}

function readTokenOverrides(): Record<string, string> | undefined {
  if (tokenPresetSel.value !== 'accent-blue') return undefined;
  return {
    'color-accent': '#0f8cff',
    'color-accent-fg': '#ffffff',
  };
}

function readRepairOptions(): ActiveContract['repair'] {
  if (!repairEnabledEl.checked) return undefined;
  return selectedScenario().repair ?? { enabled: true, maxAttempts: 1, maxTargets: 2 };
}

function readActiveContract(): ActiveContract {
  const scenario = selectedScenario();
  const surfacePlan = readSurfacePlan();
  return {
    scenarioId: scenario.id,
    prompt: promptEl.value.trim() || scenario.prompt,
    mode: readMode(),
    capabilityNames: scenario.capabilityNames,
    componentNames: scenario.componentNames,
    ...(customContractEnabledEl.checked ? {} : { surfacePolicy: scenario.surfacePolicy }),
    surfacePlan,
    scriptPolicy: deriveSurfacePlanControls(surfacePlan).scriptPolicy,
    ...(layoutSel.value ? { layoutId: layoutSel.value } : {}),
    ...(readTokenOverrides() ? { tokenOverrides: readTokenOverrides() } : {}),
    ...(readRepairOptions() ? { repair: readRepairOptions() } : {}),
    directionId: currentDirectionId,
    modelProvider: readModelProviderId(),
  };
}

function capabilityPackFor(active: ActiveContract): CapabilityPack {
  return narrowCapabilityPack(baseCapabilityPack, active.capabilityNames);
}

function componentPackFor(active: ActiveContract): ComponentPack | null {
  return active.componentNames?.length
    ? narrowComponentPack(baseComponentPack, active.componentNames)
    : null;
}

function applyScenario(scenario: ShowcaseScenario) {
  promptEl.value = scenario.prompt;
  setMode(scenario.mode);
  setSurfaceControls(scenario.surfacePlan);
  scriptPolicySel.value = scenario.scriptPolicy ?? deriveSurfacePlanControls(scenario.surfacePlan).scriptPolicy;
  layoutSel.value = scenario.layoutId ?? '';
  tokenPresetSel.value = scenario.tokenOverrides ? 'accent-blue' : '';
  repairEnabledEl.checked = Boolean(scenario.repair?.enabled);
  const fallbackDirectionId = directions[0]?.id ?? '';
  const desiredDirectionId = scenario.directionId ?? fallbackDirectionId;
  if (hasDirectionOption(desiredDirectionId)) {
    directionSel.value = desiredDirectionId;
  } else if (!scenario.directionId && hasDirectionOption(fallbackDirectionId)) {
    directionSel.value = fallbackDirectionId;
  }
  currentDirectionId = directionSel.value || null;
  updateGhostControls();
  activeTokensSourceOverride = null;
  currentEffectiveSurfacePlan = null;
  currentShape = null;
  currentValidationSummary = null;
  currentRepairSummary = null;
  currentStreamHealth = null;
  respawn(currentDirectionId, currentMode);
  showWelcome();
  updateEditControls();
  updateScenarioPresentation(scenario);
  renderContractSummary();
}

function hasDirectionOption(value: string): boolean {
  return Array.from(directionSel.options).some((opt) => opt.value === value);
}

function planText(plan: { purpose: string; runtime: string; data: string; authority: string; persistence: string }): string {
  return [
    displayPlanPart(plan.purpose),
    displayPlanPart(plan.runtime),
    displayPlanPart(plan.data),
    displayPlanPart(plan.authority),
    displayPlanPart(plan.persistence),
  ].join(' · ');
}

function renderContractSummary() {
  const active = readActiveContract();
  const requested = active.surfacePlan;
  const hostTools = active.capabilityNames.length ? active.capabilityNames.join(', ') : 'none';
  const components = active.componentNames?.length ? active.componentNames.join(', ') : 'none';
  const validation = currentValidationSummary ?? 'pending';
  const stream = currentStreamHealth ?? 'pending';
  const effective = currentEffectiveSurfacePlan ? planText(currentEffectiveSurfacePlan) : 'pending';
  const provider = modelProviders.find((item) => item.id === active.modelProvider);
  inspectorStatusEl.textContent = currentEffectiveSurfacePlan ? 'effective' : 'pending';
  contractSummaryEl.innerHTML = '';
  const rows = [
    ['provider', 'Model provider', provider ? `${provider.name} · ${provider.model}` : 'server default', provider ? 'neutral' : 'pending'],
    ['requested', 'Requested surface config', planText(requested), 'neutral'],
    ['effective', 'Effective safety plan', effective, currentEffectiveSurfacePlan ? 'good' : 'pending'],
    ['grants', 'Allowed host tools', `${active.capabilityNames.length}: ${hostTools}`, active.capabilityNames.length ? 'neutral' : 'pending'],
    ['components', 'Trusted components', `${active.componentNames?.length ?? 0}: ${components}`, active.componentNames?.length ? 'good' : 'pending'],
    ['runtime', 'Runtime', `${active.mode} · scripts ${active.scriptPolicy}`, active.scriptPolicy === 'allow' ? 'warn' : 'neutral'],
    ['validation', 'Validation', validation, validation !== 'pending' && !validation.startsWith('0/') ? 'warn' : validation === 'pending' ? 'pending' : 'good'],
    ['stream', 'Stream diagnostics', stream, stream.startsWith('complete') ? 'good' : stream === 'pending' ? 'pending' : 'warn'],
    ['repair', 'Validation retry', active.repair?.enabled ? (currentRepairSummary ?? 'on') : 'off', active.repair?.enabled ? 'warn' : 'pending'],
    ['tokens', 'Tokens', active.tokenOverrides ? 'override' : 'base', active.tokenOverrides ? 'good' : 'pending'],
    ['shape', 'Shape', currentShape ?? 'pending', currentShape ? 'neutral' : 'pending'],
  ] as const;
  for (const [key, label, value, tone] of rows) {
    const row = document.createElement('div');
    row.className = `contract-row ${tone}`;
    row.dataset.contractRow = key;
    row.title = value;
    const name = document.createElement('span');
    name.className = 'contract-row-label';
    name.textContent = label;
    const detail = document.createElement('strong');
    detail.className = 'contract-row-value';
    detail.textContent = value;
    row.append(name, detail);
    contractSummaryEl.append(row);
  }
  updateResultToolbar();
}

function clearEffectiveContractSummary() {
  currentEffectiveSurfacePlan = null;
  currentShape = null;
  currentValidationSummary = null;
  currentRepairSummary = null;
  currentStreamHealth = null;
  renderContractSummary();
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

async function loadDirections(): Promise<void> {
  try {
    const res = await fetch('/api/model-providers');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = (await res.json()) as { defaultProvider?: unknown; providers?: unknown };
    defaultModelProviderId = typeof payload.defaultProvider === 'string' ? payload.defaultProvider : null;
    modelProviders = Array.isArray(payload.providers)
      ? payload.providers.flatMap((provider): ModelProviderInfo[] => {
          if (!provider || typeof provider !== 'object') return [];
          const item = provider as Record<string, unknown>;
          if (
            typeof item.id !== 'string' ||
            typeof item.name !== 'string' ||
            typeof item.model !== 'string' ||
            typeof item.utilityModel !== 'string'
          ) {
            return [];
          }
          return [{
            id: item.id,
            name: item.name,
            configured: item.configured === true,
            model: item.model,
            utilityModel: item.utilityModel,
            missingEnv: typeof item.missingEnv === 'string' ? item.missingEnv : undefined,
          }];
        })
      : [];
  } catch {
    modelProviders = [];
    defaultModelProviderId = null;
  }

  try {
    const res = await fetch('/api/directions');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    directions = (await res.json()) as DirectionInfo[];
  } catch {
    directions = [];
  }
  try {
    const res = await fetch('/api/ghost-roots');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    ghostRoots = (await res.json()) as GhostRootInfo[];
  } catch {
    ghostRoots = [];
  }
  populateModelProviderSelect();
  ghostBaseDirectionSel.innerHTML = '';
  for (const d of directions) {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = d.name;
    opt.title = d.description;
    ghostBaseDirectionSel.appendChild(opt);
  }
  const fallbackBase = defaultGhostBaseDirectionId();
  if (fallbackBase) {
    ghostBaseDirectionSel.value = fallbackBase;
  }
  directionSel.innerHTML = '';
  if (directions.length === 0 && ghostRoots.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Default (no direction)';
    directionSel.appendChild(opt);
  } else {
    for (const d of directions) {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.name;
      opt.title = d.description;
      directionSel.appendChild(opt);
    }
    if (ghostRoots.length > 0) {
      const group = document.createElement('optgroup');
      group.label = 'Ghost steering';
      for (const root of ghostRoots) {
        const opt = document.createElement('option');
        opt.value = ghostSelectionValue(root.id);
        opt.textContent = `Ghost · ${root.id}`;
        opt.title = `Generate from Ghost memory root "${root.id}"`;
        group.appendChild(opt);
      }
      directionSel.appendChild(group);
    }
  }
  currentDirectionId = directionSel.value || null;
  updateGhostControls();
}

function populateModelProviderSelect() {
  modelProviderSel.innerHTML = '';
  if (modelProviders.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Server default';
    modelProviderSel.appendChild(opt);
    modelProviderSel.disabled = true;
    return;
  }

  modelProviderSel.disabled = false;
  for (const provider of modelProviders) {
    const opt = document.createElement('option');
    opt.value = provider.id;
    opt.textContent = provider.configured
      ? `${provider.name}`
      : `${provider.name} (missing key)`;
    opt.title = provider.configured
      ? `${provider.model} for generation; ${provider.utilityModel} for utility calls`
      : `Set ${provider.missingEnv ?? 'the provider API key'}`;
    opt.disabled = !provider.configured;
    modelProviderSel.appendChild(opt);
  }

  const defaultProvider = defaultModelProviderId
    ? modelProviders.find((provider) => provider.id === defaultModelProviderId && provider.configured)
    : null;
  const firstConfigured = modelProviders.find((provider) => provider.configured);
  modelProviderSel.value = defaultProvider?.id ?? firstConfigured?.id ?? '';
}

function ghostSelectionValue(rootId: string): string {
  return `ghost:${rootId}`;
}

function ghostRootFromSelection(selection: string | null): string | null {
  return selection?.startsWith('ghost:') ? selection.slice('ghost:'.length) : null;
}

function defaultGhostBaseDirectionId(): string | null {
  return directions.find((x) => x.id === 'ghost')?.id ?? directions[0]?.id ?? null;
}

function readGhostBaseDirectionId(): string | null {
  return ghostBaseDirectionSel.value || defaultGhostBaseDirectionId();
}

function readGhostTargetPath(): string {
  const value = ghostTargetEl.value.trim();
  return value || '.';
}

function updateGhostControls() {
  const enabled = Boolean(ghostRootFromSelection(currentDirectionId));
  ghostTargetEl.disabled = !enabled;
  ghostBaseDirectionSel.disabled = !enabled || directions.length === 0;
  tokenPresetSel.disabled = enabled;
  if (enabled) tokenPresetSel.value = '';
  if (enabled && !ghostTargetEl.value.trim()) ghostTargetEl.value = '.';
}

function setCustomContractEnabled(enabled: boolean) {
  customContractEnabledEl.checked = enabled;
  customContractPanelEl.hidden = !enabled;
  document.body.classList.toggle('custom-contract-on', enabled);
  if (!enabled && showcaseScenarios.length > 0) {
    setSurfaceControls(selectedScenario().surfacePlan);
  }
  clearEffectiveContractSummary();
}

function selectDiagnosticsTab(name: string) {
  for (const button of diagnosticsTabs) {
    const active = button.dataset.diagnosticsTab === name;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  }
  for (const panel of diagnosticsPanels) {
    const active = panel.dataset.diagnosticsPanel === name;
    panel.hidden = !active;
    panel.classList.toggle('active', active);
  }
}

function tokensFor(directionId: string | null): string {
  if (!directionId) return defaultTokensSource;
  if (ghostRootFromSelection(directionId)) {
    const baseDirectionId = readGhostBaseDirectionId();
    return directions.find((x) => x.id === baseDirectionId)?.tokensCss ?? defaultTokensSource;
  }
  return directions.find((x) => x.id === directionId)?.tokensCss ?? defaultTokensSource;
}

/**
 * Respawn the sandbox with the right tokens and the right host tool policy for
 * the current mode. Interactive mode binds a fresh PolicyEngine with the 3
 * canned handlers; static mode has no host tools.
 */
function respawn(
  directionId: string | null,
  mode: Mode,
  active: ActiveContract = readActiveContract(),
  initialHtml = '',
): SandboxHandle {
  if (componentIslands) {
    componentIslands.destroy();
    componentIslands = null;
  }
  if (handle) {
    handle.dispose();
    handle = null;
  }

  let grantedCapabilities: ValidationCapability[] | undefined;
  let grantedComponents: ValidationComponent[] | undefined;
  const componentRegistry = active.componentNames?.length
    ? createDemoComponentRegistry(active.componentNames)
    : null;
  const componentContract = componentRegistry?.toContract();
  grantedComponents = componentContract?.validationComponents;
  if (componentRegistry) {
    componentIslands = createComponentIslandRegistry({
      outerIframe: iframe,
      registry: componentRegistry,
      events,
      onError: (error) => {
        logLine('op-error', `component ${error.componentName ?? error.componentId ?? '?'}: ${error.reason}`);
      },
    });
  }

  if (mode === 'interactive') {
    const registry = createScopedDemoRegistry({
      modelProvider: readModelProviderId,
      onLog: (m) => logLine('op-add', m),
      onError: (m) => logLine('op-error', m),
      // summon needs DOM access (spawns a sibling iframe) and the streaming
      // pipeline, so this page supplies the handler while the registry owns
      // its prompt contract and schema validation.
      onSummon: ({ args, push }) => {
        push({ summonError: null });
        summonChild(args.prompt, args.title || undefined);
        summonedCount += 1;
        push({ summonedCount, lastSummoned: args.prompt });
      },
    }, active.capabilityNames);
    const contract = registry.toContract();
    grantedCapabilities = contract.validationCapabilities;
    policy = new PolicyEngine({
      initialState: {
        ...contract.initialState,
        summonedCount: 0,
        lastSummoned: null,
        summonError: null,
      },
      handlers: registry.toPolicyHandlers(),
      onStateChange: (state) => {
        if (handle) handle.pushState(state);
      },
      onHandlerError: (intent, err) => {
        logLine('op-error', `host handler error (${intent}): ${err.message}`);
      },
      events,
    });
  } else {
    policy = null;
  }
  currentGrantedCapabilities = grantedCapabilities;
  currentGrantedComponents = grantedComponents;

  handle = spawnSandbox({
    iframe,
    artifact: {
      intents: policy?.intents ?? [],
      capabilities: grantedCapabilities,
      components: grantedComponents,
      html: initialHtml,
      initialState: policy?.getState(),
    },
    // Read from the host-owned engine, not from the (LLM-influenced) artifact,
    // so a generated UI can never escalate beyond the policy's vocabulary.
    grantedIntents: policy?.intents ?? [],
    grantedCapabilities,
    bootstrapSource,
    tokensSource: activeTokensSourceOverride ?? tokensFor(directionId),
    onIntent: (intent, args) => {
      void policy?.dispatch(intent, args);
    },
    onIntentRejected: (reason) => {
      logLine('op-error', `rejected: ${reason}`);
    },
    onComponents: (components, sandboxId) => {
      componentIslands?.sync(components, {
        sandboxId,
        emitIntent: (intent, args = {}) => {
          void policy?.dispatch(intent, args);
        },
      });
    },
    events,
  });
  return handle;
}

directionSel.addEventListener('change', () => {
  currentDirectionId = directionSel.value || null;
  activeTokensSourceOverride = null;
  clearEffectiveContractSummary();
  acc.reset();
  artifactRevision = 0;
  updateGhostControls();
  renderContractSummary();
  respawn(currentDirectionId, currentMode);
  showWelcome();
  updateEditControls();
  logLine('op-meta', `direction → ${currentDirectionId ?? 'default'}`);
});

modelProviderSel.addEventListener('change', () => {
  clearEffectiveContractSummary();
  logLine('op-meta', `provider → ${readModelProviderId() ?? 'server default'}`);
});

ghostTargetEl.addEventListener('change', () => {
  const root = ghostRootFromSelection(currentDirectionId);
  if (!root) return;
  logLine('op-meta', `ghost target → ${readGhostTargetPath()}`);
});

ghostBaseDirectionSel.addEventListener('change', () => {
  activeTokensSourceOverride = null;
  clearEffectiveContractSummary();
  acc.reset();
  artifactRevision = 0;
  respawn(currentDirectionId, currentMode);
  showWelcome();
  updateEditControls();
  logLine('op-meta', `ghost base → ${readGhostBaseDirectionId() ?? 'none'}`);
});

layoutSel.addEventListener('change', () => {
  clearEffectiveContractSummary();
  logLine('op-meta', `layout → ${layoutSel.value || 'free'}`);
});

document.querySelectorAll<HTMLInputElement>('input[name=mode]').forEach((el) => {
  el.addEventListener('change', () => {
    currentMode = readMode();
    activeTokensSourceOverride = null;
    clearEffectiveContractSummary();
    acc.reset();
    artifactRevision = 0;
    respawn(currentDirectionId, currentMode);
    showWelcome();
    updateEditControls();
    logLine('op-meta', `mode → ${currentMode}`);
  });
});

scenarioSel.addEventListener('change', () => {
  selectScenario(scenarioSel.value);
});

scriptPolicySel.addEventListener('change', () => {
  syncScriptPolicyControl();
  clearEffectiveContractSummary();
});
tokenPresetSel.addEventListener('change', clearEffectiveContractSummary);
repairEnabledEl.addEventListener('change', clearEffectiveContractSummary);
customContractEnabledEl.addEventListener('change', () => {
  setCustomContractEnabled(customContractEnabledEl.checked);
  logLine('op-meta', `custom contract → ${customContractEnabledEl.checked ? 'on' : 'off'}`);
});
for (const select of [
  surfacePurposeSel,
  surfaceRuntimeSel,
  surfaceDataSel,
  surfaceAuthoritySel,
  surfacePersistenceSel,
]) {
  select.addEventListener('change', () => {
    syncScriptPolicyControl();
    clearEffectiveContractSummary();
  });
}

for (const button of diagnosticsTabs) {
  button.addEventListener('click', () => selectDiagnosticsTab(button.dataset.diagnosticsTab ?? 'stream'));
}

openHistoryBtn.addEventListener('click', () => selectDiagnosticsTab('history'));

rerunBtn.addEventListener('click', () => {
  const p = promptEl.value.trim();
  if (!p) return;
  void generate(p);
});

/**
 * Per-sandbox bag of state + UI hooks consumed by the streaming pipeline.
 * Both the parent (module-level) sandbox and each summoned child build a
 * target so the same pipeline can drive either.
 *
 * Getter-style fields (`getHandle`, `getAcc`, `getMode`) so the parent
 * target's `respawn()` can swap module-level handle/acc/mode mid-stream
 * without invalidating an already-captured target.
 */
interface SandboxTarget {
  getHandle: () => SandboxHandle | null;
  getAcc: () => SectionAccumulator;
  getMode: () => Mode;
  capabilities: CapabilityPack | null;
  components?: ComponentPack | null;
  /** Fires when the server emits `/mode-upgraded`. Parent respawns; children no-op. */
  onModeUpgrade?: () => void;
  onSurfacePlan?: (plan: SurfacePlan) => void;
  onShape?: (shape: string) => void;
  onTokenOverrides?: (applied: Array<{ token: string; value: string }>) => void;
  onValidationSummary?: (value: unknown) => void;
  onRepairSummary?: (value: unknown) => void;
  onStreamGraphSummary?: (value: unknown) => void;
  /** Fires when Ghost mode resolves a validated token CSS source. */
  onGhostTokenSource?: (css: string) => void;
  onLog: (cls: string, text: string) => void;
  onStatus: (status: string) => void;
  onBytes: (bytes: number) => void;
  getArtifactRevision?: () => number;
  onArtifactChanged?: () => void;
  /** When set, protocol lines and parse errors flow into the shared event store. */
  recordEvents?: boolean;
}

function applyLineTo(target: SandboxTarget, line: ProtocolLine, context: SurfaceStreamContext) {
  if (line.op === 'meta' && line.path === '/error') {
    target.onLog('op-error', `error: ${String(line.value)}`);
    return;
  }
  if (line.op === 'meta' && line.path === '/mode-upgraded') {
    // Parent: respawn into interactive so generated <script>s have working
    // intents. Child: ignore — children are spawned interactive already.
    target.onLog('op-meta', `mode auto-upgraded → interactive (heuristic match)`);
    target.onModeUpgrade?.();
    return;
  }
  if (line.op === 'meta' && line.path === '/surface-plan') {
    const plan = normalizeSurfacePlan(line.value);
    if (plan) {
      target.onSurfacePlan?.(plan);
      target.onLog(
        'op-meta',
        `surface → ${plan.purpose}/${plan.runtime}/${plan.data}/${plan.authority}/${plan.persistence}`,
      );
    } else {
      target.onLog('op-meta', `surface → invalid ${JSON.stringify(line.value)}`);
    }
    return;
  }
  if (line.op === 'meta' && line.path === '/shape') {
    const shape = typeof line.value === 'string' ? line.value : '';
    if (shape) target.onShape?.(shape);
    target.onLog('op-meta', `shape → ${shape || JSON.stringify(line.value)}`);
    return;
  }
  if (line.op === 'meta' && line.path === '/token-overrides') {
    const applied = parseAppliedTokenOverrides(line.value);
    target.onTokenOverrides?.(applied);
    const value = line.value as { rejected?: unknown } | undefined;
    const rejected = Array.isArray(value?.rejected) ? value.rejected.length : 0;
    target.onLog('op-meta', `token overrides → applied=${applied.length}; rejected=${rejected}`);
    return;
  }
  if (line.op === 'meta' && line.path === '/ghost-context') {
    const value = line.value as
      | {
        product?: unknown;
        source?: unknown;
        targetPath?: unknown;
        layers?: unknown;
        baseDirectionId?: unknown;
        styleSource?: unknown;
        }
      | undefined;
    const product = typeof value?.product === 'string' ? value.product : 'Ghost';
    const source = typeof value?.source === 'string' ? value.source : 'root';
    const targetPath = typeof value?.targetPath === 'string' ? value.targetPath : '.';
    const layers = Array.isArray(value?.layers)
      ? value.layers.filter((layer): layer is string => typeof layer === 'string')
      : [];
    const base = typeof value?.baseDirectionId === 'string' ? value.baseDirectionId : 'none';
    const style = typeof value?.styleSource === 'string' ? value.styleSource : 'unknown';
    target.onLog(
      'op-meta',
      `ghost context → ${product}; source=${source}; target=${targetPath}; layers=${layers.join(' › ') || '.'}; base=${base}; style=${style}`,
    );
    return;
  }
  if (line.op === 'meta' && line.path === '/ghost-token-source') {
    const value = line.value as
      | { kind?: unknown; source?: unknown; css?: unknown; warnings?: unknown; baseDirectionId?: unknown }
      | undefined;
    if (typeof value?.css === 'string') {
      target.onGhostTokenSource?.(value.css);
    }
    const source = typeof value?.source === 'string' ? value.source : 'unknown';
    const kind = typeof value?.kind === 'string' ? value.kind : 'unknown';
    const base = typeof value?.baseDirectionId === 'string' ? `; base=${value.baseDirectionId}` : '';
    const warnings = Array.isArray(value?.warnings)
      ? value.warnings.filter((w): w is string => typeof w === 'string')
      : [];
    target.onLog(
      'op-meta',
      `ghost tokens → ${kind} (${source})${base}${warnings.length ? `; ${warnings[0]}` : ''}`,
    );
    return;
  }
  if (line.op === 'meta' && line.path === '/ghost-review-packet') {
    const value = line.value as
      | {
          baseDirectionId?: unknown;
          styleSource?: unknown;
          declaredSections?: unknown;
          validation?: { blocked?: unknown; warnings?: unknown };
        }
      | undefined;
    const base = typeof value?.baseDirectionId === 'string' ? value.baseDirectionId : 'none';
    const style = typeof value?.styleSource === 'string' ? value.styleSource : 'unknown';
    const sections = Array.isArray(value?.declaredSections)
      ? value.declaredSections.filter((section): section is string => typeof section === 'string')
      : [];
    const blocked = typeof value?.validation?.blocked === 'number' ? value.validation.blocked : 0;
    const warnings = typeof value?.validation?.warnings === 'number' ? value.validation.warnings : 0;
    target.onLog(
      'op-meta',
      `ghost review packet → base=${base}; style=${style}; sections=${sections.join(', ') || 'none'}; validation=${blocked}/${warnings}`,
    );
    return;
  }
  if (line.op === 'meta' && line.path === '/validation-summary') {
    target.onValidationSummary?.(line.value);
    target.onLog('op-meta', `validation → ${JSON.stringify(line.value)}`);
    return;
  }
  if (line.op === 'meta' && line.path === '/repair-summary') {
    target.onRepairSummary?.(line.value);
    target.onLog('op-meta', `validation retry → ${JSON.stringify(line.value)}`);
    return;
  }
  if (line.op === 'meta' && line.path === '/stream-graph-summary') {
    target.onStreamGraphSummary?.(line.value);
    target.onLog('op-meta', `stream diagnostics → ${JSON.stringify(line.value)}`);
    return;
  }
  if (line.op === 'meta' && line.path === '/status') {
    target.onStatus(String(line.value));
    return;
  }
  if (line.op === 'meta' && line.path === '/thinking') {
    const text = typeof line.value === 'string' ? line.value : JSON.stringify(line.value);
    target.onLog('op-meta', `· ${text.slice(0, 160)}${text.length > 160 ? '…' : ''}`);
    return;
  }
  if (line.op === 'meta' && line.path === '/protocol-skip') {
    const value = line.value as
      | { code?: unknown; message?: unknown; path?: unknown; op?: unknown; rawPreview?: unknown }
      | undefined;
    const code = typeof value?.code === 'string' ? value.code : 'protocol';
    const message = typeof value?.message === 'string' ? value.message : 'line skipped';
    const path = typeof value?.path === 'string' ? ` at ${value.path}` : '';
    const op = typeof value?.op === 'string' ? `${value.op} ` : '';
    const raw = typeof value?.rawPreview === 'string' ? ` · ${value.rawPreview}` : '';
    target.onLog('op-meta', `skip ${op}${code}${path}: ${message}${raw}`);
    return;
  }
  if (line.op === 'meta' && line.path === '/screen-synthesized') {
    const value = line.value as { sections?: unknown; reason?: unknown } | undefined;
    const sections = Array.isArray(value?.sections)
      ? value.sections.filter((section): section is string => typeof section === 'string')
      : [];
    target.onLog('op-meta', `screen synthesized → ${sections.join(', ') || '(none)'}`);
    return;
  }
  if (line.op === 'meta') {
    target.onLog('op-meta', `meta ${line.path} = ${JSON.stringify(line.value)}`);
    return;
  }
  if (line.op === 'set') {
    const changed = context.applyResult?.changed ?? false;
    target.onLog('op-set', `set ${line.path} = ${JSON.stringify(line.value)}`);
    if (changed) target.onArtifactChanged?.();
    return;
  }
  if (line.op === 'add') {
    const changed = context.applyResult?.changed ?? false;
    const preview = (line.html ?? '').slice(0, 80).replace(/\s+/g, ' ');
    target.onLog(
      'op-add',
      `add ${line.path} (${(line.html ?? '').length} chars): ${preview}${(line.html ?? '').length > 80 ? '…' : ''}`
    );
    if (changed) target.onArtifactChanged?.();
  }
}

interface StreamOptions {
  prompt: string;
  modelProvider?: string | null;
  directionId: string | null;
  layout?: SummonLayout | null;
  scriptPolicy?: ScriptPolicy;
  surfacePolicy?: SurfacePolicy;
  surfacePlan?: SurfacePlan;
  tokenOverrides?: Record<string, string>;
  edit?: {
    baseRevision: number;
    sections: { id: string; html: string }[];
    targetSections?: string[];
  };
  repair?: {
    enabled?: boolean;
    maxAttempts?: number;
    maxTargets?: number;
  };
  signal: AbortSignal;
}

interface StreamResult extends SurfaceStreamResult {
  surfacePlan: SurfacePlan | null;
  shape: string | null;
}

/**
 * Streams `/api/generate` into a sandbox target — one fetch, one HTTP body
 * parsed line-by-line, dispatched through `applyLineTo`. Mode is read from
 * the target lazily so a `/mode-upgraded` mid-stream takes effect immediately.
 */
async function streamGenerationInto(target: SandboxTarget, opts: StreamOptions): Promise<StreamResult> {
  const ghostRootId = ghostRootFromSelection(opts.directionId);
  const ghostBaseDirectionId = readGhostBaseDirectionId();
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: opts.prompt,
      ...(opts.modelProvider ? { modelProvider: opts.modelProvider } : {}),
      ...(ghostRootId
        ? {
            ghost: {
              rootId: ghostRootId,
              targetPath: readGhostTargetPath(),
              ...(ghostBaseDirectionId ? { baseDirectionId: ghostBaseDirectionId } : {}),
            },
          }
        : { directionId: opts.directionId }),
      // Always send the pack as a ceiling — the server may auto-upgrade a
      // static-mode prompt that obviously asks for interactivity, and it
      // needs the pack to populate the capabilities block.
      mode: target.getMode(),
      capabilities: target.capabilities,
      ...(target.components ? { components: target.components } : {}),
      surfaceCeiling: demoSurfaceCeiling,
      ...(opts.scriptPolicy ? { scriptPolicy: opts.scriptPolicy } : {}),
      ...(opts.surfacePolicy ? { surfacePolicy: opts.surfacePolicy } : {}),
      ...(opts.surfacePlan ? { surfacePlan: opts.surfacePlan } : {}),
      ...(opts.tokenOverrides ? { tokenOverrides: opts.tokenOverrides } : {}),
      ...(opts.layout ? { layout: opts.layout } : {}),
      ...(opts.edit ? { edit: opts.edit } : {}),
      ...(opts.repair ? { repair: opts.repair } : {}),
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }

  const body = res.body;
  if (!body) throw new Error('no response body');
  const streamBody: ReadableStream<Uint8Array> = body;

  let surfacePlan: SurfacePlan | null = null;
  let shape: string | null = null;

  async function* chunksWithByteCounts(): AsyncGenerator<Uint8Array, void, void> {
    const reader = streamBody.getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) return;
        if (!value) continue;
        target.onBytes(value.byteLength);
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  }

  const pushGraphEvent = (context: SurfaceStreamContext) => {
    if (!target.recordEvents) return;
    const snap = context.graph.snapshot();
    events.push({
      kind: 'stream-graph',
      at: Date.now(),
      health: snap.health,
      sections: snap.sections.map(({ id, declared, present, revision, bytes }) => ({
        id,
        declared,
        present,
        revision,
        bytes,
      })),
    });
  };

  const result = await consumeSurfaceStream(chunksWithByteCounts(), {
    mode: () => target.getMode(),
    accumulator: target.getAcc(),
    shouldApplyLine: (line, context) => {
      if (
        opts.edit &&
        line.op !== 'meta' &&
        context.acceptedStructuralLines === 0 &&
        target.getArtifactRevision &&
        target.getArtifactRevision() !== opts.edit.baseRevision
      ) {
        target.onLog(
          'op-meta',
          `stale edit discarded (base rev ${opts.edit.baseRevision}, current rev ${target.getArtifactRevision()})`,
        );
        return 'stop';
      }
      return 'apply';
    },
    onLine: (line, context) => {
      if (target.recordEvents) {
        events.push({ kind: 'protocol-line', at: Date.now(), line });
      }
      if (line.op !== 'meta') applyLineTo(target, line, context);
    },
    onMeta: (line, context) => {
      if (line.path === '/surface-plan') {
        surfacePlan = normalizeSurfacePlan(line.value);
        if (surfacePlan && target.recordEvents) {
          events.push({ kind: 'surface-plan', at: Date.now(), plan: surfacePlan });
        }
      }
      if (line.path === '/shape' && typeof line.value === 'string') {
        shape = line.value;
      }
      applyLineTo(target, line, context);
    },
    onParseError: (raw) => {
      if (target.recordEvents) {
        events.push({ kind: 'protocol-parse-error', at: Date.now(), raw });
      }
      target.onLog('raw', `· ${raw.slice(0, 120)}`);
    },
    onGraph: (_snapshot, context) => pushGraphEvent(context),
    onRenderHtml: (html) => {
      target.getHandle()?.render(html);
    },
  });

  return {
    ...result,
    surfacePlan,
    shape,
  };
}

function surfaceRequestFor(active: ActiveContract): Pick<StreamOptions, 'surfacePolicy' | 'surfacePlan'> {
  if (!customContractEnabledEl.checked && active.surfacePolicy) {
    return { surfacePolicy: active.surfacePolicy };
  }
  return { surfacePlan: active.surfacePlan };
}

function createParentTarget(active: ActiveContract): SandboxTarget {
  return {
    getHandle: () => handle,
    getAcc: () => acc,
    getMode: () => currentMode,
    capabilities: capabilityPackFor(active),
    components: componentPackFor(active),
    onModeUpgrade: () => {
      setMode('interactive');
      respawn(currentDirectionId, 'interactive', { ...active, mode: 'interactive' });
      renderContractSummary();
    },
    onSurfacePlan: (plan) => {
      currentEffectiveSurfacePlan = plan;
      renderContractSummary();
    },
    onShape: (shape) => {
      currentShape = shape;
      renderContractSummary();
    },
    onTokenOverrides: (applied) => {
      activeTokensSourceOverride = applyTokenOverrideCss(tokensFor(currentDirectionId), applied);
      const composed = acc.hasAnySection() ? acc.compose() : null;
      respawn(currentDirectionId, currentMode, active, composed ?? '');
      renderContractSummary();
    },
    onGhostTokenSource: (css) => {
      activeTokensSourceOverride = css;
      const composed = acc.hasAnySection() ? acc.compose() : null;
      respawn(currentDirectionId, currentMode, active, composed ?? '');
    },
    onValidationSummary: (value) => {
      currentValidationSummary = summarizeValidationMeta(value);
      renderContractSummary();
    },
    onRepairSummary: (value) => {
      currentRepairSummary = summarizeRepairMeta(value);
      renderContractSummary();
    },
    onStreamGraphSummary: (value) => {
      currentStreamHealth = summarizeStreamGraphMeta(value);
      renderContractSummary();
    },
    onLog: logLine,
    onStatus: (s) => {
      currentStatus = s;
      paintStatus();
    },
    onBytes: (n) => {
      currentBytes += n;
      paintStatus();
    },
    getArtifactRevision: () => artifactRevision,
    onArtifactChanged: () => {
      artifactRevision += 1;
      updateEditControls();
    },
    recordEvents: true,
  };
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
  renderSavedSurfaces();
}

function saveSurfaceEnvelope(prompt: string, result: StreamResult) {
  if (!result.surfacePlan || !acc.hasAnySection()) return;
  const envelope = createSurfaceEnvelope({
    prompt,
    surfacePlan: result.surfacePlan,
    protocolLines: result.protocolLines,
    html: acc.compose(),
    validationIssues: result.validationIssues,
    streamGraph: result.streamGraph,
    grants: {
      intents: policy?.intents ?? [],
      capabilities: currentGrantedCapabilities,
      components: currentGrantedComponents,
    },
    metadata: {
      directionId: currentDirectionId,
      layoutId: readLayout()?.id ?? null,
      shape: result.shape,
      mode: currentMode,
    },
    tokenCss: activeTokensSourceOverride ?? tokensFor(currentDirectionId),
  });
  writeSavedSurfaces([
    envelope,
    ...loadSavedSurfaces().filter((item) => item.id !== envelope.id),
  ]);
}

function renderSavedSurfaces() {
  const items = loadSavedSurfaces();
  savedCountEl.textContent = String(items.length);
  savedListEl.innerHTML = '';
  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'saved-item';
    empty.innerHTML = '<div><div class="saved-item-title">No saved surfaces yet</div><div class="saved-item-meta">Completed runs appear here.</div></div>';
    savedListEl.append(empty);
    return;
  }
  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'saved-item';
    const info = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'saved-item-title';
    title.textContent = item.prompt;
    title.title = item.prompt;
    const meta = document.createElement('div');
    meta.className = 'saved-item-meta';
    const plan = item.surfacePlan;
    const validation = item.validationIssues.length;
    const complete = item.streamGraph?.health.complete ? 'complete' : 'open';
    meta.textContent =
      `${compactPlanText(plan)}` +
      ` · hostTools=${item.grants.intents.length}` +
      ` · validation=${validation}` +
      ` · ${complete}` +
      ` · ${new Date(item.createdAt).toLocaleTimeString()}`;
    info.append(title, meta);
    const replay = document.createElement('button');
    replay.type = 'button';
    replay.textContent = 'Replay';
    replay.addEventListener('click', () => replaySurface(item));
    row.append(info, replay);
    savedListEl.append(row);
  }
}

function replaySurface(envelope: SurfaceEnvelope) {
  abortController?.abort();
  disposeAllChildren();
  log.innerHTML = '';
  events.clear();
  activeTokensSourceOverride = envelope.tokenCss ?? null;
  setMode(deriveSurfacePlanControls(envelope.surfacePlan).mode);
  setSurfaceControls(envelope.surfacePlan);
  currentEffectiveSurfacePlan = envelope.surfacePlan;
  currentShape = envelope.metadata.shape ?? null;
  currentValidationSummary = `${envelope.validationIssues.filter((issue) => issue.severity === 'block').length}/${envelope.validationIssues.filter((issue) => issue.severity === 'warn').length}`;
  currentStreamHealth = envelope.streamGraph
    ? `${envelope.streamGraph.health.complete ? 'complete' : 'open'} · missing=${envelope.streamGraph.health.missingDeclared.length} blocked=${envelope.streamGraph.health.blockedCount} retried=${envelope.streamGraph.health.repairedCount}`
    : null;
  acc.reset();
  for (const line of envelope.protocolLines) {
    if (line.op !== 'meta') acc.applyDetailed(line);
  }
  artifactRevision = acc.snapshot().sections.length;
  respawn(currentDirectionId, currentMode, {
    ...readActiveContract(),
    mode: currentMode,
    capabilityNames: envelope.grants.intents,
    componentNames: envelope.grants.components?.map((component) => component.name),
    surfacePlan: envelope.surfacePlan,
    scriptPolicy: deriveSurfacePlanControls(envelope.surfacePlan).scriptPolicy,
  });
  hideWelcome();
  handle?.render(envelope.html);
  currentStatus = 'replayed';
  currentBytes = new TextEncoder().encode(envelope.html).byteLength;
  paintStatus();
  updateEditControls();
  renderContractSummary();
  events.push({ kind: 'surface-plan', at: Date.now(), plan: envelope.surfacePlan });
  events.push({ kind: 'stream-lifecycle', at: Date.now(), phase: 'end', ok: true });
  logLine('op-meta', `replayed ${envelope.surfacePlan.purpose}/${envelope.surfacePlan.runtime}`);
}

async function generate(prompt: string) {
  abortController?.abort();
  abortController = new AbortController();
  const active = readActiveContract();

  log.innerHTML = '';
  events.clear();
  disposeAllChildren();
  acc.reset();
  artifactRevision = 0;
  activeTokensSourceOverride = null;
  currentEffectiveSurfacePlan = null;
  currentShape = null;
  currentValidationSummary = null;
  currentRepairSummary = null;
  currentStreamHealth = null;
  respawn(currentDirectionId, active.mode, active);
  hideWelcome();
  goBtn.disabled = true;
  currentStatus = 'streaming';
  currentBytes = 0;
  paintStatus();
  events.push({ kind: 'stream-lifecycle', at: Date.now(), phase: 'start' });

  const target = createParentTarget(active);

  try {
    const result = await streamGenerationInto(target, {
      prompt,
      modelProvider: active.modelProvider,
      directionId: currentDirectionId,
      layout: readLayout(),
      scriptPolicy: active.scriptPolicy,
      ...surfaceRequestFor(active),
      tokenOverrides: active.tokenOverrides,
      repair: active.repair,
      signal: abortController.signal,
    });
    if (!currentValidationSummary) currentValidationSummary = '0/0';
    if (!currentRepairSummary) currentRepairSummary = active.repair?.enabled ? '0/0' : 'off';
    if (!currentStreamHealth) {
      currentStreamHealth =
        `${result.streamGraph.health.complete ? 'complete' : 'open'} · missing=${result.streamGraph.health.missingDeclared.length} blocked=${result.streamGraph.health.blockedCount} retried=${result.streamGraph.health.repairedCount}`;
    }
    renderContractSummary();
    saveSurfaceEnvelope(prompt, result);
    currentStatus = 'done';
    paintStatus();
    events.push({ kind: 'stream-lifecycle', at: Date.now(), phase: 'end', ok: true });
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      currentStatus = 'aborted';
      paintStatus();
      events.push({ kind: 'stream-lifecycle', at: Date.now(), phase: 'end', ok: false });
      return;
    }
    const msg = err instanceof Error ? err.message : String(err);
    logLine('op-error', `stream error: ${msg}`);
    currentStatus = 'error';
    paintStatus();
    events.push({ kind: 'stream-lifecycle', at: Date.now(), phase: 'end', ok: false });
  } finally {
    goBtn.disabled = false;
  }
}

async function editArtifact(instruction: string) {
  if (!acc.hasAnySection()) return;
  abortController?.abort();
  abortController = new AbortController();
  const active = readActiveContract();

  const baseRevision = artifactRevision;
  const edit = {
    baseRevision,
    sections: acc.snapshot().sections,
    targetSections: readEditTargets(),
  };

  goBtn.disabled = true;
  editGoBtn.disabled = true;
  currentStatus = 'editing';
  currentBytes = 0;
  paintStatus();
  events.push({ kind: 'stream-lifecycle', at: Date.now(), phase: 'start' });

  try {
    const result = await streamGenerationInto(createParentTarget(active), {
      prompt: instruction,
      modelProvider: active.modelProvider,
      directionId: currentDirectionId,
      layout: readLayout(),
      scriptPolicy: active.scriptPolicy,
      ...surfaceRequestFor(active),
      tokenOverrides: active.tokenOverrides,
      repair: active.repair,
      edit,
      signal: abortController.signal,
    });
    if (!currentStreamHealth) {
      currentStreamHealth =
        `${result.streamGraph.health.complete ? 'complete' : 'open'} · missing=${result.streamGraph.health.missingDeclared.length} blocked=${result.streamGraph.health.blockedCount} retried=${result.streamGraph.health.repairedCount}`;
    }
    renderContractSummary();
    currentStatus = 'done';
    paintStatus();
    events.push({ kind: 'stream-lifecycle', at: Date.now(), phase: 'end', ok: true });
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      currentStatus = 'aborted';
      paintStatus();
      events.push({ kind: 'stream-lifecycle', at: Date.now(), phase: 'end', ok: false });
      return;
    }
    const msg = err instanceof Error ? err.message : String(err);
    logLine('op-error', `edit error: ${msg}`);
    currentStatus = 'error';
    paintStatus();
    events.push({ kind: 'stream-lifecycle', at: Date.now(), phase: 'end', ok: false });
  } finally {
    goBtn.disabled = false;
    updateEditControls();
  }
}

/**
 * Spawn a sibling sandbox in the children stack. Each child gets:
 *   - its own iframe + SandboxHandle (independent runtime)
 *   - its own PolicyEngine + state (no shared store with the parent)
 *   - its own AbortController (close = abort + dispose)
 *
 * Depth cap of 1: children get every demo intent EXCEPT `summon`, so a
 * grandchild generation can't cascade. Easy to relax (counter on allowed tools),
 * but avoids accidental fan-out for the demo.
 */
function summonChild(childPrompt: string, title?: string) {
  const pane = document.createElement('section');
  pane.className = 'child-pane';

  const header = document.createElement('header');
  const titleEl = document.createElement('span');
  titleEl.className = 'child-title';
  titleEl.textContent = title ?? 'Summoned';
  const promptLabel = document.createElement('span');
  promptLabel.className = 'child-prompt';
  promptLabel.textContent = childPrompt;
  promptLabel.title = childPrompt;
  const statusEl = document.createElement('span');
  statusEl.className = 'child-status';
  statusEl.textContent = 'streaming…';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'child-close';
  closeBtn.setAttribute('aria-label', 'Close summoned UI');
  closeBtn.textContent = '×';
  header.append(titleEl, promptLabel, statusEl, closeBtn);

  const childIframe = document.createElement('iframe');
  childIframe.title = `Summoned: ${title ?? childPrompt.slice(0, 40)}`;

  pane.append(header, childIframe);
  childrenContainer.append(pane);

  const childAcc = new SectionAccumulator();
  const abort = new AbortController();
  let childHandle: SandboxHandle | null = null;
  let childTokensSourceOverride: string | null = activeTokensSourceOverride;

  // Allowed tools are narrowed: every demo intent EXCEPT summon. This is the
  // depth-cap mechanism — the trust boundary is the bridge allowlist, not
  // the LLM's word.
  const childCapabilityNames = baseCapabilityPack.intents
    .map((intent) => intent.name)
    .filter((name) => name !== 'summon');
  const childRegistry = createScopedDemoRegistry({
    modelProvider: readModelProviderId,
    onLog: () => {},
    onError: (m) => {
      statusEl.textContent = `error: ${m.slice(0, 40)}`;
    },
  }, childCapabilityNames);
  const childContract = childRegistry.toContract();
  const childCapabilities: CapabilityPack = childContract.pack;
  const childGrantedCapabilities = childContract.validationCapabilities;

  const childPolicy = new PolicyEngine({
    initialState: childContract.initialState,
    handlers: childRegistry.toPolicyHandlers(),
    onStateChange: (state) => {
      if (childHandle) childHandle.pushState(state);
    },
    onHandlerError: (intent, err) => {
      statusEl.textContent = `host handler error (${intent}): ${err.message.slice(0, 40)}`;
    },
    events,
  });

  const spawnChildSandbox = (initialHtml = '') => {
    childHandle?.dispose();
    childHandle = spawnSandbox({
      iframe: childIframe,
      artifact: {
        intents: childPolicy.intents,
        capabilities: childGrantedCapabilities,
        html: initialHtml,
        initialState: childPolicy.getState(),
      },
      grantedIntents: childPolicy.intents,
      grantedCapabilities: childGrantedCapabilities,
      bootstrapSource,
      tokensSource: childTokensSourceOverride ?? tokensFor(currentDirectionId),
      onIntent: (intent, args) => {
        void childPolicy.dispatch(intent, args);
      },
      onIntentRejected: (reason) => {
        statusEl.textContent = `rejected: ${reason.slice(0, 40)}`;
      },
      events,
    });
  };

  spawnChildSandbox();

  const childTarget: SandboxTarget = {
    getHandle: () => childHandle,
    getAcc: () => childAcc,
    // Children are interactive from the start — they were summoned with
    // intent grants in mind. The /mode-upgraded path is unreachable for them.
    getMode: () => 'interactive',
    capabilities: childCapabilities,
    onLog: () => {},
    onStatus: (s) => {
      statusEl.textContent = s;
    },
    onBytes: () => {},
    onGhostTokenSource: (css) => {
      childTokensSourceOverride = css;
      const composed = childAcc.hasAnySection() ? childAcc.compose() : null;
      spawnChildSandbox(composed ?? '');
    },
  };

  const handle: ChildHandle = {
    pane,
    dispose: () => {
      abort.abort();
      childHandle?.dispose();
      pane.remove();
      children.delete(handle);
    },
  };
  children.add(handle);

  closeBtn.addEventListener('click', handle.dispose);

  void streamGenerationInto(childTarget, {
    prompt: childPrompt,
    modelProvider: readModelProviderId(),
    directionId: currentDirectionId,
    signal: abort.signal,
  })
    .then(() => {
      statusEl.textContent = 'done';
    })
    .catch((err) => {
      if ((err as Error).name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : String(err);
      statusEl.textContent = `error: ${msg.slice(0, 60)}`;
    });
}

function disposeAllChildren() {
  for (const c of [...children]) c.dispose();
  summonedCount = 0;
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const p = promptEl.value.trim();
  if (!p) return;
  void generate(p);
});

editPromptEl.addEventListener('input', updateEditControls);
editTargetsEl.addEventListener('input', updateEditControls);
editGoBtn.addEventListener('click', () => {
  const instruction = editPromptEl.value.trim();
  if (!instruction) return;
  void editArtifact(instruction);
});

renderSavedSurfaces();
updateEditControls();

function summarize(ev: DevtoolsEvent): string {
  switch (ev.kind) {
    case 'sandbox-spawned':
      return `${ev.sandboxId.slice(0, 8)}… allowed=[${ev.grantedIntents.join(',') || '—'}]`;
    case 'sandbox-ready':
    case 'sandbox-disposed':
      return `${ev.sandboxId.slice(0, 8)}…`;
    case 'sandbox-fatal':
      return `${ev.sandboxId.slice(0, 8)}… ${ev.reason}`;
    case 'intent-emitted':
      return `host tool ${ev.intent} ${JSON.stringify(ev.args).slice(0, 80)}`;
    case 'intent-rejected':
      return `${ev.reason}`;
    case 'intent-dispatched':
      return `host dispatch ${ev.intent} #${ev.id.slice(-6)}`;
    case 'intent-settled':
      return `host settled ${ev.intent} #${ev.id.slice(-6)} ${ev.ok ? 'ok' : `fail: ${ev.error ?? ''}`} (${ev.durationMs}ms)`;
    case 'state-pushed':
      return Object.keys(ev.patch).join(', ') || '∅';
    case 'protocol-line':
      return `${ev.line.op} ${ev.line.path}`;
    case 'protocol-parse-error':
      return ev.raw.slice(0, 80);
    case 'stream-lifecycle':
      return ev.phase === 'start' ? 'start' : `end ok=${ev.ok}`;
    case 'stream-graph':
      return `sections=${ev.sections.length} missing=${ev.health.missingDeclared.length} skipped=${ev.health.skippedCount} retried=${ev.health.repairedCount}`;
    case 'surface-plan':
      return planText(ev.plan);
    case 'render':
      return `${ev.bytes.toLocaleString()} B`;
    case 'component-sync':
      return `${ev.components.length} trusted component${ev.components.length === 1 ? '' : 's'}`;
    case 'component-error':
      return `${ev.componentName ?? ev.componentId ?? 'component'} ${ev.code ?? 'error'}: ${ev.reason}`;
  }
}

let firstEventAt: number | null = null;
let renderQueued = false;

function paintDevtools() {
  renderQueued = false;
  const snap = events.snapshot();
  if (snap.length === 0) {
    devtoolsLog.innerHTML = '';
    devtoolsTally.textContent = 'no events';
    firstEventAt = null;
    return;
  }
  if (firstEventAt === null) firstEventAt = snap[0]!.at;

  const counts: Record<string, number> = {};
  for (const ev of snap) counts[ev.kind] = (counts[ev.kind] ?? 0) + 1;
  const tally = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${displayEventKind(k)} ${v}`)
    .join(' · ');
  devtoolsTally.textContent = tally;

  // Repaint the list — at <800 events keeping it simple beats incremental DOM.
  const frag = document.createDocumentFragment();
  for (const ev of snap) {
    const row = document.createElement('div');
    row.className = `ev ev-${ev.kind}`;
    const t = document.createElement('span');
    t.className = 'ev-time';
    t.textContent = `+${(ev.at - firstEventAt).toString().padStart(4, ' ')}ms`;
    const k = document.createElement('span');
    k.className = 'ev-kind';
    k.textContent = ev.kind;
    const s = document.createElement('span');
    s.className = 'ev-summary';
    s.textContent = summarize(ev);
    row.append(t, k, s);
    frag.append(row);
  }
  devtoolsLog.replaceChildren(frag);
  devtoolsLog.scrollTop = devtoolsLog.scrollHeight;
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

events.subscribe(() => {
  // Coalesce bursts (one streaming run can fire dozens of events per tick)
  // into a single repaint per microtask.
  if (renderQueued) return;
  renderQueued = true;
  queueMicrotask(paintDevtools);
});

void (async () => {
  populateSurfaceControls();
  await loadDirections();
  populateScenarioSelect();
  scenarioSel.value = showcaseScenarios[0]?.id ?? '';
  if (showcaseScenarios.length > 0) applyScenario(selectedScenario());
  renderSavedSurfaces();
  updateEditControls();
})();
