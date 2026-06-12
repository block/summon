import { useCallback, useEffect, useRef, useState } from 'react';
import { SummonSurface, type SummonSurfaceHandle } from '@anarchitecture/summon-react';
import { consumeSurfaceStream } from '@anarchitecture/summon/browser';
import type {
  HtmlNodePatch,
  ProtocolLine,
  StreamGraphSnapshot,
} from '@anarchitecture/summon/engine';
import tokensSource from '@anarchitecture/summon/tokens.css?raw';
import { AppNav, LogView, PageHeader } from '../components/chrome.js';

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

interface TargetMetrics {
  lines: number;
  bytes: number;
  nodeCommits: number;
  firstNodeAt: number | null;
  graph: StreamGraphSnapshot | null;
}

const promptComplexities: Array<{ id: PromptComplexity; label: string }> = [
  { id: 'simple', label: 'Simple' },
  { id: 'medium', label: 'Medium' },
  { id: 'complex', label: 'Complex' },
];

const promptUseCases: Array<{ id: PromptUseCase; label: string; description: string }> = [
  { id: 'status', label: 'Status surfaces', description: 'Dashboards, recaps, health checks' },
  { id: 'decision', label: 'Decision briefs', description: 'Tradeoffs, comparisons, recommendations' },
  { id: 'operations', label: 'Operational workflows', description: 'Triage, control rooms, execution plans' },
  { id: 'customer', label: 'Customer follow-up', description: 'Merchant notes, outreach, account plans' },
];

const promptPresets: PromptPreset[] = [
  { id: 'status-simple-launch-pulse', useCase: 'status', complexity: 'simple', title: 'Launch Pulse', prompt: 'Show me a clean end-of-day sales snapshot for a coffee shop.' },
  { id: 'status-medium-shift-recap', useCase: 'status', complexity: 'medium', title: 'Shift Recap', prompt: 'Show me a weekly cafe performance recap with sales, staffing, inventory, customer sentiment, and next actions.' },
  { id: 'status-complex-portfolio-review', useCase: 'status', complexity: 'complex', title: 'Portfolio Review', prompt: 'Show me a quarterly portfolio review across five product initiatives, including progress, spend, adoption, dependencies, risks, staffing pressure, decisions needed, and an executive verdict.' },
  { id: 'decision-simple-vendor-pick', useCase: 'decision', complexity: 'simple', title: 'Vendor Pick', prompt: 'Compare two weekend promo ideas for a coffee shop and recommend one.' },
  { id: 'decision-medium-roadmap-tradeoff', useCase: 'decision', complexity: 'medium', title: 'Roadmap Tradeoff', prompt: 'Compare three checkout roadmap bets with customer impact, engineering effort, risk, confidence, and a recommendation.' },
  { id: 'decision-complex-pricing-strategy', useCase: 'decision', complexity: 'complex', title: 'Pricing Strategy', prompt: 'Show me a pricing strategy decision room for a SaaS billing change, with rollout options, revenue forecast, churn risk, merchant segments, support impact, confidence, and an executive recommendation.' },
  { id: 'operations-simple-support-snapshot', useCase: 'operations', complexity: 'simple', title: 'Support Snapshot', prompt: 'Make a packing checklist for a Saturday pop-up booth.' },
  { id: 'operations-medium-incident-command', useCase: 'operations', complexity: 'medium', title: 'Incident Command', prompt: 'Show me a triage board for today\'s support queue, with priority groups, aging tickets, escalations, owners, and next actions.' },
  { id: 'operations-complex-migration-control', useCase: 'operations', complexity: 'complex', title: 'Migration Control', prompt: 'Show me a migration control room for moving 42 merchants from a legacy invoicing workflow to a new billing platform, including cohorts, blockers, data quality checks, support load, rollback criteria, comms, and day-by-day execution plan.' },
  { id: 'customer-simple-sales-note', useCase: 'customer', complexity: 'simple', title: 'Sales Note', prompt: 'Draft a follow-up note after a restaurant POS demo.' },
  { id: 'customer-medium-renewal-prep', useCase: 'customer', complexity: 'medium', title: 'Renewal Prep', prompt: 'Prepare a renewal prep brief for a neighborhood grocer, with usage wins, adoption gaps, billing concerns, stakeholders, risks, and meeting goals.' },
  { id: 'customer-complex-save-plan', useCase: 'customer', complexity: 'complex', title: 'Account Save Plan', prompt: 'Show me a 30-day save plan for an at-risk enterprise merchant, with account health, executive relationships, product pain, support history, commercial exposure, competitive threat, negotiation plan, and timeline.' },
];

const modelOptions = {
  maxOutputTokens: 16000,
  repairMaxOutputTokens: 4000,
  anthropicThinking: 'off',
  effort: 'low',
} as const;

const blankDarkArtifact =
  '<style>html,body{min-height:100%;margin:0;background:#000;color:oklch(0.96 0.003 264)}</style>';

function lineClass(line: ProtocolLine): string {
  if (line.op === 'add') return 'op-add';
  if (line.op === 'set') return 'op-set';
  return 'op-meta';
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

function lineLabel(line: ProtocolLine): string {
  if (line.op === 'meta' && line.path === '/agent-intent') return `agent intent ${agentMetaLabel(line.value)}`;
  if (line.op === 'meta' && line.path === '/agent-policy-resolution') return `agent policy ${agentMetaLabel(line.value)}`;
  if (line.op === 'meta' && line.path === '/status') return `meta /status ${String(line.value)}`;
  if (line.op === 'meta' && line.path === '/thinking') return 'meta /thinking ...';
  if (line.op === 'add' && line.path.includes('/node/')) {
    return `${line.op} ${line.path}${line.parent ? ` parent=${line.parent}` : ''}`;
  }
  return `${line.op} ${line.path}`;
}

function metricsText(metrics: TargetMetrics, side: FragmentSide): string {
  const sections = metrics.graph?.sections ?? [];
  const presentSections = sections.filter((section) => section.present).length;
  const presentNodes = sections.reduce((sum, section) => sum + (section.presentNodeCount ?? 0), 0);
  const nodePart = side === 'html-node-v0'
    ? ` · ${presentNodes} nodes · ${metrics.nodeCommits} patches${metrics.firstNodeAt === null ? '' : ` · first ${(metrics.firstNodeAt / 1000).toFixed(1)}s`}`
    : '';
  return `${metrics.lines} lines · ${metrics.bytes.toLocaleString()} B · ${presentSections} sections${nodePart}`;
}

async function* countedStream(
  stream: ReadableStream<Uint8Array>,
  onBytes: (count: number) => void,
): AsyncGenerator<Uint8Array, void, void> {
  const reader = stream.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return;
      if (value) {
        onBytes(value.byteLength);
        yield value;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function CompareTargetPane({
  side,
  run,
  onDone,
}: {
  side: FragmentSide;
  run: { id: number; prompt: string; signal: AbortSignal } | null;
  onDone: (side: FragmentSide, ok: boolean) => void;
}) {
  const surfaceRef = useRef<SummonSurfaceHandle>(null);
  const startedAtRef = useRef(0);
  const [status, setStatus] = useState('idle');
  const [logs, setLogs] = useState<Array<{ cls: string; text: string }>>([]);
  const [metrics, setMetrics] = useState<TargetMetrics>({
    lines: 0,
    bytes: 0,
    nodeCommits: 0,
    firstNodeAt: null,
    graph: null,
  });

  const logLine = useCallback((cls: string, text: string) => {
    setLogs((items) => [...items.slice(-139), { cls, text }]);
  }, []);

  useEffect(() => {
    if (!run) return;
    const currentRun = run;
    let cancelled = false;
    startedAtRef.current = performance.now();
    setStatus('starting');
    setLogs([]);
    setMetrics({ lines: 0, bytes: 0, nodeCommits: 0, firstNodeAt: null, graph: null });
    surfaceRef.current?.render(blankDarkArtifact);
    logLine('info', side === 'html-node-v0'
      ? 'POST /api/generate fragmentMode=html-node-v0'
      : 'POST /api/generate fragmentMode=section');

    const applyNodePatch = (patch: HtmlNodePatch) => {
      setMetrics((current) => ({
        ...current,
        nodeCommits: current.nodeCommits + 1,
        firstNodeAt: current.firstNodeAt ?? performance.now() - startedAtRef.current,
      }));
      surfaceRef.current?.patchNode(patch);
      logLine('op-add', `patch node ${patch.sectionId}/${patch.nodeId}${patch.parentId ? ` parent=${patch.parentId}` : ''}`);
    };

    async function runTarget() {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: currentRun.prompt,
            directionId: '',
            mode: 'static',
            modelOptions,
            agent: { enabled: true },
            scriptPolicy: 'forbid',
            ...(side === 'html-node-v0' ? { fragmentMode: 'html-node-v0' } : {}),
          }),
          signal: currentRun.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (!res.body) throw new Error('No response body');
        setStatus('streaming');
        let byteTotal = 0;
        const result = await consumeSurfaceStream(countedStream(res.body, (count) => {
          byteTotal += count;
          setMetrics((current) => ({ ...current, bytes: byteTotal }));
        }), {
          mode: 'static',
          renderMode: 'live',
          onLine: (line, context) => {
            setMetrics((current) => ({
              ...current,
              lines: current.lines + 1,
              graph: context.graph.snapshot(),
            }));
            logLine(lineClass(line), lineLabel(line));
          },
          onMeta: (line) => {
            if (line.path === '/experimental-fragments') {
              logLine('info', `experimental ${JSON.stringify(line.value)}`);
            }
            if (line.path === '/validation-blocked' || line.path === '/protocol-skip') {
              logLine('op-error', `${line.path} ${JSON.stringify(line.value)}`);
            }
          },
          onGraph: (graph) => {
            setMetrics((current) => ({ ...current, graph }));
          },
          onRenderHtml: (html) => {
            surfaceRef.current?.render(html);
          },
          onNodePatch: applyNodePatch,
          onParseError: (raw) => {
            logLine('op-error', `parse ${raw.slice(0, 120)}`);
          },
        });
        if (cancelled) return;
        const elapsed = ((performance.now() - startedAtRef.current) / 1000).toFixed(1);
        setStatus(`done ${elapsed}s`);
        setMetrics((current) => ({ ...current, graph: result.streamGraph }));
        onDone(side, true);
      } catch (err) {
        if (cancelled) return;
        if ((err as Error).name === 'AbortError') {
          setStatus('aborted');
          logLine('op-error', 'aborted');
          onDone(side, false);
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        setStatus('error');
        logLine('op-error', message);
        onDone(side, false);
      }
    }

    void runTarget();
    return () => {
      cancelled = true;
    };
  }, [logLine, onDone, run, side]);

  return (
    <section className="compare-pane" data-fragment-side={side}>
      <header>
        <div>
          <span>{side === 'section' ? 'Sections' : 'HTML Nodes'}</span>
          <strong>{side === 'section' ? 'current behavior' : 'experimental html-node-v0'}</strong>
        </div>
        <span id={side === 'section' ? 'section-status' : 'block-status'} className="status" data-status={status}>{status}</span>
      </header>
      <SummonSurface
        ref={surfaceRef}
        id={side === 'section' ? 'section-frame' : 'block-frame'}
        title={side === 'section' ? 'Section fragment result' : 'HTML node patch result'}
        html={blankDarkArtifact}
        tokensSource={tokensSource}
      />
      <div className="compare-metrics" id={side === 'section' ? 'section-metrics' : 'block-metrics'}>
        {metricsText(metrics, side)}
      </div>
      <LogView id={side === 'section' ? 'section-log' : 'block-log'} className="compare-log">
        {logs.map((log, index) => <div key={index} className={log.cls}>{log.text}</div>)}
      </LogView>
    </section>
  );
}

export function FragmentComparePage() {
  const [prompt, setPrompt] = useState('Show me a clean end-of-day sales snapshot for a coffee shop.');
  const [activePresetId, setActivePresetId] = useState<string | null>(
    promptPresets.find((preset) => preset.prompt === 'Show me a clean end-of-day sales snapshot for a coffee shop.')?.id ?? null,
  );
  const [run, setRun] = useState<{ id: number; prompt: string; signal: AbortSignal } | null>(null);
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState('Idle');
  const abortRef = useRef<AbortController | null>(null);
  const doneRef = useRef(new Map<FragmentSide, boolean>());

  const onDone = useCallback((side: FragmentSide, ok: boolean) => {
    doneRef.current.set(side, ok);
    if (doneRef.current.size !== 2) return;
    const complete = [...doneRef.current.values()].every(Boolean);
    setSummary(complete ? 'Both streams complete' : 'Run stopped or failed');
    setRunning(false);
    abortRef.current = null;
  }, []);

  function runBoth() {
    const value = prompt.trim();
    if (!value) {
      setSummary('Add a prompt first');
      return;
    }
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    doneRef.current = new Map();
    setSummary('Running both streams');
    setRunning(true);
    setRun({ id: Date.now(), prompt: value, signal: abort.signal });
  }

  function updatePrompt(value: string) {
    setPrompt(value);
    setActivePresetId(promptPresets.find((preset) => preset.prompt === value)?.id ?? null);
  }

  return (
    <>
      <AppNav active="fragment-compare" />
      <PageHeader
        title="Fragment compare"
        className="compare-header"
        aside={<div className="compare-summary" id="summary">{summary}</div>}
      />
      <form className="compare-controls" onSubmit={(event) => {
        event.preventDefault();
        runBoth();
      }}>
        <section className="compare-presets" aria-labelledby="prompt-presets-label">
          <div className="compare-presets-header">
            <span id="prompt-presets-label" className="field-label">Sample prompt matrix</span>
            <span className="compare-presets-note">Rows are Summon use cases. Columns are complexity.</span>
          </div>
          <div id="prompt-preset-matrix" className="compare-preset-matrix">
            <div className="compare-preset-corner">Use case</div>
            {promptComplexities.map((complexity) => (
              <div key={complexity.id} className="compare-preset-column">{complexity.label}</div>
            ))}
            {promptUseCases.map((useCase) => (
              <PromptPresetRow key={useCase.id} useCase={useCase} activePresetId={activePresetId} onPreset={updatePrompt} />
            ))}
          </div>
        </section>
        <label className="compare-prompt">
          <span className="field-label">Prompt</span>
          <textarea id="prompt" value={prompt} onChange={(event) => updatePrompt(event.target.value)} />
        </label>
        <div className="compare-actions">
          <button id="run" type="submit" className="btn btn-sm" disabled={running}>Run both</button>
          <button id="stop" type="button" className="btn-secondary btn-sm" disabled={!running} onClick={() => abortRef.current?.abort()}>Stop</button>
        </div>
      </form>

      <main className="compare-grid" aria-label="Fragment comparison">
        <CompareTargetPane side="section" run={run} onDone={onDone} />
        <CompareTargetPane side="html-node-v0" run={run} onDone={onDone} />
      </main>
    </>
  );
}

function PromptPresetRow({
  useCase,
  activePresetId,
  onPreset,
}: {
  useCase: (typeof promptUseCases)[number];
  activePresetId: string | null;
  onPreset: (prompt: string) => void;
}) {
  return (
    <>
      <div className="compare-preset-usecase">
        <span className="compare-preset-usecase-label">{useCase.label}</span>
        <span className="compare-preset-usecase-desc">{useCase.description}</span>
      </div>
      {promptComplexities.map((complexity) => {
        const preset = promptPresets.find(
          (candidate) => candidate.useCase === useCase.id && candidate.complexity === complexity.id,
        );
        if (!preset) return <div key={complexity.id} />;
        return (
          <button
            key={preset.id}
            type="button"
            className="compare-preset-button"
            data-preset-id={preset.id}
            data-complexity={complexity.id}
            data-active={preset.id === activePresetId ? 'true' : undefined}
            aria-label={`${useCase.label}, ${complexity.label}: ${preset.title}`}
            onClick={() => onPreset(preset.prompt)}
          >
            <span className="compare-preset-title">{preset.title}</span>
            <span className="compare-preset-preview">{preset.prompt}</span>
          </button>
        );
      })}
    </>
  );
}
