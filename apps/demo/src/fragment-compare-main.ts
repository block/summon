import {
  consumeSurfaceStream,
  spawnSandbox,
  type SandboxHandle,
} from '@anarchitecture/summon/browser';
import type {
  HtmlNodePatch,
  ProtocolLine,
  StreamGraphSnapshot,
} from '@anarchitecture/summon/engine';
import bootstrapSource from '@anarchitecture/summon/bootstrap.js?raw';
import tokensSource from '@anarchitecture/summon/tokens.css?raw';

type FragmentSide = 'section' | 'html-node-v0';
type PromptComplexity = 'simple' | 'medium' | 'complex';
type PromptUseCase = 'status' | 'decision' | 'operations' | 'customer';

interface PromptPreset {
  id: string;
  useCase: PromptUseCase;
  complexity: PromptComplexity;
  title: string;
  prompt: string;
}

interface CompareTarget {
  side: FragmentSide;
  frame: HTMLIFrameElement;
  statusEl: HTMLElement;
  metricsEl: HTMLElement;
  logEl: HTMLElement;
  handle: SandboxHandle | null;
  lines: number;
  bytes: number;
  nodeCommits: number;
  firstNodeAt: number | null;
  latestGraph: StreamGraphSnapshot | null;
  startedAt: number;
}

const form = document.getElementById('compare-form') as HTMLFormElement;
const promptEl = document.getElementById('prompt') as HTMLTextAreaElement;
const presetMatrixEl = document.getElementById('prompt-preset-matrix')!;
const runBtn = document.getElementById('run') as HTMLButtonElement;
const stopBtn = document.getElementById('stop') as HTMLButtonElement;
const summaryEl = document.getElementById('summary')!;

const promptComplexities: Array<{ id: PromptComplexity; label: string }> = [
  { id: 'simple', label: 'Simple' },
  { id: 'medium', label: 'Medium' },
  { id: 'complex', label: 'Complex' },
];

const promptUseCases: Array<{ id: PromptUseCase; label: string; description: string }> = [
  {
    id: 'status',
    label: 'Status surfaces',
    description: 'Dashboards, recaps, health checks',
  },
  {
    id: 'decision',
    label: 'Decision briefs',
    description: 'Tradeoffs, comparisons, recommendations',
  },
  {
    id: 'operations',
    label: 'Operational workflows',
    description: 'Triage, control rooms, execution plans',
  },
  {
    id: 'customer',
    label: 'Customer follow-up',
    description: 'Merchant notes, outreach, account plans',
  },
];

const promptPresets: PromptPreset[] = [
  {
    id: 'status-simple-launch-pulse',
    useCase: 'status',
    complexity: 'simple',
    title: 'Launch Pulse',
    prompt: 'Show me a clean end-of-day sales snapshot for a coffee shop.',
  },
  {
    id: 'status-medium-shift-recap',
    useCase: 'status',
    complexity: 'medium',
    title: 'Shift Recap',
    prompt: 'Show me a weekly cafe performance recap with sales, staffing, inventory, customer sentiment, and next actions.',
  },
  {
    id: 'status-complex-portfolio-review',
    useCase: 'status',
    complexity: 'complex',
    title: 'Portfolio Review',
    prompt: 'Show me a quarterly portfolio review across five product initiatives, including progress, spend, adoption, dependencies, risks, staffing pressure, decisions needed, and an executive verdict.',
  },
  {
    id: 'decision-simple-vendor-pick',
    useCase: 'decision',
    complexity: 'simple',
    title: 'Vendor Pick',
    prompt: 'Compare two weekend promo ideas for a coffee shop and recommend one.',
  },
  {
    id: 'decision-medium-roadmap-tradeoff',
    useCase: 'decision',
    complexity: 'medium',
    title: 'Roadmap Tradeoff',
    prompt: 'Compare three checkout roadmap bets with customer impact, engineering effort, risk, confidence, and a recommendation.',
  },
  {
    id: 'decision-complex-pricing-strategy',
    useCase: 'decision',
    complexity: 'complex',
    title: 'Pricing Strategy',
    prompt: 'Show me a pricing strategy decision room for a SaaS billing change, with rollout options, revenue forecast, churn risk, merchant segments, support impact, confidence, and an executive recommendation.',
  },
  {
    id: 'operations-simple-support-snapshot',
    useCase: 'operations',
    complexity: 'simple',
    title: 'Support Snapshot',
    prompt: 'Make a packing checklist for a Saturday pop-up booth.',
  },
  {
    id: 'operations-medium-incident-command',
    useCase: 'operations',
    complexity: 'medium',
    title: 'Incident Command',
    prompt: 'Show me a triage board for today\'s support queue, with priority groups, aging tickets, escalations, owners, and next actions.',
  },
  {
    id: 'operations-complex-migration-control',
    useCase: 'operations',
    complexity: 'complex',
    title: 'Migration Control',
    prompt: 'Show me a migration control room for moving 42 merchants from a legacy invoicing workflow to a new billing platform, including cohorts, blockers, data quality checks, support load, rollback criteria, comms, and day-by-day execution plan.',
  },
  {
    id: 'customer-simple-sales-note',
    useCase: 'customer',
    complexity: 'simple',
    title: 'Sales Note',
    prompt: 'Draft a follow-up note after a restaurant POS demo.',
  },
  {
    id: 'customer-medium-renewal-prep',
    useCase: 'customer',
    complexity: 'medium',
    title: 'Renewal Prep',
    prompt: 'Prepare a renewal prep brief for a neighborhood grocer, with usage wins, adoption gaps, billing concerns, stakeholders, risks, and meeting goals.',
  },
  {
    id: 'customer-complex-save-plan',
    useCase: 'customer',
    complexity: 'complex',
    title: 'Account Save Plan',
    prompt: 'Show me a 30-day save plan for an at-risk enterprise merchant, with account health, executive relationships, product pain, support history, commercial exposure, competitive threat, negotiation plan, and timeline.',
  },
];

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
    nodeCommits: 0,
    firstNodeAt: null,
    latestGraph: null,
    startedAt: 0,
  },
  {
    side: 'html-node-v0',
    frame: document.getElementById('block-frame') as HTMLIFrameElement,
    statusEl: document.getElementById('block-status')!,
    metricsEl: document.getElementById('block-metrics')!,
    logEl: document.getElementById('block-log')!,
    handle: null,
    lines: 0,
    bytes: 0,
    nodeCommits: 0,
    firstNodeAt: null,
    latestGraph: null,
    startedAt: 0,
  },
];

const modelOptions = {
  maxOutputTokens: 16000,
  repairMaxOutputTokens: 4000,
  anthropicThinking: 'off',
  effort: 'low',
} as const;

const blankDarkArtifact =
  '<style>html,body{min-height:100%;margin:0;background:#000;color:oklch(0.96 0.003 264)}</style>';

let activeAbort: AbortController | null = null;
let activePresetId: string | null = null;

function renderPromptMatrix(): void {
  presetMatrixEl.textContent = '';

  const corner = document.createElement('div');
  corner.className = 'compare-preset-corner';
  corner.textContent = 'Use case';
  presetMatrixEl.appendChild(corner);

  for (const complexity of promptComplexities) {
    const column = document.createElement('div');
    column.className = 'compare-preset-column';
    column.textContent = complexity.label;
    presetMatrixEl.appendChild(column);
  }

  for (const useCase of promptUseCases) {
    const label = document.createElement('div');
    label.className = 'compare-preset-usecase';

    const title = document.createElement('span');
    title.className = 'compare-preset-usecase-label';
    title.textContent = useCase.label;

    const description = document.createElement('span');
    description.className = 'compare-preset-usecase-desc';
    description.textContent = useCase.description;

    label.append(title, description);
    presetMatrixEl.appendChild(label);

    for (const complexity of promptComplexities) {
      const preset = promptPresets.find(
        (candidate) => candidate.useCase === useCase.id && candidate.complexity === complexity.id,
      );
      if (!preset) continue;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'compare-preset-button';
      button.dataset.presetId = preset.id;
      button.dataset.complexity = complexity.id;
      button.setAttribute('aria-label', `${useCase.label}, ${complexity.label}: ${preset.title}`);
      if (preset.id === activePresetId) button.dataset.active = 'true';

      const presetTitle = document.createElement('span');
      presetTitle.className = 'compare-preset-title';
      presetTitle.textContent = preset.title;
      const preview = document.createElement('span');
      preview.className = 'compare-preset-preview';
      preview.textContent = preset.prompt;
      button.append(presetTitle, preview);

      button.addEventListener('click', () => {
        activePresetId = preset.id;
        promptEl.value = preset.prompt;
        renderPromptMatrix();
        promptEl.focus();
      });
      presetMatrixEl.appendChild(button);
    }
  }
}

function syncActivePresetFromPrompt(): void {
  const match = promptPresets.find((preset) => preset.prompt === promptEl.value);
  activePresetId = match?.id ?? null;
  renderPromptMatrix();
}

function resetTarget(target: CompareTarget): void {
  target.handle?.dispose();
  target.handle = spawnSandbox({
    iframe: target.frame,
    artifact: { html: blankDarkArtifact, intents: [] },
    grantedIntents: [],
    bootstrapSource,
    tokensSource,
  });
  target.lines = 0;
  target.bytes = 0;
  target.nodeCommits = 0;
  target.firstNodeAt = null;
  target.latestGraph = null;
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
  if (graph) target.latestGraph = graph;
  const sections = (graph ?? target.latestGraph)?.sections ?? [];
  const presentSections = sections.filter((section) => section.present).length;
  const presentNodes = sections.reduce((sum, section) => sum + (section.presentNodeCount ?? 0), 0);
  const nodePart = target.side === 'html-node-v0'
    ? ` · ${presentNodes} nodes · ${target.nodeCommits} patches${target.firstNodeAt === null ? '' : ` · first ${(target.firstNodeAt / 1000).toFixed(1)}s`}`
    : '';
  target.metricsEl.textContent = `${target.lines} lines · ${target.bytes.toLocaleString()} B · ${presentSections} sections${nodePart}`;
}

function lineClass(line: ProtocolLine): string {
  if (line.op === 'add') return 'op-add';
  if (line.op === 'set') return 'op-set';
  return 'op-meta';
}

function lineLabel(line: ProtocolLine): string {
  if (line.op === 'meta' && line.path === '/agent-intent') {
    return `agent intent ${agentMetaLabel(line.value)}`;
  }
  if (line.op === 'meta' && line.path === '/agent-policy-resolution') {
    return `agent policy ${agentMetaLabel(line.value)}`;
  }
  if (line.op === 'meta' && line.path === '/status') {
    return `meta /status ${String(line.value)}`;
  }
  if (line.op === 'meta' && line.path === '/thinking') {
    return 'meta /thinking ...';
  }
  if (line.op === 'add' && line.path.includes('/node/')) {
    return `${line.op} ${line.path}${line.parent ? ` parent=${line.parent}` : ''}`;
  }
  return `${line.op} ${line.path}`;
}

function agentMetaLabel(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const item = value as Record<string, unknown>;
  const policy = item.surfacePolicy && typeof item.surfacePolicy === 'object'
    ? item.surfacePolicy as Record<string, unknown>
    : null;
  if (policy) {
    const tier = typeof policy.tier === 'string' ? policy.tier : 'policy';
    const purpose = typeof policy.purpose === 'string' ? policy.purpose : 'inform';
    return `${tier}/${purpose}`;
  }
  const purpose = typeof item.purpose === 'string' ? item.purpose : 'intent';
  const interaction = typeof item.interaction === 'string' ? item.interaction : 'none';
  return `${purpose}/${interaction}`;
}

function applyNodePatch(target: CompareTarget, patch: HtmlNodePatch): void {
  if (target.firstNodeAt === null) {
    target.firstNodeAt = performance.now() - target.startedAt;
  }
  target.nodeCommits += 1;
  target.handle?.patchNode(patch);
  logLine(target, 'op-add', `patch node ${patch.sectionId}/${patch.nodeId}${patch.parentId ? ` parent=${patch.parentId}` : ''}`);
  updateMetrics(target);
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
  logLine(target, 'info', target.side === 'html-node-v0' ? 'POST /api/generate fragmentMode=html-node-v0' : 'POST /api/generate fragmentMode=section');

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        directionId: '',
        mode: 'static',
        modelOptions,
        agent: { enabled: true },
        scriptPolicy: 'forbid',
        ...(target.side === 'html-node-v0' ? { fragmentMode: 'html-node-v0' } : {}),
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
        logLine(target, lineClass(line), lineLabel(line));
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
      onNodePatch: (patch) => {
        applyNodePatch(target, patch);
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

promptEl.addEventListener('input', () => {
  const match = promptPresets.find((preset) => preset.prompt === promptEl.value);
  activePresetId = match?.id ?? null;
  renderPromptMatrix();
});

syncActivePresetFromPrompt();

for (const target of targets) {
  resetTarget(target);
}
