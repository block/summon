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
  findPreset,
  policyComponents,
  policyGrants,
  policyText,
  type GalleryPreset,
} from './presets.js';
import './styles.css';

const presetList = document.getElementById('preset-list')!;
const presetCategory = document.getElementById('preset-category')!;
const presetTitle = document.getElementById('preset-title')!;
const presetDescription = document.getElementById('preset-description')!;
const promptEl = document.getElementById('prompt') as HTMLTextAreaElement;
const runButton = document.getElementById('run') as HTMLButtonElement;
const iframe = document.getElementById('sandbox') as HTMLIFrameElement;
const welcome = document.getElementById('welcome')!;
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

let selectedPreset = GALLERY_PRESETS[0]!;
let handle: SandboxHandle | null = null;
let islands: ComponentIslandRegistry | null = null;
let policy: PolicyEngine | null = null;
let abortController: AbortController | null = null;
let acceptedStructuralLines = 0;
let skippedLines = 0;
let blockedLines = 0;

events.subscribe(renderEvents);

renderPresetCards();
selectPreset(selectedPreset.id);

runButton.addEventListener('click', () => {
  void generateSelectedSurface();
});

function renderPresetCards(): void {
  presetList.innerHTML = '';
  for (const preset of GALLERY_PRESETS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'preset-card';
    button.dataset.presetId = preset.id;
    button.innerHTML = `
      <span>${preset.category}</span>
      <strong>${preset.title}</strong>
      <em>${policyText(preset.surfacePolicy)}</em>
      <small>${preset.description}</small>
    `;
    button.addEventListener('click', () => selectPreset(preset.id));
    presetList.append(button);
  }
}

function selectPreset(id: string): void {
  selectedPreset = findPreset(id);
  for (const card of presetList.querySelectorAll<HTMLButtonElement>('.preset-card')) {
    card.classList.toggle('active', card.dataset.presetId === selectedPreset.id);
  }
  presetCategory.textContent = selectedPreset.category;
  presetTitle.textContent = selectedPreset.title;
  presetDescription.textContent = selectedPreset.description;
  promptEl.value = selectedPreset.prompt;
  resetCounters();
  respawnSandbox();
  renderContract();
  renderHealth('idle');
  setSetupNote(null);
  welcome.classList.remove('hidden');
}

function respawnSandbox(): void {
  islands?.destroy();
  islands = null;
  handle?.dispose();
  handle = null;
  policy = null;

  const compiledPolicy = compiledPolicyFor(selectedPreset);
  const capabilityRegistry = createGalleryCapabilityRegistry(compiledPolicy.policy.grants, {
    onLog: pushHostMessage,
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
        pushHostMessage(`component ${error.code}: ${error.reason}`);
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
        pushHostMessage(`handler ${intent}: ${error.message}`);
      },
    });
  }

  handle = spawnSandbox({
    iframe,
    artifact: {
      html: '',
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
    tokensSource,
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
  welcome.classList.add('hidden');
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
        surfacePolicy: selectedPreset.surfacePolicy,
        capabilities: capabilityPack,
        ...(componentPack ? { components: componentPack } : {}),
      }),
    });

    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => '');
      throw new Error(text || `Generation server returned ${response.status}`);
    }

    await consumeSurfaceStream(response.body, {
      mode: compiledPolicy.mode,
      accumulator,
      onLine: (line, context) => handleLine(line, context),
      onMeta: (line) => handleMeta(line),
      onRenderHtml: (html) => {
        handle?.render(html);
      },
      onParseError: (raw) => {
        events.push({ kind: 'protocol-parse-error', at: Date.now(), raw });
      },
    });
    events.push({ kind: 'stream-lifecycle', at: Date.now(), phase: 'end', ok: true });
    renderHealth('done');
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    const message = error instanceof Error ? error.message : String(error);
    renderHealth('setup needed');
    events.push({ kind: 'stream-lifecycle', at: Date.now(), phase: 'end', ok: false });
    setSetupNote(
      `Live generation needs the demo server. Run pnpm dev:gallery and set ANTHROPIC_API_KEY in apps/server/.env. ${message}`,
    );
  } finally {
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
  }
  if (line.path === '/stream-graph-summary') {
    const value = line.value as { health?: { blockedCount?: unknown; skippedCount?: unknown } };
    if (typeof value.health?.blockedCount === 'number') blockedLines = value.health.blockedCount;
    if (typeof value.health?.skippedCount === 'number') skippedLines = value.health.skippedCount;
  }
  skippedCountEl.textContent = String(skippedLines);
  blockedCountEl.textContent = String(blockedLines);
}

function renderContract(): void {
  const components = policyComponents(selectedPreset.surfacePolicy).length
    ? policyComponents(selectedPreset.surfacePolicy).join(', ')
    : 'none';
  const grants = policyGrants(selectedPreset.surfacePolicy).length
    ? policyGrants(selectedPreset.surfacePolicy).join(', ')
    : 'none';
  contractSummary.innerHTML = '';
  const rows: Array<[string, string]> = [
    ['Policy', policyText(selectedPreset.surfacePolicy)],
    ['Tier', selectedPreset.surfacePolicy.tier],
    ['Grants', grants],
    ['Components', components],
  ];
  for (const [label, value] of rows) {
    const row = document.createElement('div');
    row.className = 'contract-row';
    row.dataset.contractRow = label.toLowerCase();
    row.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    contractSummary.append(row);
  }
}

function renderHealth(status: string): void {
  statusEl.textContent = status;
  acceptedCountEl.textContent = String(acceptedStructuralLines);
  skippedCountEl.textContent = String(skippedLines);
  blockedCountEl.textContent = String(blockedLines);
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

function describeEvent(event: DevtoolsEvent): string {
  switch (event.kind) {
    case 'protocol-line':
      return `protocol ${event.line.op} ${event.line.path}`;
    case 'intent-emitted':
      return `intent ${event.intent}`;
    case 'intent-dispatched':
      return `dispatch ${event.intent}`;
    case 'intent-settled':
      return `settled ${event.intent} ${event.ok ? 'ok' : 'error'}`;
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

function pushHostMessage(message: string): void {
  hostMessages.push(message);
  if (hostMessages.length > 30) hostMessages.splice(0, hostMessages.length - 30);
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
