import {
  consumeSurfaceStream,
  spawnSandbox,
  type SandboxHandle,
} from '@anarchitecture/summon/browser';
import type {
  ProtocolLine,
  StreamGraphSnapshot,
  SurfaceCeiling,
  SurfacePlan,
} from '@anarchitecture/summon/engine';
import bootstrapSource from '@anarchitecture/summon/bootstrap.js?raw';
import tokensSource from '@anarchitecture/summon/tokens.css?raw';

type FragmentSide = 'section' | 'block-v0';

interface CompareTarget {
  side: FragmentSide;
  frame: HTMLIFrameElement;
  statusEl: HTMLElement;
  metricsEl: HTMLElement;
  logEl: HTMLElement;
  handle: SandboxHandle | null;
  lines: number;
  bytes: number;
  startedAt: number;
}

const form = document.getElementById('compare-form') as HTMLFormElement;
const promptEl = document.getElementById('prompt') as HTMLTextAreaElement;
const runBtn = document.getElementById('run') as HTMLButtonElement;
const stopBtn = document.getElementById('stop') as HTMLButtonElement;
const summaryEl = document.getElementById('summary')!;

const targets: CompareTarget[] = [
  {
    side: 'section',
    frame: document.getElementById('section-frame') as HTMLIFrameElement,
    statusEl: document.getElementById('section-status')!,
    metricsEl: document.getElementById('section-metrics')!,
    logEl: document.getElementById('section-log')!,
    handle: null,
    lines: 0,
    bytes: 0,
    startedAt: 0,
  },
  {
    side: 'block-v0',
    frame: document.getElementById('block-frame') as HTMLIFrameElement,
    statusEl: document.getElementById('block-status')!,
    metricsEl: document.getElementById('block-metrics')!,
    logEl: document.getElementById('block-log')!,
    handle: null,
    lines: 0,
    bytes: 0,
    startedAt: 0,
  },
];

const surfacePlan: SurfacePlan = {
  purpose: 'review',
  runtime: 'static',
  data: 'embedded',
  authority: 'none',
  persistence: 'replayable',
};

const surfaceCeiling: SurfaceCeiling = {
  purposes: ['review'],
  runtimes: ['static'],
  data: ['embedded'],
  authorities: ['none'],
  persistences: ['replayable'],
};

let activeAbort: AbortController | null = null;

function resetTarget(target: CompareTarget): void {
  target.handle?.dispose();
  target.handle = spawnSandbox({
    iframe: target.frame,
    artifact: { html: '', intents: [] },
    grantedIntents: [],
    bootstrapSource,
    tokensSource,
  });
  target.lines = 0;
  target.bytes = 0;
  target.startedAt = performance.now();
  target.logEl.innerHTML = '';
  setStatus(target, 'idle');
  updateMetrics(target);
}

function setStatus(target: CompareTarget, status: string): void {
  target.statusEl.textContent = status;
  target.statusEl.dataset.status = status;
}

function logLine(target: CompareTarget, cls: string, text: string): void {
  const row = document.createElement('div');
  row.className = cls;
  row.textContent = text;
  target.logEl.appendChild(row);
  while (target.logEl.childElementCount > 140) {
    target.logEl.firstElementChild?.remove();
  }
  target.logEl.scrollTop = target.logEl.scrollHeight;
}

function updateMetrics(target: CompareTarget, graph?: StreamGraphSnapshot): void {
  const sections = graph?.sections ?? [];
  const presentSections = sections.filter((section) => section.present).length;
  const declaredBlocks = sections.reduce((sum, section) => sum + (section.declaredBlockCount ?? 0), 0);
  const presentBlocks = sections.reduce((sum, section) => sum + (section.presentBlockCount ?? 0), 0);
  const blockPart = target.side === 'block-v0'
    ? ` · ${presentBlocks}/${declaredBlocks} blocks`
    : '';
  target.metricsEl.textContent = `${target.lines} lines · ${target.bytes.toLocaleString()} B · ${presentSections} sections${blockPart}`;
}

function lineClass(line: ProtocolLine): string {
  if (line.op === 'add') return 'op-add';
  if (line.op === 'set') return 'op-set';
  return 'op-meta';
}

async function* countedStream(
  stream: ReadableStream<Uint8Array>,
  target: CompareTarget,
): AsyncGenerator<Uint8Array, void, void> {
  const reader = stream.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return;
      if (value) {
        target.bytes += value.byteLength;
        updateMetrics(target);
        yield value;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function runTarget(target: CompareTarget, prompt: string, signal: AbortSignal): Promise<void> {
  resetTarget(target);
  setStatus(target, 'starting');
  logLine(target, 'info', target.side === 'block-v0' ? 'POST /api/generate fragmentMode=block-v0' : 'POST /api/generate fragmentMode=section');

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        mode: 'static',
        surfacePlan,
        surfaceCeiling,
        scriptPolicy: 'forbid',
        ...(target.side === 'block-v0' ? { fragmentMode: 'block-v0' } : {}),
      }),
      signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (!res.body) throw new Error('No response body');

    setStatus(target, 'streaming');
    const result = await consumeSurfaceStream(countedStream(res.body, target), {
      mode: 'static',
      renderMode: 'live',
      onLine: (line, context) => {
        target.lines += 1;
        updateMetrics(target, context.graph.snapshot());
        logLine(target, lineClass(line), `${line.op} ${line.path}`);
      },
      onMeta: (line) => {
        if (line.path === '/experimental-fragments') {
          logLine(target, 'info', `experimental ${JSON.stringify(line.value)}`);
        }
        if (line.path === '/validation-blocked' || line.path === '/protocol-skip') {
          logLine(target, 'op-error', `${line.path} ${JSON.stringify(line.value)}`);
        }
      },
      onGraph: (graph) => {
        updateMetrics(target, graph);
      },
      onRenderHtml: (html) => {
        target.handle?.render(html);
      },
      onParseError: (raw) => {
        logLine(target, 'op-error', `parse ${raw.slice(0, 120)}`);
      },
    });

    const elapsed = ((performance.now() - target.startedAt) / 1000).toFixed(1);
    setStatus(target, `done ${elapsed}s`);
    updateMetrics(target, result.streamGraph);
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      setStatus(target, 'aborted');
      logLine(target, 'op-error', 'aborted');
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    setStatus(target, 'error');
    logLine(target, 'op-error', message);
  }
}

async function runBoth(): Promise<void> {
  activeAbort?.abort();
  activeAbort = new AbortController();
  runBtn.disabled = true;
  stopBtn.disabled = false;
  summaryEl.textContent = 'Running both streams';

  const prompt = promptEl.value.trim();
  if (!prompt) {
    summaryEl.textContent = 'Add a prompt first';
    runBtn.disabled = false;
    stopBtn.disabled = true;
    return;
  }

  await Promise.all(targets.map((target) => runTarget(target, prompt, activeAbort!.signal)));
  const finished = targets.every((target) => target.statusEl.textContent?.startsWith('done'));
  summaryEl.textContent = finished ? 'Both streams complete' : 'Run stopped or failed';
  runBtn.disabled = false;
  stopBtn.disabled = true;
  activeAbort = null;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  void runBoth();
});

stopBtn.addEventListener('click', () => {
  activeAbort?.abort();
});

for (const target of targets) {
  resetTarget(target);
}
