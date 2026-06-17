import { useEffect, useMemo, useRef, useState } from 'react';
import { SummonSurface, type SummonSurfaceHandle } from '@anarchitecture/summon-react';
import { type CapabilityPack } from '@anarchitecture/summon';
import {
  isArrowSurfaceArtifact,
  parseProtocolLine,
  type ValidationCapability,
} from '@anarchitecture/summon/engine';
import defaultTokensSource from '@anarchitecture/summon/tokens.css?raw';
import { AppNav, ModeGroup, PageHeader } from '../components/chrome.js';
import { Button, compactInputClass, compactSelectClass, pageWidthClass, panelClass, statusToneClass, textareaClass } from '../components/ui.js';
import { cn } from '../lib/cn.js';
import { createDemoCapabilityRegistry } from '../capabilities.js';
import { ALL_PROMPTS, sample } from '../prompts.js';

interface DirectionInfo {
  id: string;
  name: string;
  description: string;
  tokensCss: string;
}

type SourceMode = 'random' | 'same';
type Interactivity = 'static' | 'interactive';
type LayoutMode = 'grid' | 'stacked';

const maxInteractiveTiles = 8;
const maxStaticTiles = 12;

function tokensFor(directions: DirectionInfo[], directionId: string): string {
  return directions.find((direction) => direction.id === directionId)?.tokensCss ?? defaultTokensSource;
}

function summarizeAgentMeta(value: unknown): string {
  if (!value || typeof value !== 'object') return 'agent broker';
  const item = value as Record<string, unknown>;
  const policy = item.surfacePolicy && typeof item.surfacePolicy === 'object'
    ? item.surfacePolicy as Record<string, unknown>
    : null;
  if (policy) {
    const tier = typeof policy.tier === 'string' ? policy.tier : 'policy';
    const purpose = typeof policy.purpose === 'string' ? policy.purpose : 'inform';
    const intentSource = typeof item.intentSource === 'string' ? ` · ${item.intentSource}` : '';
    const fallback = item.fallback === true ? ' · fallback' : '';
    return `${tier}/${purpose}${intentSource}${fallback}`;
  }
  const purpose = typeof item.purpose === 'string' ? item.purpose : 'intent';
  const interaction = typeof item.interaction === 'string' ? item.interaction : 'none';
  const dataNeed = typeof item.dataNeed === 'string' ? item.dataNeed : 'embedded';
  return `${purpose}/${interaction}/${dataNeed}`;
}

interface BatchTileRun {
  id: number;
  prompt: string;
  directionId: string;
  tokensCss: string;
  interactivity: Interactivity;
  signal: AbortSignal;
}

interface TileResult {
  ok: boolean;
  bytes: number;
  ms: number;
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
  const [intent, setIntent] = useState<{ text: string; err?: boolean } | null>(null);

  const registry = useMemo(() => {
    if (run.interactivity !== 'interactive') return null;
    return createDemoCapabilityRegistry({
      onLog: (message) => setIntent({ text: message }),
      onError: (message) => setIntent({ text: message, err: true }),
    }).without(['summon']);
  }, [run.interactivity]);
  const contract = useMemo(() => registry?.toContract() ?? null, [registry]);
  const capabilityPack: CapabilityPack | null = contract?.pack ?? null;
  const validationCapabilities: ValidationCapability[] | null = contract?.validationCapabilities ?? null;

  useEffect(() => {
    let cancelled = false;
    const start = performance.now();
    let byteCount = 0;

    async function runTile() {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      setStatusClass('streaming');
      setStatus('streaming');
      setBytes(0);
      setIntent(null);

      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: run.prompt,
            directionId: run.directionId,
            mode: run.interactivity,
            capabilities: run.interactivity === 'interactive' ? capabilityPack : undefined,
            agent: { enabled: true },
          }),
          signal: run.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const reader = res.body?.getReader();
        if (!reader) throw new Error('no body');

        const decoder = new TextDecoder();
        let buffer = '';
        const processLine = (raw: string) => {
          const parsed = parseProtocolLine(raw);
          if (!parsed) return;
          if (parsed.op === 'meta' && parsed.path === '/agent-intent') {
            setIntent({ text: `agent intent: ${summarizeAgentMeta(parsed.value)}` });
          }
          if (parsed.op === 'meta' && parsed.path === '/agent-policy-resolution') {
            setIntent({ text: `agent policy: ${summarizeAgentMeta(parsed.value)}` });
          }
          if (parsed.op === 'artifact' && isArrowSurfaceArtifact(parsed.value)) {
            surfaceRef.current?.renderArtifact(parsed.value);
          }
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (!value) continue;
          byteCount += value.byteLength;
          setBytes(byteCount);
          buffer += decoder.decode(value, { stream: true });
          let nl = buffer.indexOf('\n');
          while (nl !== -1) {
            processLine(buffer.slice(0, nl));
            buffer = buffer.slice(nl + 1);
            nl = buffer.indexOf('\n');
          }
        }
        const tail = buffer.trim();
        if (tail) processLine(tail);

        const ms = Math.round(performance.now() - start);
        if (cancelled) return;
        setStatusClass('done');
        setStatus(`${(ms / 1000).toFixed(1)}s`);
        onComplete(run.id, { ok: true, bytes: byteCount, ms });
      } catch (err) {
        const ms = Math.round(performance.now() - start);
        if (cancelled) return;
        setStatusClass('error');
        if ((err as Error).name === 'AbortError') {
          setStatus('aborted');
        } else {
          const message = err instanceof Error ? err.message : String(err);
          setStatus(`error: ${message.slice(0, 40)}`);
        }
        onComplete(run.id, { ok: false, bytes: byteCount, ms });
      }
    }

    void runTile();
    return () => {
      cancelled = true;
    };
  }, [capabilityPack, onComplete, run]);

  return (
    <div className={cn(panelClass, 'flex min-w-0 flex-col')}>
      <div className="flex flex-col gap-1 border-b border-line bg-surface-muted px-[18px] py-3.5 text-xs leading-normal">
        <div className="text-[13px] font-medium tracking-normal text-ink">{run.prompt}</div>
        <div className="flex justify-between gap-2 font-mono text-[11px] text-ink-muted">
          <span className={statusToneClass(statusClass)}>{status}</span>
          <span>{bytes.toLocaleString()} B</span>
        </div>
        {intent ? (
          <div className={cn('border-t border-dashed border-line bg-surface px-3.5 py-2 font-mono text-[11px]', intent.err ? 'text-danger' : 'text-good')}>
            {intent.text}
          </div>
        ) : null}
      </div>
      <div className="relative">
        <SummonSurface
          ref={surfaceRef}
          title={run.prompt}
          className={cn('block w-full border-0 bg-surface-raised', stacked ? 'h-[880px]' : 'h-[760px]')}
          tokensSource={run.tokensCss}
          capabilityRegistry={registry}
          grantedCapabilities={validationCapabilities ?? undefined}
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
  const [directions, setDirections] = useState<DirectionInfo[]>([]);
  const [directionId, setDirectionId] = useState('');
  const [sourceMode, setSourceMode] = useState<SourceMode>('random');
  const [layout, setLayout] = useState<LayoutMode>('grid');
  const [interactivity, setInteractivity] = useState<Interactivity>('static');
  const [count, setCount] = useState(4);
  const [seed, setSeed] = useState('');
  const [samePrompt, setSamePrompt] = useState('');
  const [runs, setRuns] = useState<BatchTileRun[]>([]);
  const [summary, setSummary] = useState('No run yet.');
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const resultsRef = useRef(new Map<number, TileResult>());
  const runStartRef = useRef(0);

  useEffect(() => {
    let active = true;
    void fetch('/api/directions')
      .then((res) => (res.ok ? res.json() : []))
      .then((payload: DirectionInfo[]) => {
        if (!active) return;
        setDirections(payload);
        setDirectionId(payload[0]?.id ?? '');
      })
      .catch(() => {
        if (active) setDirections([]);
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
    setSummary(`Done in ${(wall / 1000).toFixed(1)}s wall. ${ok} ok · ${failed} failed · avg per-tile ${(avgMs / 1000).toFixed(1)}s · ${totalBytes.toLocaleString()} bytes total${modeNote}${seedNote}.`);
    setRunning(false);
    abortRef.current = null;
  }, [interactivity, runs.length, seed, sourceMode]);

  function runBatch() {
    abortRef.current?.abort();
    const nextAbort = new AbortController();
    abortRef.current = nextAbort;
    resultsRef.current = new Map();
    runStartRef.current = performance.now();

    const safeCount = Math.max(1, Math.min(cap, count || 1));
    let prompts: string[];
    if (sourceMode === 'same') {
      const prompt = samePrompt.trim();
      if (!prompt) {
        setSummary('Enter a prompt for Same mode.');
        return;
      }
      prompts = new Array(safeCount).fill(prompt);
    } else {
      const numericSeed = seed.trim() ? Number(seed) : ((Date.now() & 0x7fffffff) | 0);
      prompts = sample(ALL_PROMPTS, safeCount, numericSeed);
      setSummary(`Running ${safeCount} (${interactivity}) with seed ${numericSeed}...`);
    }

    setRunning(true);
    const tokensCss = tokensFor(directions, directionId);
    setRuns(prompts.map((prompt, index) => ({
      id: Date.now() + index,
      prompt,
      directionId,
      tokensCss,
      interactivity,
      signal: nextAbort.signal,
    })));
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
          Direction
          <select id="direction" className={cn(compactSelectClass, 'min-w-44')} value={directionId} onChange={(event) => setDirectionId(event.target.value)}>
            {directions.length === 0 ? <option value="">Default</option> : null}
            {directions.map((direction) => (
              <option key={direction.id} value={direction.id} title={direction.description}>{direction.name}</option>
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
        <Button id="run" type="button" size="sm" disabled={running} onClick={runBatch}>Run</Button>
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
      <div className={cn(pageWidthClass, 'mt-3.5 rounded-card border border-line bg-surface-muted px-[18px] py-3 text-[13px] text-ink-soft')} id="summary">{summary}</div>
    </>
  );
}
