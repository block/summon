import {
  compileSurfacePolicy,
  PolicyEngine,
  type ComponentPack,
  type CompiledSurfacePolicy,
} from '@anarchitecture/summon';
import {
  consumeSurfaceStream,
  createComponentIslandRegistry,
  spawnSandbox,
  type ComponentIslandRegistry,
  type SandboxHandle,
  type SurfaceStreamContext,
} from '@anarchitecture/summon/browser';
import { createEventStore, type DevtoolsEvent } from '@anarchitecture/summon/devtools';
import { SectionAccumulator, type ProtocolLine } from '@anarchitecture/summon/engine';
import { bootstrapSource, tokensSource } from '@anarchitecture/summon/assets';
import { createGalleryCapabilityRegistry } from './capabilities.js';
import {
  allGalleryComponentNames,
  createGalleryComponentRegistry,
} from './components.js';
import {
  GALLERY_PRESETS,
  createGhostGalleryPreset,
  findPreset,
  policyComponents,
  policyGrants,
  policyText,
  type GalleryPreset,
  type GhostRootInfo,
} from './presets.js';
import './styles.css';

interface ModelProviderInfo {
  id: string;
  name: string;
  configured: boolean;
  model: string;
  utilityModel: string;
  models?: ModelCatalogEntry[];
  utilityModels?: ModelCatalogEntry[];
  defaults?: {
    generationModel: string;
    utilityModel: string;
    modelOptions?: Record<string, unknown>;
  };
  controls?: {
    customModels?: boolean;
  };
  missingEnv?: string;
}

interface ModelCatalogEntry {
  id: string;
  label: string;
  status?: string;
  tier?: string;
  maxOutputTokens?: number;
  anthropicThinking?: string;
}

interface ModelProviderPayload {
  defaultProvider?: string;
  providers?: ModelProviderInfo[];
}

interface ModelSelectionPayload {
  modelProvider?: string;
  generationModel?: string;
  utilityModel?: string;
  customModel?: boolean;
}

const presetList = document.getElementById('preset-list')!;
const presetCountEl = document.getElementById('preset-count')!;
const providerSummaryEl = document.getElementById('provider-summary')!;
const topbarRunStatusEl = document.getElementById('topbar-run-status')!;
const modelProviderSel = document.getElementById('model-provider') as HTMLSelectElement;
const generationModelSel = document.getElementById('generation-model') as HTMLSelectElement;
const utilityModelSel = document.getElementById('utility-model') as HTMLSelectElement;
const customModelFieldEl = document.getElementById('custom-model-field')!;
const customModelEl = document.getElementById('custom-model') as HTMLInputElement;
const presetCategory = document.getElementById('preset-category')!;
const presetTitle = document.getElementById('preset-title')!;
const presetDescription = document.getElementById('preset-description')!;
const surfacePolicyPill = document.getElementById('surface-policy-pill')!;
const surfaceToolsPill = document.getElementById('surface-tools-pill')!;
const surfaceComponentsPill = document.getElementById('surface-components-pill')!;
const promptEl = document.getElementById('prompt') as HTMLTextAreaElement;
const promptLengthEl = document.getElementById('prompt-length')!;
const runButton = document.getElementById('run') as HTMLButtonElement;
const iframe = document.getElementById('sandbox') as HTMLIFrameElement;
const welcome = document.getElementById('welcome')!;
const welcomeTitle = document.getElementById('welcome-title')!;
const welcomeDetail = document.getElementById('welcome-detail')!;
const sandboxModeEl = document.getElementById('sandbox-mode')!;
const inspectorStatusEl = document.getElementById('inspector-status')!;
const inspectorTabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-inspector-tab]'));
const inspectorPanels = Array.from(document.querySelectorAll<HTMLElement>('[data-inspector-panel]'));
const contractSummary = document.getElementById('contract-summary')!;
const statusEl = document.getElementById('status')!;
const acceptedCountEl = document.getElementById('accepted-count')!;
const skippedCountEl = document.getElementById('skipped-count')!;
const blockedCountEl = document.getElementById('blocked-count')!;
const statePreview = document.getElementById('state-preview')!;
const setupNote = document.getElementById('setup-note')!;
const eventCount = document.getElementById('event-count')!;
const eventLog = document.getElementById('event-log')!;

const events = createEventStore({ bufferSize: 120 });
const accumulator = new SectionAccumulator();
const hostMessages: string[] = [];

type InspectorTab = 'contract' | 'stream' | 'state';

let selectedPreset = GALLERY_PRESETS[0]!;
let handle: SandboxHandle | null = null;
let islands: ComponentIslandRegistry | null = null;
let policy: PolicyEngine | null = null;
let abortController: AbortController | null = null;
let galleryPresets: GalleryPreset[] = [...GALLERY_PRESETS];
let activeTokensSourceOverride: string | null = null;
let modelProviderLabel = 'server default';
let defaultModelProviderId: string | null = null;
let modelProviders: ModelProviderInfo[] = [];
let generationInFlight = false;
let surfaceRenderedDuringRun = false;
let acceptedStructuralLines = 0;
let skippedLines = 0;
let blockedLines = 0;

events.subscribe(renderEvents);

void initGallery();

runButton.addEventListener('click', () => {
  void generateSelectedSurface();
});
promptEl.addEventListener('input', renderPromptLength);
modelProviderSel.addEventListener('change', () => {
  customModelEl.value = '';
  populateModelSelectionControls();
  renderContract();
});
generationModelSel.addEventListener('change', () => {
  customModelFieldEl.hidden = generationModelSel.value !== '__custom__';
  renderContract();
});
utilityModelSel.addEventListener('change', renderContract);
customModelEl.addEventListener('input', renderContract);
for (const button of inspectorTabButtons) {
  button.addEventListener('click', () => {
    const tab = button.dataset.inspectorTab as InspectorTab | undefined;
    if (tab) selectInspectorTab(tab);
  });
}

function renderPresetCards(): void {
  presetList.innerHTML = '';
  presetCountEl.textContent = String(galleryPresets.length);
  for (const [index, preset] of galleryPresets.entries()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'preset-card';
    button.dataset.presetId = preset.id;
    button.innerHTML = `
      <span class="preset-index">${String(index + 1).padStart(2, '0')}</span>
      <span class="preset-main">
        <strong>${preset.title}</strong>
        <span>${preset.category}</span>
        <em>${compactPolicyText(preset)}</em>
      </span>
    `;
    button.addEventListener('click', () => selectPreset(preset.id));
    presetList.append(button);
  }
}

function selectPreset(id: string): void {
  selectedPreset = galleryPresets.find((preset) => preset.id === id) ?? findPreset(id);
  activeTokensSourceOverride = null;
  for (const card of presetList.querySelectorAll<HTMLButtonElement>('.preset-card')) {
    card.classList.toggle('active', card.dataset.presetId === selectedPreset.id);
  }
  presetCategory.textContent = selectedPreset.category;
  presetTitle.textContent = selectedPreset.title;
  presetDescription.textContent = selectedPreset.description;
  promptEl.value = selectedPreset.prompt;
  renderPromptLength();
  resetCounters();
  respawnSandbox();
  renderContract();
  renderHealth('idle');
  selectInspectorTab('contract');
  setSetupNote(null);
  welcome.classList.remove('hidden');
}

function respawnSandbox(initialHtml = ''): void {
  islands?.destroy();
  islands = null;
  handle?.dispose();
  handle = null;
  policy = null;

  const compiledPolicy = compiledPolicyFor(selectedPreset);
  const capabilityRegistry = createGalleryCapabilityRegistry(compiledPolicy.policy.grants, {
    onLog: pushHostMessage,
    modelSelection: readModelSelection,
  });
  const capabilityContract = capabilityRegistry.toContract();
  const componentRegistry = compiledPolicy.policy.components.length
    ? createGalleryComponentRegistry(compiledPolicy.policy.components)
    : null;
  const componentContract = componentRegistry?.toContract();
  if (componentRegistry) {
    islands = createComponentIslandRegistry({
      outerIframe: iframe,
      registry: componentRegistry,
      events,
      onError: (error) => {
        pushHostMessage(`component ${error.code}: ${error.reason}`, { attention: true });
      },
    });
  }

  const initialState = compiledPolicy.mode === 'interactive'
    ? capabilityContract.initialState
    : {};
  renderState(initialState);

  if (compiledPolicy.mode === 'interactive') {
    policy = new PolicyEngine({
      initialState,
      handlers: capabilityRegistry.toPolicyHandlers(),
      events,
      onStateChange: (state) => {
        renderState(state);
        handle?.pushState(state);
      },
      onHandlerError: (intent, error) => {
        pushHostMessage(`host handler ${intent}: ${error.message}`, { attention: true });
      },
    });
  }

  handle = spawnSandbox({
    iframe,
    artifact: {
      html: initialHtml,
      intents: [],
      capabilities: capabilityContract.validationCapabilities,
      components: componentContract?.validationComponents,
      initialState,
    },
    grantedIntents: compiledPolicy.mode === 'interactive' ? capabilityRegistry.intents() : [],
    grantedCapabilities: compiledPolicy.mode === 'interactive'
      ? capabilityContract.validationCapabilities
      : [],
    bootstrapSource,
    tokensSource: activeTokensSourceOverride ?? tokensSource,
    events,
    onIntent: (intent, args) => {
      void policy?.dispatch(intent, args);
    },
    onComponents: (components, sandboxId) => {
      islands?.sync(components, {
        sandboxId,
        emitIntent: (intent, args = {}) => {
          void policy?.dispatch(intent, args);
        },
      });
    },
    onSandboxFatal: (reason) => {
      setSetupNote(`Sandbox failed to boot: ${reason}`);
    },
  });
}

async function generateSelectedSurface(): Promise<void> {
  abortController?.abort();
  abortController = new AbortController();
  accumulator.reset();
  events.clear();
  hostMessages.length = 0;
  resetCounters();
  respawnSandbox();
  generationInFlight = true;
  surfaceRenderedDuringRun = false;
  showStreamingWelcome('streaming');
  runButton.disabled = true;
  renderHealth('streaming');
  setSetupNote(null);
  events.push({ kind: 'stream-lifecycle', at: Date.now(), phase: 'start' });

  const compiledPolicy = compiledPolicyFor(selectedPreset);
  const capabilityPack = createGalleryCapabilityRegistry().toContract().pack;
  const componentPack = componentCeilingFor(selectedPreset);

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: abortController.signal,
      body: JSON.stringify({
        prompt: promptEl.value.trim(),
        ...readModelSelection(),
        surfacePolicy: selectedPreset.surfacePolicy,
        capabilities: capabilityPack,
        ...(componentPack ? { components: componentPack } : {}),
        ...(selectedPreset.ghost
          ? {
              ghost: {
                rootId: selectedPreset.ghost.rootId,
                targetPath: selectedPreset.ghost.targetPath,
                ...(selectedPreset.ghost.baseDirectionId
                  ? { baseDirectionId: selectedPreset.ghost.baseDirectionId }
                  : {}),
              },
            }
          : {}),
      }),
    });

    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => '');
      throw new Error(text || `Generation server returned ${response.status}`);
    }

    await consumeSurfaceStream(response.body, {
      mode: compiledPolicy.mode,
      renderMode: 'live',
      accumulator,
      onLine: (line, context) => handleLine(line, context),
      onMeta: (line) => handleMeta(line),
      onRenderHtml: (html) => {
        surfaceRenderedDuringRun = true;
        welcome.classList.add('hidden');
        handle?.render(html);
      },
      onParseError: (raw) => {
        events.push({ kind: 'protocol-parse-error', at: Date.now(), raw });
        selectInspectorTab('stream');
      },
    });
    events.push({ kind: 'stream-lifecycle', at: Date.now(), phase: 'end', ok: true });
    renderHealth('done');
    if (!surfaceRenderedDuringRun) showStreamingWelcome('done');
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    const message = error instanceof Error ? error.message : String(error);
    renderHealth('setup needed');
    selectInspectorTab('stream');
    events.push({ kind: 'stream-lifecycle', at: Date.now(), phase: 'end', ok: false });
    setSetupNote(
      `Live generation needs the demo server and a configured model provider key in apps/server/.env. ${message}`,
    );
  } finally {
    generationInFlight = false;
    runButton.disabled = false;
  }
}

function componentCeilingFor(preset: GalleryPreset): ComponentPack | null {
  if (!policyComponents(preset.surfacePolicy).length) return null;
  return createGalleryComponentRegistry().toContract().pack;
}

function compiledPolicyFor(preset: GalleryPreset): CompiledSurfacePolicy {
  return compileSurfacePolicy(preset.surfacePolicy, {
    capabilities: createGalleryCapabilityRegistry().toContract().pack,
    components: createGalleryComponentRegistry().toContract().pack,
  });
}

function handleLine(line: ProtocolLine, context: SurfaceStreamContext): void {
  if (line.op !== 'meta') {
    acceptedStructuralLines = context.acceptedStructuralLines;
    acceptedCountEl.textContent = String(acceptedStructuralLines);
    if (generationInFlight && !surfaceRenderedDuringRun) {
      showStreamingWelcome(topbarRunStatusEl.textContent);
    }
  }
  events.push({ kind: 'protocol-line', at: Date.now(), line });
}

function handleMeta(line: Extract<ProtocolLine, { op: 'meta' }>): void {
  if (line.path === '/status') {
    renderHealth(String(line.value));
  }
  if (line.path === '/protocol-skip') {
    skippedLines += 1;
  }
  if (line.path === '/validation-blocked') {
    blockedLines += 1;
    selectInspectorTab('stream');
  }
  if (line.path === '/stream-graph-summary') {
    const value = line.value as { health?: { blockedCount?: unknown; skippedCount?: unknown } };
    if (typeof value.health?.blockedCount === 'number') blockedLines = value.health.blockedCount;
    if (typeof value.health?.skippedCount === 'number') skippedLines = value.health.skippedCount;
    if (blockedLines > 0) selectInspectorTab('stream');
  }
  if (line.path === '/ghost-token-source') {
    const value = line.value as { css?: unknown };
    if (typeof value.css === 'string' && value.css.trim()) {
      activeTokensSourceOverride = value.css;
      const composed = accumulator.hasAnySection() ? accumulator.compose() : null;
      respawnSandbox(composed ?? '');
    }
  }
  skippedCountEl.textContent = String(skippedLines);
  blockedCountEl.textContent = String(blockedLines);
}

function renderContract(): void {
  const componentNames = policyComponents(selectedPreset.surfacePolicy);
  const grantNames = policyGrants(selectedPreset.surfacePolicy);
  const components = componentNames.length
    ? componentNames.join(', ')
    : 'none';
  const allowedHostTools = grantNames.length
    ? grantNames.join(', ')
    : 'none';
  const policy = policyText(selectedPreset.surfacePolicy);
  const provider = selectedModelProvider();
  const modelSelection = readModelSelection();
  const generationModel = modelSelection.generationModel
    ?? provider?.defaults?.generationModel
    ?? provider?.model
    ?? 'server default';
  const utilityModel = modelSelection.utilityModel
    ?? provider?.defaults?.utilityModel
    ?? provider?.utilityModel
    ?? 'server default';
  providerSummaryEl.textContent = provider ? `${provider.name} - ${generationModel}` : modelProviderLabel;
  surfacePolicyPill.textContent = centerPolicyText(selectedPreset);
  surfaceToolsPill.textContent = `${grantNames.length} host tool${grantNames.length === 1 ? '' : 's'}`;
  surfaceComponentsPill.textContent = `${componentNames.length} component${componentNames.length === 1 ? '' : 's'}`;
  welcomeTitle.textContent = selectedPreset.title;
  welcomeDetail.textContent = selectedPreset.description;
  contractSummary.innerHTML = '';
  const rows: Array<[string, string, string]> = [
    ['provider', 'Model provider', provider ? `${provider.name} - ${generationModel}` : modelProviderLabel],
    ['utility', 'Utility model', utilityModel],
    ['policy', 'Surface config', policy],
    ['tier', 'Surface type', selectedPreset.surfacePolicy.tier],
    ['grants', 'Allowed host tools', allowedHostTools],
    ['components', 'Trusted components', components],
    ...(selectedPreset.ghost
      ? [['ghost', 'Ghost root', `${selectedPreset.ghost.rootId} - ${selectedPreset.ghost.targetPath}`] as [string, string, string]]
      : []),
  ];
  for (const [key, label, value] of rows) {
    const row = document.createElement('div');
    row.className = 'contract-row';
    row.dataset.contractRow = key;
    row.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    contractSummary.append(row);
  }
}

async function initGallery(): Promise<void> {
  const [ghostRoots] = await Promise.all([
    loadGhostRoots(),
    loadModelProviderSummary(),
  ]);
  galleryPresets = [
    ...GALLERY_PRESETS,
    ...ghostRoots.map(createGhostGalleryPreset),
  ];
  selectedPreset = galleryPresets[0]!;
  renderPresetCards();
  selectPreset(selectedPreset.id);
}

async function loadGhostRoots(): Promise<GhostRootInfo[]> {
  try {
    const response = await fetch('/api/ghost-roots');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const roots = await response.json();
    return Array.isArray(roots) ? roots as GhostRootInfo[] : [];
  } catch {
    return [];
  }
}

async function loadModelProviderSummary(): Promise<void> {
  try {
    const response = await fetch('/api/model-providers');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as ModelProviderPayload;
    defaultModelProviderId = typeof payload.defaultProvider === 'string' ? payload.defaultProvider : null;
    modelProviders = Array.isArray(payload.providers) ? payload.providers.map(normalizeProviderInfo) : [];
    const selected = modelProviders.find((provider) => provider.id === defaultModelProviderId)
      ?? modelProviders.find((provider) => provider.configured)
      ?? modelProviders[0];
    if (selected) {
      modelProviderLabel = selected.configured
        ? `${selected.name} - ${selected.model}`
        : `${selected.name} - missing ${selected.missingEnv ?? 'key'}`;
      providerSummaryEl.dataset.providerState = selected.configured ? 'ready' : 'missing';
    } else {
      modelProviderLabel = 'server default';
      providerSummaryEl.dataset.providerState = 'unknown';
    }
  } catch {
    defaultModelProviderId = null;
    modelProviders = [];
    modelProviderLabel = 'server offline';
    providerSummaryEl.dataset.providerState = 'offline';
  }
  providerSummaryEl.textContent = modelProviderLabel;
  populateModelProviderSelect();
}

function normalizeProviderInfo(provider: ModelProviderInfo): ModelProviderInfo {
  return {
    ...provider,
    models: Array.isArray(provider.models) ? provider.models : fallbackCatalog(provider.model),
    utilityModels: Array.isArray(provider.utilityModels) ? provider.utilityModels : fallbackCatalog(provider.utilityModel),
  };
}

function readModelProviderId(): string | null {
  return modelProviderSel.value || defaultModelProviderId;
}

function selectedModelProvider(): ModelProviderInfo | null {
  const id = readModelProviderId();
  return id ? modelProviders.find((provider) => provider.id === id) ?? null : null;
}

function readModelSelection(): ModelSelectionPayload {
  const selection: ModelSelectionPayload = {};
  const providerId = readModelProviderId();
  if (providerId) selection.modelProvider = providerId;
  if (generationModelSel.value === '__custom__') {
    const custom = customModelEl.value.trim();
    if (custom) {
      selection.generationModel = custom;
      selection.customModel = true;
    }
  } else if (generationModelSel.value) {
    selection.generationModel = generationModelSel.value;
  }
  if (utilityModelSel.value) selection.utilityModel = utilityModelSel.value;
  return selection;
}

function populateModelProviderSelect(): void {
  modelProviderSel.innerHTML = '';
  if (modelProviders.length === 0) {
    modelProviderSel.disabled = true;
    generationModelSel.disabled = true;
    utilityModelSel.disabled = true;
    return;
  }
  modelProviderSel.disabled = false;
  for (const provider of modelProviders) {
    const opt = document.createElement('option');
    opt.value = provider.id;
    opt.textContent = provider.configured ? provider.name : `${provider.name} (missing key)`;
    opt.disabled = !provider.configured;
    modelProviderSel.append(opt);
  }
  const defaultProvider = defaultModelProviderId
    ? modelProviders.find((provider) => provider.id === defaultModelProviderId && provider.configured)
    : null;
  modelProviderSel.value = defaultProvider?.id
    ?? modelProviders.find((provider) => provider.configured)?.id
    ?? '';
  populateModelSelectionControls();
}

function populateModelSelectionControls(): void {
  const provider = selectedModelProvider();
  populateCatalogSelect(
    generationModelSel,
    provider?.models ?? [],
    provider?.defaults?.generationModel ?? provider?.model ?? '',
    provider?.controls?.customModels !== false,
  );
  populateCatalogSelect(
    utilityModelSel,
    provider?.utilityModels ?? [],
    provider?.defaults?.utilityModel ?? provider?.utilityModel ?? '',
    false,
  );
  generationModelSel.disabled = !provider;
  utilityModelSel.disabled = !provider;
  customModelFieldEl.hidden = generationModelSel.value !== '__custom__';
}

function populateCatalogSelect(
  select: HTMLSelectElement,
  models: ModelCatalogEntry[],
  selected: string,
  customModels: boolean,
): void {
  select.innerHTML = '';
  for (const model of models) {
    const opt = document.createElement('option');
    opt.value = model.id;
    opt.textContent = `${model.label} · ${model.tier ?? 'model'}`;
    opt.title = model.id;
    select.append(opt);
  }
  if (customModels) {
    const opt = document.createElement('option');
    opt.value = '__custom__';
    opt.textContent = 'Custom model...';
    select.append(opt);
  }
  select.value = models.some((model) => model.id === selected) ? selected : models[0]?.id ?? '';
}

function fallbackCatalog(model: string): ModelCatalogEntry[] {
  return [{
    id: model,
    label: model,
    status: 'stable',
    tier: 'balanced',
    maxOutputTokens: 64000,
  }];
}

function renderHealth(status: string): void {
  statusEl.textContent = status;
  topbarRunStatusEl.textContent = status;
  sandboxModeEl.textContent = status === 'idle' ? 'isolated' : status;
  acceptedCountEl.textContent = String(acceptedStructuralLines);
  skippedCountEl.textContent = String(skippedLines);
  blockedCountEl.textContent = String(blockedLines);
  if (generationInFlight && !surfaceRenderedDuringRun) {
    showStreamingWelcome(status);
  }
}

function showStreamingWelcome(status: string): void {
  const normalized = status.toLowerCase();
  const label = normalized === 'thinking'
    ? 'Thinking'
    : normalized === 'writing'
      ? 'Writing'
      : normalized === 'done'
        ? 'Stream complete'
        : 'Streaming';
  const lineText = acceptedStructuralLines === 0
    ? 'Waiting for validated surface lines.'
    : `${acceptedStructuralLines} validated surface line${acceptedStructuralLines === 1 ? '' : 's'} received.`;
  welcome.querySelector<HTMLElement>('.welcome-kicker')!.textContent = label;
  welcomeTitle.textContent = selectedPreset.title;
  welcomeDetail.textContent = `${lineText} The sandbox updates as structure arrives.`;
  welcome.classList.remove('hidden');
}

function renderPromptLength(): void {
  promptLengthEl.textContent = `${promptEl.value.length.toLocaleString()} chars`;
}

function renderState(state: Record<string, unknown>): void {
  statePreview.textContent = JSON.stringify(state, null, 2);
}

function renderEvents(): void {
  const rows = [
    ...events.snapshot().map(describeEvent),
    ...hostMessages,
  ].slice(-10);
  eventCount.textContent = String(events.size() + hostMessages.length);
  eventLog.innerHTML = '';
  for (const event of rows) {
    const row = document.createElement('div');
    row.className = 'event-row';
    row.textContent = event;
    eventLog.append(row);
  }
}

function selectInspectorTab(tab: InspectorTab): void {
  inspectorStatusEl.textContent = inspectorTabLabel(tab);
  for (const button of inspectorTabButtons) {
    const active = button.dataset.inspectorTab === tab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  }
  for (const panel of inspectorPanels) {
    const active = panel.dataset.inspectorPanel === tab;
    panel.classList.toggle('active', active);
    panel.hidden = !active;
  }
}

function inspectorTabLabel(tab: InspectorTab): string {
  if (tab === 'stream') return 'Stream';
  if (tab === 'state') return 'State';
  return 'Contract';
}

function compactPolicyText(preset: GalleryPreset): string {
  const grants = policyGrants(preset.surfacePolicy);
  const grantText = grants.length ? grants.join(',') : 'no tools';
  return `${preset.surfacePolicy.tier} / ${grantText}`;
}

function centerPolicyText(preset: GalleryPreset): string {
  return `${preset.surfacePolicy.tier} / ${preset.surfacePolicy.purpose ?? 'surface'}`;
}

function describeEvent(event: DevtoolsEvent): string {
  switch (event.kind) {
    case 'protocol-line':
      return `protocol ${event.line.op} ${event.line.path}`;
    case 'intent-emitted':
      return `host tool ${event.intent}`;
    case 'intent-dispatched':
      return `host dispatch ${event.intent}`;
    case 'intent-settled':
      return `host settled ${event.intent} ${event.ok ? 'ok' : 'error'}`;
    case 'state-pushed':
      return `state ${Object.keys(event.patch).join(', ') || 'updated'}`;
    case 'component-error':
      return `component ${event.code}: ${event.reason}`;
    case 'stream-lifecycle':
      return `stream ${event.phase}${event.ok === undefined ? '' : event.ok ? ' ok' : ' error'}`;
    default:
      return event.kind;
  }
}

function pushHostMessage(message: string, opts: { attention?: boolean } = {}): void {
  hostMessages.push(message);
  if (hostMessages.length > 30) hostMessages.splice(0, hostMessages.length - 30);
  if (opts.attention) selectInspectorTab('stream');
  renderEvents();
}

function resetCounters(): void {
  acceptedStructuralLines = 0;
  skippedLines = 0;
  blockedLines = 0;
  acceptedCountEl.textContent = '0';
  skippedCountEl.textContent = '0';
  blockedCountEl.textContent = '0';
}

function setSetupNote(message: string | null): void {
  setupNote.hidden = !message;
  setupNote.textContent = message ?? '';
}

export const galleryTestApi = {
  presets: GALLERY_PRESETS,
  allComponentNames: allGalleryComponentNames,
  selectPreset,
};
