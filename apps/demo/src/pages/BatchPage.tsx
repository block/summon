import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { SummonSurface, type SummonSurfaceHandle } from '@anarchitecture/summon-react';
import { type ToolPack } from '@anarchitecture/summon';
import {
  consumeSurfaceStream,
  type HtmlStreamPreviewDelta,
} from '@anarchitecture/summon/browser';
import {
  buildFingerprintSteeringPayload,
  SUMMON_OUTPUT_RUNTIME_VALUES,
  type ProtocolLine,
  type SummonOutputRuntime,
  type ValidationTool,
} from '@anarchitecture/summon/engine';
import defaultTokensSource from '@anarchitecture/summon/tokens.css?raw';
import { AppNav, ModeGroup, PageHeader } from '../components/chrome.js';
import { Button, compactInputClass, compactSelectClass, pageWidthClass, panelClass, statusToneClass, textareaClass } from '../components/ui.js';
import { cn } from '../lib/cn.js';
import { createDemoToolRegistry } from '../tools.js';
import { ALL_PROMPTS, sample } from '../prompts.js';
import { createRunMetricsAccumulator } from './generate/runMetrics.js';
import type { RunMetrics } from './generate/types.js';

const DEFAULT_FINGERPRINT_ID = 'editorial-mono';
const DEFAULT_BATCH_RUNTIME: SummonOutputRuntime = 'arrow-control';
const BATCH_RUNTIME_VALUES = [...SUMMON_OUTPUT_RUNTIME_VALUES] as SummonOutputRuntime[];

interface FingerprintInfo {
  id: string;
  name?: string;
  summary?: string;
  defaultTargetPath?: string;
}

type SourceMode = 'random' | 'same';
type Interactivity = 'static' | 'interactive';
type LayoutMode = 'grid' | 'stacked';
type RuntimeBatchMode = 'single' | 'matrix';

const maxInteractiveTiles = 8;
const maxStaticTiles = 12;

function summarizeAgentMeta(value: unknown): string {
  if (!value || typeof value !== 'object') return 'agent ward';
  const item = value as Record<string, unknown>;
  const policy = item.surfacePolicy && typeof item.surfacePolicy === 'object'
    ? item.surfacePolicy as Record<string, unknown>
    : null;
  if (policy) {
    const tier = typeof policy.tier === 'string' ? policy.tier : 'policy';
    const purpose = typeof policy.purpose === 'string' ? policy.purpose : 'inform';
    const goalSource = typeof item.goalSource === 'string' ? ` · ${item.goalSource}` : '';
    const fallback = item.fallback === true ? ' · fallback' : '';
    return `${tier}/${purpose}${goalSource}${fallback}`;
  }
  const purpose = typeof item.purpose === 'string' ? item.purpose : 'tool';
  const interaction = typeof item.interaction === 'string' ? item.interaction : 'none';
  const dataNeed = typeof item.dataNeed === 'string' ? item.dataNeed : 'embedded';
  return `${purpose}/${interaction}/${dataNeed}`;
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

function applyBatchMetaLine(
  line: Extract<ProtocolLine, { op: 'meta' }>,
  handlers: {
    setTool: (value: { text: string; err?: boolean } | null) => void;
    setTokensSource: (value: string) => void;
    surfaceRef: MutableRefObject<SummonSurfaceHandle | null>;
    setStatus: (value: string) => void;
    setStatusClass: (value: string) => void;
  },
): void {
  if (line.path === '/agent-goal') {
    handlers.setTool({ text: `agent goal: ${summarizeAgentMeta(line.value)}` });
    return;
  }
  if (line.path === '/agent-policy-resolution') {
    handlers.setTool({ text: `agent policy: ${summarizeAgentMeta(line.value)}` });
    return;
  }
  if (line.path === '/ghost-token-source') {
    const value = line.value as { css?: unknown } | undefined;
    if (typeof value?.css === 'string') handlers.setTokensSource(value.css);
    return;
  }
  if (line.path === '/html-stream-preview') {
    const delta = parseHtmlStreamPreviewDelta(line.value);
    if (delta) handlers.surfaceRef.current?.applyHtmlPreviewDelta(delta);
    return;
  }
  if (line.path === '/status') {
    const status = String(line.value ?? '');
    handlers.setStatus(status);
    handlers.setStatusClass(status);
    return;
  }
  if (line.path === '/error') {
    const text = String(line.value ?? 'generation error');
    handlers.setTool({ text, err: true });
  }
}

function parseHtmlStreamPreviewDelta(value: unknown): HtmlStreamPreviewDelta | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const delta = value as Record<string, unknown>;
  if (delta.runtime !== 'html') return null;
  if (typeof delta.target !== 'string' || !delta.target) return null;
  if (
    delta.action !== 'append' &&
    delta.action !== 'replace' &&
    delta.action !== 'update' &&
    delta.action !== 'remove' &&
    delta.action !== 'morph'
  ) {
    return null;
  }
  const text = typeof delta.delta === 'string'
    ? delta.delta
    : typeof delta.text === 'string'
      ? delta.text
      : '';
  if (!text) return null;
  return {
    runtime: 'html',
    target: delta.target,
    action: delta.action,
    delta: text,
  };
}

interface BatchTileRun {
  id: number;
  prompt: string;
  runtime: SummonOutputRuntime;
  fingerprintId: string;
  fingerprintTargetPath: string;
  tokensCss: string;
  interactivity: Interactivity;
  signal: AbortSignal;
}

interface TileResult {
  ok: boolean;
  bytes: number;
  ms: number;
  runtime: SummonOutputRuntime;
  metrics: RunMetrics;
}

interface RuntimeSummaryRow {
  runtime: SummonOutputRuntime;
  runs: number;
  ok: number;
  blocked: number;
  avgTtfb: number | null;
  avgTtfp: number | null;
  avgTti: number | null;
  avgComplete: number | null;
  avgBytes: number;
  avgRepairs: number;
  safetyViolations: number;
}

function BatchTile({
  run,
  onComplete,
  stacked,
}: {
  run: BatchTileRun;
  onComplete: (id: number, result: TileResult) => void;
  stacked: boolean;
}) {
  const surfaceRef = useRef<SummonSurfaceHandle>(null);
  const [status, setStatus] = useState('pending');
  const [statusClass, setStatusClass] = useState('pending');
  const [bytes, setBytes] = useState(0);
  const [tool, setTool] = useState<{ text: string; err?: boolean } | null>(null);
  const [tokensSource, setTokensSource] = useState(run.tokensCss);

  const registry = useMemo(() => {
    if (run.interactivity !== 'interactive') return null;
    return createDemoToolRegistry({
      onLog: (message) => setTool({ text: message }),
      onError: (message) => setTool({ text: message, err: true }),
    }).without(['summon']);
  }, [run.interactivity]);
  const contract = useMemo(() => registry?.toContract() ?? null, [registry]);
  const toolPack: ToolPack | null = contract?.pack ?? null;
  const validationTools: ValidationTool[] | null = contract?.validationTools ?? null;

  useEffect(() => {
    let cancelled = false;
    const start = performance.now();
    const metrics = createRunMetricsAccumulator(run.runtime);
    const elapsedSinceStart = () => performance.now() - start;
    let byteCount = 0;

    async function runTile() {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      setStatusClass('streaming');
      setStatus('streaming');
      setBytes(0);
      setTool(null);
      setTokensSource(run.tokensCss);

      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: run.prompt,
            ...(buildFingerprintSteeringPayload({
              id: run.fingerprintId,
              targetPath: run.fingerprintTargetPath,
            }) ?? {}),
            experimentalRuntime: run.runtime,
            tools: run.interactivity === 'interactive' ? toolPack : undefined,
            agent: { enabled: true },
          }),
          signal: run.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (!res.body) throw new Error('no body');

        let firstByteSeen = false;
        await consumeSurfaceStream(chunksWithByteCounts(res.body, (count) => {
          if (!firstByteSeen) {
            firstByteSeen = true;
            metrics.markFirstByte(elapsedSinceStart());
          }
          byteCount += count;
          metrics.setBytes(byteCount);
          setBytes(byteCount);
        }), {
          mode: run.interactivity,
          shouldApplyLine: () => 'apply',
          onLine: (line) => {
            metrics.observeProtocolLine(line, elapsedSinceStart());
          },
          onMeta: (line) => {
            applyBatchMetaLine(line, {
              setTool,
              setTokensSource,
              surfaceRef,
              setStatus,
              setStatusClass,
            });
          },
          onArtifact: (artifact) => {
            surfaceRef.current?.renderArtifact(artifact);
          },
          onHtmlPatch: (patch) => {
            surfaceRef.current?.applyHtmlPatch(patch);
          },
          onSurfaceEvent: (event) => {
            metrics.observeSurfaceEvent(event, elapsedSinceStart());
            surfaceRef.current?.applyPreviewEvent(event);
            if (event.type === 'surface.status') {
              setStatusClass(event.status);
              setStatus(event.status);
            }
          },
          validationContext: {
            mode: run.interactivity,
            allowedTools: toolPack?.tools.map((toolItem) => toolItem.name) ?? [],
            tools: validationTools ?? [],
          },
          validationMode: 'observe',
        });

        const ms = Math.round(performance.now() - start);
        metrics.markComplete(ms);
        const finalMetrics = metrics.snapshot();
        if (cancelled) return;
        setStatusClass('done');
        setStatus(`${(ms / 1000).toFixed(1)}s`);
        onComplete(run.id, {
          ok: true,
          bytes: byteCount,
          ms,
          runtime: run.runtime,
          metrics: finalMetrics,
        });
      } catch (err) {
        const ms = Math.round(performance.now() - start);
        metrics.markComplete(ms);
        const finalMetrics = metrics.snapshot();
        if (cancelled) return;
        setStatusClass('error');
        if ((err as Error).name === 'AbortError') {
          setStatus('aborted');
        } else {
          const message = err instanceof Error ? err.message : String(err);
          setStatus(`error: ${message.slice(0, 40)}`);
        }
        onComplete(run.id, {
          ok: false,
          bytes: byteCount,
          ms,
          runtime: run.runtime,
          metrics: finalMetrics,
        });
      }
    }

    void runTile();
    return () => {
      cancelled = true;
    };
  }, [toolPack, validationTools, onComplete, run]);

  return (
    <div className={cn(panelClass, 'flex min-w-0 flex-col')}>
      <div className="flex flex-col gap-1 border-b border-line bg-surface-muted px-[18px] py-3.5 text-xs leading-normal">
        <div className="text-[13px] font-medium tracking-normal text-ink">{run.prompt}</div>
        <div className="flex justify-between gap-2 font-mono text-[11px] text-ink-muted">
          <span className={statusToneClass(statusClass)}>{status}</span>
          <span>{run.runtime} · {bytes.toLocaleString()} B</span>
        </div>
        {tool ? (
          <div className={cn('border-t border-dashed border-line bg-surface px-3.5 py-2 font-mono text-[11px]', tool.err ? 'text-danger' : 'text-good')}>
            {tool.text}
          </div>
        ) : null}
      </div>
      <div className="relative">
        <SummonSurface
          ref={surfaceRef}
          title={run.prompt}
          className={cn('block w-full border-0 bg-surface-raised', stacked ? 'h-[880px]' : 'h-[760px]')}
          tokensSource={tokensSource}
          toolRegistry={registry}
          validationTools={validationTools ?? undefined}
        />
        {run.interactivity === 'interactive' && statusClass === 'streaming' ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[var(--overlay-strong)] text-[13px] font-medium tracking-normal text-ink-soft">
            Generating...
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function BatchPage() {
  const [fingerprints, setFingerprints] = useState<FingerprintInfo[]>([]);
  const [fingerprintId, setFingerprintId] = useState('');
  const [fingerprintTargetPath, setFingerprintTargetPath] = useState('.');
  const [sourceMode, setSourceMode] = useState<SourceMode>('random');
  const [layout, setLayout] = useState<LayoutMode>('grid');
  const [interactivity, setInteractivity] = useState<Interactivity>('static');
  const [runtimeMode, setRuntimeMode] = useState<RuntimeBatchMode>('single');
  const [singleRuntime, setSingleRuntime] = useState<SummonOutputRuntime>(DEFAULT_BATCH_RUNTIME);
  const [count, setCount] = useState(4);
  const [seed, setSeed] = useState('');
  const [samePrompt, setSamePrompt] = useState('');
  const [runs, setRuns] = useState<BatchTileRun[]>([]);
  const [runtimeRows, setRuntimeRows] = useState<RuntimeSummaryRow[]>([]);
  const [summary, setSummary] = useState('No run yet.');
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const resultsRef = useRef(new Map<number, TileResult>());
  const runStartRef = useRef(0);

  useEffect(() => {
    let active = true;
    void fetch('/api/fingerprints')
      .then((res) => (res.ok ? res.json() : []))
      .then((payload: FingerprintInfo[]) => {
        if (!active) return;
        const catalog = Array.isArray(payload) ? payload : [];
        setFingerprints(catalog);
        const selected =
          catalog.find((fingerprint) => fingerprint.id === DEFAULT_FINGERPRINT_ID)
            ?? catalog[0]
            ?? null;
        setFingerprintId(selected?.id ?? '');
        setFingerprintTargetPath(selected?.defaultTargetPath || '.');
      })
      .catch(() => {
        if (active) setFingerprints([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const cap = interactivity === 'interactive' ? maxInteractiveTiles : maxStaticTiles;

  const onComplete = useMemo(() => (id: number, result: TileResult) => {
    resultsRef.current.set(id, result);
    if (resultsRef.current.size !== runs.length) return;
    const results = [...resultsRef.current.values()];
    const wall = Math.round(performance.now() - runStartRef.current);
    const ok = results.filter((item) => item.ok).length;
    const failed = results.length - ok;
    const totalBytes = results.reduce((sum, item) => sum + item.bytes, 0);
    const avgMs = Math.round(results.reduce((sum, item) => sum + item.ms, 0) / Math.max(1, results.length));
    const seedNote = sourceMode === 'random' ? ` · seed ${seed || 'auto'}` : '';
    const modeNote = interactivity === 'interactive' ? ' · interactive' : '';
    const runtimeNote = runtimeMode === 'matrix' ? ` · ${BATCH_RUNTIME_VALUES.length} runtimes` : ` · ${singleRuntime}`;
    setRuntimeRows(aggregateRuntimeRows(results));
    setSummary(`Done in ${(wall / 1000).toFixed(1)}s wall. ${ok} ok · ${failed} failed · avg per-tile ${(avgMs / 1000).toFixed(1)}s · ${totalBytes.toLocaleString()} bytes total${modeNote}${runtimeNote}${seedNote}.`);
    setRunning(false);
    abortRef.current = null;
  }, [interactivity, runtimeMode, runs.length, seed, singleRuntime, sourceMode]);

  function runBatch() {
    abortRef.current?.abort();
    const nextAbort = new AbortController();
    abortRef.current = nextAbort;
    resultsRef.current = new Map();
    runStartRef.current = performance.now();
    setRuntimeRows([]);

    const safeCount = Math.max(1, Math.min(cap, count || 1));
    if (!fingerprintId) {
      setSummary('No Ghost fingerprint catalog is available.');
      return;
    }
    let prompts: string[];
    if (sourceMode === 'same') {
      const prompt = samePrompt.trim();
      if (!prompt) {
        setSummary('Enter a prompt for Same mode.');
        return;
      }
      prompts = new Array(safeCount).fill(prompt);
      const runtimeCount = runtimeMode === 'matrix' ? BATCH_RUNTIME_VALUES.length : 1;
      setSummary(`Running ${safeCount} prompt(s) × ${runtimeCount} runtime(s) (${interactivity})...`);
    } else {
      const numericSeed = seed.trim() ? Number(seed) : ((Date.now() & 0x7fffffff) | 0);
      prompts = sample(ALL_PROMPTS, safeCount, numericSeed);
      const runtimeCount = runtimeMode === 'matrix' ? BATCH_RUNTIME_VALUES.length : 1;
      setSummary(`Running ${safeCount} prompt(s) × ${runtimeCount} runtime(s) (${interactivity}) with seed ${numericSeed}...`);
    }

    setRunning(true);
    const tokensCss = defaultTokensSource;
    const runtimes = runtimeMode === 'matrix' ? BATCH_RUNTIME_VALUES : [singleRuntime];
    const runStartedAt = Date.now();
    setRuns(prompts.flatMap((prompt, promptIndex) =>
      runtimes.map((runtime, runtimeIndex) => ({
        id: runStartedAt + promptIndex * runtimes.length + runtimeIndex,
        prompt,
        runtime,
        fingerprintId,
        fingerprintTargetPath: fingerprintTargetPath.trim() || '.',
        tokensCss,
        interactivity,
        signal: nextAbort.signal,
      })),
    ));
  }

  return (
    <>
      <AppNav active="batch" />
      <PageHeader
        title="Batch testing"
        lede="Fire N generations in parallel. Same prompt to compare consistency, or a seeded random sample from the curated prompt pool to compare coverage."
        className="batch-header"
      />
      <div className={cn(pageWidthClass, 'mb-3.5 flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface p-3.5')}>
        <label className="flex items-center gap-2 text-[13px] text-ink-soft">
          Fingerprint
          <select id="fingerprint" className={cn(compactSelectClass, 'min-w-44')} value={fingerprintId} disabled={fingerprints.length === 0} onChange={(event) => {
            const next = event.target.value;
            const selected = fingerprints.find((fingerprint) => fingerprint.id === next) ?? null;
            setFingerprintId(next);
            setFingerprintTargetPath(selected?.defaultTargetPath || '.');
          }}>
            {fingerprints.length === 0 ? <option value="">No fingerprints</option> : null}
            {fingerprints.map((fingerprint) => (
              <option key={fingerprint.id} value={fingerprint.id} title={fingerprint.summary}>{fingerprint.name ?? fingerprint.id}</option>
            ))}
          </select>
        </label>
        <ModeGroup title="Mode">
          <label><input type="radio" name="mode" value="random" checked={sourceMode === 'random'} onChange={() => setSourceMode('random')} /><span>Random</span></label>
          <label><input type="radio" name="mode" value="same" checked={sourceMode === 'same'} onChange={() => setSourceMode('same')} /><span>Same</span></label>
        </ModeGroup>
        <ModeGroup title="Layout">
          <label><input type="radio" name="layout" value="grid" checked={layout === 'grid'} onChange={() => setLayout('grid')} /><span>Grid</span></label>
          <label><input type="radio" name="layout" value="stacked" checked={layout === 'stacked'} onChange={() => setLayout('stacked')} /><span>Stacked</span></label>
        </ModeGroup>
        <ModeGroup title="Interactivity">
          <label><input type="radio" name="interactivity" value="static" checked={interactivity === 'static'} onChange={() => setInteractivity('static')} /><span>Static</span></label>
          <label><input type="radio" name="interactivity" value="interactive" checked={interactivity === 'interactive'} onChange={() => {
            setInteractivity('interactive');
            setCount((value) => Math.min(value, maxInteractiveTiles));
          }} /><span>Interactive</span></label>
        </ModeGroup>
        <ModeGroup title="Runtime">
          <label><input type="radio" name="runtime-mode" value="single" checked={runtimeMode === 'single'} onChange={() => setRuntimeMode('single')} /><span>Single</span></label>
          <label><input type="radio" name="runtime-mode" value="matrix" checked={runtimeMode === 'matrix'} onChange={() => setRuntimeMode('matrix')} /><span>Matrix</span></label>
        </ModeGroup>
        {runtimeMode === 'single' ? (
          <label className="flex items-center gap-2 text-[13px] text-ink-soft">
            Runtime
            <select
              id="batch-runtime"
              className={cn(compactSelectClass, 'min-w-40')}
              value={singleRuntime}
              onChange={(event) => setSingleRuntime(event.target.value as SummonOutputRuntime)}
            >
              {BATCH_RUNTIME_VALUES.map((runtime) => (
                <option key={runtime} value={runtime}>{runtime}</option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="flex items-center gap-2 text-[13px] text-ink-soft">Count <input id="count" type="number" className={cn(compactInputClass, 'w-16 text-center')} min="1" max={cap} value={count} onChange={(event) => setCount(Number(event.target.value))} /></label>
        {sourceMode === 'random' ? (
          <label id="seed-wrap" className="flex items-center gap-2 text-[13px] text-ink-soft">Seed <input id="seed" type="number" className={cn(compactInputClass, 'w-[90px] text-center')} value={seed} placeholder="auto" onChange={(event) => setSeed(event.target.value)} /></label>
        ) : null}
        {sourceMode === 'same' ? (
          <label id="same-wrap" className="flex flex-[1_1_300px] items-center gap-2 text-[13px] text-ink-soft">
            Prompt
            <textarea id="same-prompt" className={cn(textareaClass, 'min-h-10 flex-1 basis-[300px] py-2.5 text-[13px]')} value={samePrompt} onChange={(event) => setSamePrompt(event.target.value)} placeholder="help me plan a low-key date night for this Friday" />
          </label>
        ) : null}
        <Button id="run" type="button" size="sm" disabled={running || !fingerprintId} onClick={runBatch}>Run</Button>
        <Button id="stop" type="button" variant="secondary" size="sm" disabled={!running} onClick={() => abortRef.current?.abort()}>Stop</Button>
      </div>
      <div
        className={cn(
          pageWidthClass,
          'grid gap-7',
          layout === 'grid' ? 'grid-cols-2 max-[820px]:grid-cols-1' : 'grid-cols-[minmax(0,1100px)] justify-center',
        )}
        id="grid"
      >
        {runs.map((run) => <BatchTile key={run.id} run={run} stacked={layout === 'stacked'} onComplete={onComplete} />)}
      </div>
      {runtimeRows.length > 0 ? (
        <div className={cn(pageWidthClass, 'mt-3.5 overflow-x-auto rounded-card border border-line bg-surface')}>
          <table className="min-w-full border-collapse text-left text-[12px]">
            <thead className="bg-surface-muted text-[11px] uppercase tracking-normal text-ink-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Runtime</th>
                <th className="px-3 py-2 font-semibold">Runs</th>
                <th className="px-3 py-2 font-semibold">Success</th>
                <th className="px-3 py-2 font-semibold">Block</th>
                <th className="px-3 py-2 font-semibold">TTFB</th>
                <th className="px-3 py-2 font-semibold">TTFP</th>
                <th className="px-3 py-2 font-semibold">TTI</th>
                <th className="px-3 py-2 font-semibold">Complete</th>
                <th className="px-3 py-2 font-semibold">Bytes</th>
                <th className="px-3 py-2 font-semibold">Repairs</th>
                <th className="px-3 py-2 font-semibold">Safety</th>
              </tr>
            </thead>
            <tbody>
              {runtimeRows.map((row) => (
                <tr key={row.runtime} className="border-t border-line text-ink-soft">
                  <td className="px-3 py-2 font-mono text-[11px] text-ink">{row.runtime}</td>
                  <td className="px-3 py-2">{row.runs}</td>
                  <td className="px-3 py-2">{formatRate(row.ok, row.runs)}</td>
                  <td className="px-3 py-2">{formatRate(row.blocked, row.runs)}</td>
                  <td className="px-3 py-2">{formatMetricMs(row.avgTtfb)}</td>
                  <td className="px-3 py-2">{formatMetricMs(row.avgTtfp)}</td>
                  <td className="px-3 py-2">{formatMetricMs(row.avgTti)}</td>
                  <td className="px-3 py-2">{formatMetricMs(row.avgComplete)}</td>
                  <td className="px-3 py-2">{Math.round(row.avgBytes).toLocaleString()} B</td>
                  <td className="px-3 py-2">{formatAverage(row.avgRepairs)}</td>
                  <td className="px-3 py-2">{row.safetyViolations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className={cn(pageWidthClass, 'mt-3.5 rounded-card border border-line bg-surface-muted px-[18px] py-3 text-[13px] text-ink-soft')} id="summary">{summary}</div>
    </>
  );
}

function aggregateRuntimeRows(results: TileResult[]): RuntimeSummaryRow[] {
  return BATCH_RUNTIME_VALUES
    .map((runtime) => {
      const runtimeResults = results.filter((result) => result.runtime === runtime);
      if (runtimeResults.length === 0) return null;
      return {
        runtime,
        runs: runtimeResults.length,
        ok: runtimeResults.filter((result) => result.ok).length,
        blocked: runtimeResults.filter((result) => result.metrics.blocked).length,
        avgTtfb: averageMetric(runtimeResults, (result) => result.metrics.ttfb),
        avgTtfp: averageMetric(runtimeResults, (result) => result.metrics.ttfp),
        avgTti: averageMetric(runtimeResults, (result) => result.metrics.tti),
        avgComplete: averageMetric(runtimeResults, (result) => result.metrics.complete),
        avgBytes: averageNumber(runtimeResults.map((result) => result.metrics.bytes)),
        avgRepairs: averageNumber(runtimeResults.map((result) => result.metrics.repairs)),
        safetyViolations: runtimeResults.reduce((sum, result) => sum + result.metrics.safetyViolations, 0),
      };
    })
    .filter((row): row is RuntimeSummaryRow => row !== null);
}

function averageMetric<T>(items: T[], getter: (item: T) => number | null): number | null {
  const values = items.map(getter).filter((value): value is number => typeof value === 'number');
  if (values.length === 0) return null;
  return averageNumber(values);
}

function averageNumber(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatMetricMs(value: number | null): string {
  if (value === null) return 'n/a';
  return `${Math.round(value).toLocaleString()}ms`;
}

function formatAverage(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatRate(value: number, total: number): string {
  if (total <= 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}
