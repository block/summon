import { spawnSandbox, type SandboxHandle } from '@anarchitecture/summon/browser';
import { PolicyEngine } from '@anarchitecture/summon/policy';
import {
  parseProtocolLine,
  SectionAccumulator,
  type CapabilityPack,
  type ValidationCapability,
} from '@anarchitecture/summon';
import bootstrapSource from '@anarchitecture/summon/bootstrap.js?raw';
import defaultTokensSource from '@anarchitecture/summon/tokens.css?raw';
import { ALL_PROMPTS, sample } from './prompts.js';
import { createDemoCapabilityRegistry } from './capabilities.js';

function escapeHtml(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

interface DirectionInfo {
  id: string;
  name: string;
  description: string;
  tokensCss: string;
}

type SourceMode = 'random' | 'same';
type Interactivity = 'static' | 'interactive';

/** When interactive, each tile fans out an LLM stream plus on-demand Haiku calls
 *  on intents. Cap lower than static to keep the cost/latency sane. */
const MAX_INTERACTIVE_TILES = 8;
const MAX_STATIC_TILES = 12;

const directionSel = document.getElementById('direction') as HTMLSelectElement;
const countInput = document.getElementById('count') as HTMLInputElement;
const seedInput = document.getElementById('seed') as HTMLInputElement;
const seedWrap = document.getElementById('seed-wrap')!;
const sameWrap = document.getElementById('same-wrap')!;
const samePromptEl = document.getElementById('same-prompt') as HTMLTextAreaElement;
const runBtn = document.getElementById('run') as HTMLButtonElement;
const stopBtn = document.getElementById('stop') as HTMLButtonElement;
const grid = document.getElementById('grid')!;
const summary = document.getElementById('summary')!;

let directions: DirectionInfo[] = [];
let activeAbort: AbortController | null = null;

async function loadDirections(): Promise<void> {
  try {
    const res = await fetch('/api/directions');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    directions = (await res.json()) as DirectionInfo[];
  } catch {
    directions = [];
  }
  directionSel.innerHTML = '';
  if (directions.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Default';
    directionSel.appendChild(opt);
  } else {
    for (const d of directions) {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.name;
      opt.title = d.description;
      directionSel.appendChild(opt);
    }
  }
}

function currentSourceMode(): SourceMode {
  const checked = document.querySelector<HTMLInputElement>('input[name=mode]:checked');
  return (checked?.value as SourceMode) ?? 'random';
}
function currentInteractivity(): Interactivity {
  const checked = document.querySelector<HTMLInputElement>('input[name=interactivity]:checked');
  return (checked?.value as Interactivity) ?? 'static';
}

function tokensFor(directionId: string): string {
  return directions.find((d) => d.id === directionId)?.tokensCss ?? defaultTokensSource;
}

document.querySelectorAll<HTMLInputElement>('input[name=mode]').forEach((el) => {
  el.addEventListener('change', () => {
    const m = currentSourceMode();
    seedWrap.style.display = m === 'random' ? '' : 'none';
    sameWrap.style.display = m === 'same' ? 'flex' : 'none';
  });
});

document.querySelectorAll<HTMLInputElement>('input[name=interactivity]').forEach((el) => {
  el.addEventListener('change', () => {
    // Cap count when switching to interactive to avoid surprise fan-out
    if (currentInteractivity() === 'interactive') {
      const n = Number(countInput.value) || 0;
      if (n > MAX_INTERACTIVE_TILES) countInput.value = String(MAX_INTERACTIVE_TILES);
      countInput.max = String(MAX_INTERACTIVE_TILES);
    } else {
      countInput.max = String(MAX_STATIC_TILES);
    }
  });
});

function applyLayout() {
  const val = document.querySelector<HTMLInputElement>('input[name=layout]:checked')?.value ?? 'grid';
  grid.classList.toggle('layout-grid', val === 'grid');
  grid.classList.toggle('layout-stacked', val === 'stacked');
}
document.querySelectorAll<HTMLInputElement>('input[name=layout]').forEach((el) => {
  el.addEventListener('change', applyLayout);
});
applyLayout();

interface Tile {
  prompt: string;
  statusEl: HTMLElement;
  bytesEl: HTMLElement;
  intentEl: HTMLElement;
  overlayEl: HTMLElement;
  handle: SandboxHandle;
  policy: PolicyEngine | null;
  capabilityPack: CapabilityPack | null;
  validationCapabilities: ValidationCapability[] | null;
}

let activeTiles: Tile[] = [];

function disposeTiles() {
  for (const t of activeTiles) {
    try {
      t.handle.dispose();
    } catch {
      // ignore
    }
  }
  activeTiles = [];
}

function makeTile(prompt: string, tokensCss: string, interactivity: Interactivity): Tile {
  const el = document.createElement('div');
  el.className = 'tile';

  const header = document.createElement('div');
  header.className = 'tile-header';
  const promptEl = document.createElement('div');
  promptEl.className = 'tile-prompt';
  promptEl.textContent = prompt;
  const metaEl = document.createElement('div');
  metaEl.className = 'tile-meta';
  const statusEl = document.createElement('span');
  statusEl.className = 'status pending';
  statusEl.textContent = 'pending';
  const bytesEl = document.createElement('span');
  bytesEl.textContent = '0 B';
  metaEl.append(statusEl, bytesEl);
  header.append(promptEl, metaEl);

  const intentEl = document.createElement('div');
  intentEl.className = 'tile-intent';
  header.appendChild(intentEl);

  const body = document.createElement('div');
  body.className = 'tile-body';
  const iframe = document.createElement('iframe');
  iframe.title = prompt;
  const overlayEl = document.createElement('div');
  overlayEl.className = 'tile-overlay';
  overlayEl.textContent = 'Generating…';
  body.append(iframe, overlayEl);

  el.append(header, body);
  grid.appendChild(el);

  // Per-tile policy — in interactive mode each tile owns its own handler state
  // (counters, chosen options, etc.) so actions in one tile don't bleed into another.
  let policy: PolicyEngine | null = null;
  let capabilityPack: CapabilityPack | null = null;
  let validationCapabilities: ValidationCapability[] | null = null;
  if (interactivity === 'interactive') {
    const markIntent = (msg: string, err = false) => {
      intentEl.textContent = msg;
      intentEl.classList.add('on');
      intentEl.classList.toggle('err', err);
    };
    const registry = createDemoCapabilityRegistry({
      onLog: (m) => markIntent(m, false),
      onError: (m) => markIntent(m, true),
    }).without(['summon']);
    const contract = registry.toContract();
    capabilityPack = contract.pack;
    validationCapabilities = contract.validationCapabilities;
    policy = new PolicyEngine({
      initialState: contract.initialState,
      handlers: registry.toPolicyHandlers(),
      onStateChange: (state) => {
        if (handleRef.current) handleRef.current.pushState(state);
      },
      onHandlerError: (intent, error) => {
        markIntent(`handler error (${intent}): ${error.message}`, true);
      },
    });
  }

  // Capture handle in a ref so onStateChange can reach it without TDZ issues.
  const handleRef: { current: SandboxHandle | null } = { current: null };

  const handle = spawnSandbox({
    iframe,
    artifact: {
      intents: policy?.intents ?? [],
      capabilities: validationCapabilities ?? undefined,
      html: '',
      initialState: policy?.getState(),
    },
    // Per-tile grant comes from the per-tile engine the host built — never
    // from the artifact, so a generated tile can't broaden its own access.
    grantedIntents: policy?.intents ?? [],
    grantedCapabilities: validationCapabilities ?? undefined,
    bootstrapSource,
    tokensSource: tokensCss,
    onIntent: (intent, args) => {
      void policy?.dispatch(intent, args);
    },
    onIntentRejected: (reason) => {
      intentEl.textContent = `rejected: ${reason}`;
      intentEl.classList.add('on', 'err');
    },
  });
  handleRef.current = handle;

  return {
    prompt,
    statusEl,
    bytesEl,
    intentEl,
    overlayEl,
    handle,
    policy,
    capabilityPack,
    validationCapabilities,
  };
}

async function runOne(
  tile: Tile,
  directionId: string,
  interactivity: Interactivity,
  signal: AbortSignal,
): Promise<{ ok: boolean; bytes: number; ms: number }> {
  const acc = new SectionAccumulator();
  const start = performance.now();
  let bytes = 0;
  tile.statusEl.className = 'status streaming';
  tile.statusEl.textContent = 'streaming';
  tile.overlayEl.classList.toggle('on', interactivity === 'interactive');

  // Interactive = batched render (scripts need full DOM). Static = live paint.
  const renderIncrementally = interactivity === 'static';

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: tile.prompt,
        directionId,
        mode: interactivity,
        capabilities: interactivity === 'interactive' ? tile.capabilityPack : undefined,
      }),
      signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const reader = res.body?.getReader();
    if (!reader) throw new Error('no body');

    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      tile.bytesEl.textContent = `${bytes.toLocaleString()} B`;
      buffer += decoder.decode(value, { stream: true });
      let nl = buffer.indexOf('\n');
      while (nl !== -1) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        const parsed = parseProtocolLine(line);
        if (parsed) {
          const changed = acc.apply(parsed);
          if (renderIncrementally && changed && acc.hasAnySection()) {
            tile.handle.render(acc.compose());
          }
        }
        nl = buffer.indexOf('\n');
      }
    }
    const tail = buffer.trim();
    if (tail) {
      const parsed = parseProtocolLine(tail);
      if (parsed) {
        const changed = acc.apply(parsed);
        if (renderIncrementally && changed && acc.hasAnySection()) {
          tile.handle.render(acc.compose());
        }
      }
    }

    // Batched render for interactive — scripts get the full DOM in one shot.
    if (!renderIncrementally && acc.hasAnySection()) {
      tile.handle.render(acc.compose());
    }

    tile.overlayEl.classList.remove('on');

    const ms = Math.round(performance.now() - start);
    tile.statusEl.className = 'status done';
    tile.statusEl.textContent = `${(ms / 1000).toFixed(1)}s`;
    tile.bytesEl.textContent = `${bytes.toLocaleString()} B`;
    return { ok: true, bytes, ms };
  } catch (err) {
    tile.overlayEl.classList.remove('on');
    if ((err as Error).name === 'AbortError') {
      tile.statusEl.className = 'status error';
      tile.statusEl.textContent = 'aborted';
      return { ok: false, bytes, ms: Math.round(performance.now() - start) };
    }
    const msg = err instanceof Error ? err.message : String(err);
    tile.statusEl.className = 'status error';
    tile.statusEl.textContent = `error: ${msg.slice(0, 40)}`;
    return { ok: false, bytes, ms: Math.round(performance.now() - start) };
  }
}

async function run() {
  // Dispose prior tiles (clean up message listeners) before clearing the grid.
  disposeTiles();
  grid.innerHTML = '';

  const directionId = directionSel.value;
  const interactivity = currentInteractivity();
  const cap = interactivity === 'interactive' ? MAX_INTERACTIVE_TILES : MAX_STATIC_TILES;
  const count = Math.max(1, Math.min(cap, Number(countInput.value) || 1));
  const sourceMode = currentSourceMode();

  let prompts: string[];
  if (sourceMode === 'same') {
    const p = samePromptEl.value.trim();
    if (!p) {
      summary.textContent = 'Enter a prompt for Same mode.';
      return;
    }
    prompts = new Array(count).fill(p);
  } else {
    const seedStr = seedInput.value.trim();
    const seed = seedStr ? Number(seedStr) : ((Date.now() & 0x7fffffff) | 0);
    if (!seedStr) seedInput.placeholder = String(seed);
    prompts = sample(ALL_PROMPTS, count, seed);
    summary.textContent = `Running ${count} (${interactivity}) with seed ${seed}…`;
  }

  const tokensCss = tokensFor(directionId);
  const tiles = prompts.map((p) => makeTile(p, tokensCss, interactivity));
  activeTiles = tiles;

  activeAbort = new AbortController();
  runBtn.disabled = true;
  stopBtn.disabled = false;

  const runStart = performance.now();
  const results = await Promise.all(
    tiles.map((t) => runOne(t, directionId, interactivity, activeAbort!.signal)),
  );
  const wall = Math.round(performance.now() - runStart);

  const ok = results.filter((r) => r.ok).length;
  const failed = results.length - ok;
  const totalBytes = results.reduce((a, r) => a + r.bytes, 0);
  const avgMs = Math.round(results.reduce((a, r) => a + r.ms, 0) / results.length);
  const seedNote =
    sourceMode === 'random' ? ` · seed ${escapeHtml(seedInput.value || seedInput.placeholder)}` : '';
  const modeNote = interactivity === 'interactive' ? ' · interactive' : '';
  summary.innerHTML = `Done in <b>${(wall / 1000).toFixed(1)}s</b> wall. ${ok} ok · ${failed} failed · avg per-tile ${(avgMs / 1000).toFixed(1)}s · ${totalBytes.toLocaleString()} bytes total${modeNote}${seedNote}.`;

  runBtn.disabled = false;
  stopBtn.disabled = true;
  activeAbort = null;
}

runBtn.addEventListener('click', () => {
  void run();
});
stopBtn.addEventListener('click', () => {
  activeAbort?.abort();
});

void loadDirections();
