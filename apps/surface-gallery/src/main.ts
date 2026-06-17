import {
  compileSurfacePolicy,
  PolicyEngine,
  type ApprovalDecision,
  type ApprovalRequest,
  type CompiledSurfacePolicy,
} from '@anarchitecture/summon';
import {
  consumeSurfaceStream,
  mountInlineSurface,
  type InlineSurfaceHandle,
  type SurfaceStreamContext,
} from '@anarchitecture/summon/browser';
import { createEventStore, type DevtoolsEvent } from '@anarchitecture/summon/devtools';
import { type ProtocolLine, type SurfaceContractView, type ValidationContext } from '@anarchitecture/summon/engine';
import { tokensSource } from '@anarchitecture/summon/assets';
import { createGalleryToolRegistry } from './tools.js';
import {
  GALLERY_PRESETS,
  createGhostGalleryPreset,
  findPreset,
  policyGrants,
  policyText,
  type GalleryPreset,
  type GhostRootInfo,
} from './presets.js';
import {
  approvalActionsClass,
  approvalButtonClass,
  approvalCardClass,
  approvalDetailsClass,
  approvalEyebrowClass,
  approvalMetaClass,
  approvalStackClass,
  approvalTitleClass,
  contractLabelClass,
  contractRowClass,
  contractValueClass,
  eventRowClass,
  inspectorPanelClass,
  inspectorTabClass,
  authorityCellClass,
  authorityLabelClass,
  authorityValueClass,
  notesKickerClass,
  notesListClass,
  presetCardClass,
  presetCategoryClass,
  presetClaimClass,
  presetIndexClass,
  presetMainClass,
  presetMetaClass,
  presetTitleClass,
  statusBadgeClass,
} from './ui.js';
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
const presetClaim = document.getElementById('preset-claim')!;
const authorityBoundary = document.getElementById('authority-boundary')!;
const authorityMeter = document.getElementById('authority-meter')!;
const tryBoundaryButton = document.getElementById('try-boundary') as HTMLButtonElement;
const presetNotes = document.getElementById('preset-notes')!;
const surfacePolicyPill = document.getElementById('surface-policy-pill')!;
const surfaceToolsPill = document.getElementById('surface-tools-pill')!;
const surfaceComponentsPill = document.getElementById('surface-components-pill')!;
const promptEl = document.getElementById('prompt') as HTMLTextAreaElement;
const promptLengthEl = document.getElementById('prompt-length')!;
const runButton = document.getElementById('run') as HTMLButtonElement;
const surfaceRoot = document.getElementById('sandbox') as HTMLElement;
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
const hostMessages: string[] = [];

type InspectorTab = 'contract' | 'stream' | 'state';

let selectedPreset = GALLERY_PRESETS[0]!;
let handle: InlineSurfaceHandle | null = null;
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
let currentSurfaceContractView: SurfaceContractView | null = null;
let approvalStack: HTMLElement | null = null;
const pendingApprovalCards = new Map<string, () => void>();

events.subscribe(renderEvents);

void initGallery();

runButton.addEventListener('click', () => {
  void generateSelectedSurface();
});
tryBoundaryButton.addEventListener('click', () => {
  if (!selectedPreset.adversarialPrompt) return;
  promptEl.value = selectedPreset.adversarialPrompt;
  renderPromptLength();
  selectInspectorTab('stream');
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
    button.className = presetCardClass(preset.id === selectedPreset.id);
    button.dataset.presetId = preset.id;
    button.innerHTML = `
      <span class="${presetIndexClass}">${String(index + 1).padStart(2, '0')}</span>
      <span class="${presetMainClass}">
        <strong class="${presetTitleClass}">${preset.title}</strong>
        <span class="${presetCategoryClass}">${preset.category}${preset.featured ? ' · featured' : ''}</span>
        <span class="${presetClaimClass}">${preset.claim}</span>
        <em class="${presetMetaClass}">${compactPolicyText(preset)}</em>
      </span>
    `;
    button.addEventListener('click', () => selectPreset(preset.id));
    presetList.append(button);
  }
}

function selectPreset(id: string): void {
  selectedPreset = galleryPresets.find((preset) => preset.id === id) ?? findPreset(id);
  activeTokensSourceOverride = null;
  currentSurfaceContractView = null;
  for (const card of presetList.querySelectorAll<HTMLButtonElement>('[data-preset-id]')) {
    card.className = presetCardClass(card.dataset.presetId === selectedPreset.id);
  }
  presetCategory.textContent = selectedPreset.category;
  presetTitle.textContent = selectedPreset.title;
  presetDescription.textContent = selectedPreset.description;
  presetClaim.textContent = selectedPreset.claim;
  promptEl.value = selectedPreset.prompt;
  tryBoundaryButton.hidden = !selectedPreset.adversarialPrompt;
  tryBoundaryButton.disabled = !selectedPreset.adversarialPrompt;
  renderPromptLength();
  resetCounters();
  remountSurface();
  renderContract();
  renderAuthorityMeter(compiledPolicyFor(selectedPreset));
  renderPresetNotes();
  renderHealth('idle');
  selectInspectorTab('contract');
  setSetupNote(null);
  welcome.hidden = false;
}

function remountSurface(): void {
  clearApprovalCards('Approval request was replaced');
  handle?.dispose();
  handle = null;
  policy = null;

  const compiledPolicy = compiledPolicyFor(selectedPreset);
  const toolRegistry = createGalleryToolRegistry(compiledPolicy.policy.grants, {
    onLog: pushHostMessage,
    modelSelection: readModelSelection,
    onApprovalRequest: requestHostApproval,
  });
  const toolContract = toolRegistry.toContract();
  const initialState = compiledPolicy.mode === 'interactive'
    ? toolContract.initialState
    : {};
  const validationContext = validationContextForPolicy(
    compiledPolicy,
    toolRegistry.tools(),
    toolContract.validationTools,
  );
  renderState(initialState);

  if (compiledPolicy.mode === 'interactive') {
    policy = new PolicyEngine({
      initialState,
      handlers: toolRegistry.toPolicyHandlers(),
      events,
      onStateChange: (state) => {
        renderState(state);
        handle?.pushState(state);
      },
      onHandlerError: (tool, error) => {
        pushHostMessage(`host handler ${tool}: ${error.message}`, { attention: true });
      },
    });
  }

  handle = mountInlineSurface({
    root: surfaceRoot,
    grantedTools: compiledPolicy.mode === 'interactive' ? toolRegistry.tools() : [],
    validationTools: compiledPolicy.mode === 'interactive'
      ? toolContract.validationTools
      : [],
    tokensSource: activeTokensSourceOverride ?? tokensSource,
    events,
    initialState,
    onToolCall: (tool, args) => {
      if (!policy) return {};
      return policy.dispatch(tool, args).then((result) => result.state);
    },
    onRuntimeError: (reason) => {
      setSetupNote(`Surface runtime failed: ${reason}`);
    },
  });
}

async function generateSelectedSurface(): Promise<void> {
  abortController?.abort();
  abortController = new AbortController();
  events.clear();
  hostMessages.length = 0;
  currentSurfaceContractView = null;
  resetCounters();
  remountSurface();
  generationInFlight = true;
  surfaceRenderedDuringRun = false;
  showStreamingWelcome('streaming');
  runButton.disabled = true;
  renderHealth('streaming');
  setSetupNote(null);
  events.push({ kind: 'stream-lifecycle', at: Date.now(), phase: 'start' });

  const compiledPolicy = compiledPolicyFor(selectedPreset);
  const toolPack = createGalleryToolRegistry().toContract().pack;
  const validationContract = createGalleryToolRegistry(compiledPolicy.policy.grants).toContract();

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: abortController.signal,
      body: JSON.stringify({
        prompt: promptEl.value.trim(),
        ...readModelSelection(),
        surfacePolicy: selectedPreset.surfacePolicy,
        tools: toolPack,
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
      validationContext: validationContextForPolicy(
        compiledPolicy,
        compiledPolicy.policy.grants,
        validationContract.validationTools,
      ),
      onLine: (line, context) => handleLine(line, context),
      onMeta: (line) => handleMeta(line),
      onSurfaceEvent: (event) => {
        surfaceRenderedDuringRun = true;
        welcome.hidden = true;
        handle?.applyPreviewEvent(event);
      },
      onArtifact: (artifact) => {
        surfaceRenderedDuringRun = true;
        welcome.hidden = true;
        handle?.renderArtifact(artifact);
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

function compiledPolicyFor(preset: GalleryPreset): CompiledSurfacePolicy {
  return compileSurfacePolicy(preset.surfacePolicy, {
    tools: createGalleryToolRegistry().toContract().pack,
  });
}

function validationContextForPolicy(
  compiledPolicy: CompiledSurfacePolicy,
  grantedTools: string[],
  tools: ValidationContext['tools'],
): ValidationContext {
  return {
    mode: compiledPolicy.mode,
    allowedTools: grantedTools,
    tools,
    surfacePlan: compiledPolicy.surfacePlan,
  };
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
  if (line.path === '/surface-contract') {
    const contract = parseSurfaceContractView(line.value);
    if (contract) {
      currentSurfaceContractView = contract;
      events.push({ kind: 'surface-contract', at: Date.now(), contract });
      renderContract();
    }
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
      remountSurface();
    }
  }
  skippedCountEl.textContent = String(skippedLines);
  blockedCountEl.textContent = String(blockedLines);
}

function renderAuthorityMeter(compiled: CompiledSurfacePolicy): void {
  const plan = compiled.surfacePlan;
  const grants = compiled.policy.grants;
  authorityBoundary.textContent = selectedPreset.boundary ?? 'The host-selected policy decides what can run.';
  authorityMeter.innerHTML = '';
  const rows: Array<[string, string]> = [
    ['Runtime', plan.runtime],
    ['Data', plan.data],
    ['Authority', plan.authority],
    ['Network', 'blocked'],
    ['Storage', 'blocked'],
    ['Parent DOM', 'blocked'],
    ['External assets', 'blocked'],
    ['Host tools', grants.length ? grants.join(', ') : 'none'],
    ['Visual UI', 'Arrow source only'],
    ['Persistence', plan.persistence],
    ['Approval', plan.authority === 'approval-gated' ? 'host UI required' : 'not granted'],
  ];
  for (const [label, value] of rows) {
    const cell = document.createElement('div');
    cell.className = authorityCellClass;
    cell.innerHTML = `<span class="${authorityLabelClass}">${label}</span><strong class="${authorityValueClass}">${value}</strong>`;
    authorityMeter.append(cell);
  }
}

function renderPresetNotes(): void {
  const notes = selectedPreset.notes;
  presetNotes.innerHTML = '';
  presetNotes.hidden = !notes;
  if (!notes) return;
  const setup = document.createElement('p');
  setup.className = 'm-0 text-gallery-soft';
  setup.innerHTML = `<span class="${notesKickerClass}">Setup</span><br>${notes.setup}`;
  const watch = document.createElement('div');
  const items = notes.watchFor.map((item) => `<li>${item}</li>`).join('');
  watch.innerHTML = `<span class="${notesKickerClass}">Watch for</span><ul class="${notesListClass}">${items}</ul>`;
  const takeaway = document.createElement('p');
  takeaway.className = 'm-0 font-semibold text-gallery-ink';
  takeaway.innerHTML = `<span class="${notesKickerClass}">Takeaway</span><br>${notes.takeaway}`;
  presetNotes.append(setup, watch, takeaway);
}

function renderContract(): void {
  const contract = currentSurfaceContractView;
  const grantNames = policyGrants(selectedPreset.surfacePolicy);
  const allowedHostTools = contract
    ? contract.tools.map((tool) => tool.name).join(', ') || 'none'
    : grantNames.length
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
  const toolCount = contract?.tools.length ?? grantNames.length;
  surfaceToolsPill.textContent = `${toolCount} host tool${toolCount === 1 ? '' : 's'}`;
  surfaceComponentsPill.textContent = 'Arrow-only UI';
  welcomeTitle.textContent = selectedPreset.title;
  welcomeDetail.textContent = selectedPreset.description;
  renderAuthorityMeter(compiledPolicyFor(selectedPreset));
  contractSummary.innerHTML = '';
  const rows: Array<[string, string, string]> = [
    ['provider', 'Model provider', provider ? `${provider.name} - ${generationModel}` : modelProviderLabel],
    ['utility', 'Utility model', utilityModel],
    ['policy', 'Surface config', policy],
    ['tier', 'Surface type', contract?.surface.policy.tier ?? selectedPreset.surfacePolicy.tier],
    ...(contract
      ? [['runtime', 'Runtime', `${contract.surface.mode} - ${contract.surface.plan.runtime}`] as [string, string, string]]
      : []),
    ['grants', 'Allowed host tools', allowedHostTools],
    ['ui', 'Visual UI', 'Arrow source only'],
    ...(selectedPreset.ghost
      ? [['ghost', 'Ghost root', `${selectedPreset.ghost.rootId} - ${selectedPreset.ghost.targetPath}`] as [string, string, string]]
      : []),
  ];
  for (const [key, label, value] of rows) {
    const row = document.createElement('div');
    row.className = contractRowClass;
    row.dataset.contractRow = key;
    row.innerHTML = `<span class="${contractLabelClass}">${label}</span><strong class="${contractValueClass}">${value}</strong>`;
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
      providerSummaryEl.className = statusBadgeClass(selected.configured ? 'ready' : 'missing');
    } else {
      modelProviderLabel = 'server default';
      providerSummaryEl.dataset.providerState = 'unknown';
      providerSummaryEl.className = statusBadgeClass('unknown');
    }
  } catch {
    defaultModelProviderId = null;
    modelProviders = [];
    modelProviderLabel = 'server offline';
    providerSummaryEl.dataset.providerState = 'offline';
    providerSummaryEl.className = statusBadgeClass('offline');
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
  document.getElementById('welcome-kicker')!.textContent = label;
  welcomeTitle.textContent = selectedPreset.title;
  welcomeDetail.textContent = `${lineText} The sandbox updates as structure arrives.`;
  welcome.hidden = false;
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
    row.className = eventRowClass;
    row.textContent = event;
    eventLog.append(row);
  }
}

function selectInspectorTab(tab: InspectorTab): void {
  inspectorStatusEl.textContent = inspectorTabLabel(tab);
  for (const button of inspectorTabButtons) {
    const active = button.dataset.inspectorTab === tab;
    button.className = inspectorTabClass(active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  }
  for (const panel of inspectorPanels) {
    const active = panel.dataset.inspectorPanel === tab;
    panel.className = inspectorPanelClass(active);
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

function parseSurfaceContractView(value: unknown): SurfaceContractView | null {
  if (!value || typeof value !== 'object') return null;
  const contract = value as Partial<SurfaceContractView>;
  if (!contract.surface || typeof contract.surface !== 'object') return null;
  if (!Array.isArray(contract.tools)) return null;
  if (!Array.isArray(contract.issues)) return null;
  return contract as SurfaceContractView;
}

function describeEvent(event: DevtoolsEvent): string {
  switch (event.kind) {
    case 'protocol-line':
      return `protocol ${event.line.op} ${event.line.path}`;
    case 'tool-called':
      return `host tool ${event.tool}`;
    case 'tool-dispatched':
      return `host dispatch ${event.tool}`;
    case 'tool-settled':
      return `host settled ${event.tool} ${event.ok ? 'ok' : 'error'}`;
    case 'state-pushed':
      return `state ${Object.keys(event.patch).join(', ') || 'updated'}`;
    case 'rendered':
      return `rendered revision ${event.revision}`;
    case 'surface-preview-event':
      return `preview ${(event.event as { type?: unknown }).type ?? 'event'}`;
    case 'stream-lifecycle':
      return `stream ${event.phase}${event.ok === undefined ? '' : event.ok ? ' ok' : ' error'}`;
    case 'surface-contract':
      return `contract ${(event.contract.tools?.length ?? 0)} tools`;
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

function requestHostApproval(request: ApprovalRequest): Promise<ApprovalDecision> {
  pushHostMessage(`approval pending: ${request.summary}`, { attention: true });
  return new Promise((resolve) => {
    const card = document.createElement('section');
    card.className = approvalCardClass;
    card.dataset.approvalId = request.id;
    card.dataset.approvalCard = '';

    const eyebrow = document.createElement('span');
    eyebrow.className = approvalEyebrowClass;
    eyebrow.textContent = request.tool;

    const title = document.createElement('strong');
    title.className = approvalTitleClass;
    title.textContent = request.summary;

    const meta = document.createElement('p');
    meta.className = approvalMetaClass;
    meta.textContent = `Request ${request.id}`;

    card.append(eyebrow, title, meta);

    const details = formatApprovalDetails(request.details);
    if (details) {
      const detailsEl = document.createElement('pre');
      detailsEl.className = approvalDetailsClass;
      detailsEl.textContent = details;
      card.appendChild(detailsEl);
    }

    const actions = document.createElement('div');
    actions.className = approvalActionsClass;
    const approve = document.createElement('button');
    approve.type = 'button';
    approve.className = approvalButtonClass('approve');
    approve.textContent = 'Approve';
    const deny = document.createElement('button');
    deny.type = 'button';
    deny.className = approvalButtonClass('deny');
    deny.textContent = 'Deny';
    actions.append(deny, approve);
    card.appendChild(actions);

    let settled = false;
    const finish = (decision: ApprovalDecision) => {
      if (settled) return;
      settled = true;
      pendingApprovalCards.delete(request.id);
      card.remove();
      if (approvalStack && approvalStack.childElementCount === 0) {
        approvalStack.remove();
        approvalStack = null;
      }
      resolve(decision);
    };

    approve.addEventListener('click', () => {
      pushHostMessage(`approval approved: ${request.id}`);
      finish('approved');
    });
    deny.addEventListener('click', () => {
      pushHostMessage(`approval denied: ${request.id}`, { attention: true });
      finish({ status: 'denied', reason: 'Host denied approval' });
    });

    pendingApprovalCards.set(request.id, () => finish({ status: 'denied', reason: 'Approval request was replaced' }));
    ensureApprovalStack().prepend(card);
  });
}

function ensureApprovalStack(): HTMLElement {
  if (approvalStack) return approvalStack;
  approvalStack = document.createElement('div');
  approvalStack.className = approvalStackClass;
  document.body.appendChild(approvalStack);
  return approvalStack;
}

function clearApprovalCards(reason: string): void {
  const settleCards = [...pendingApprovalCards.values()];
  pendingApprovalCards.clear();
  for (const settle of settleCards) settle();
  if (approvalStack) {
    approvalStack.remove();
    approvalStack = null;
  }
  if (settleCards.length > 0) pushHostMessage(reason, { attention: true });
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
  allComponentNames: [],
  selectPreset,
};
