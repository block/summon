import { useEffect, useMemo, useRef, useState } from 'react';
import { SummonSurface, type SummonSurfaceHandle } from '@anarchitecture/summon-react';
import { type CapabilityPack } from '@anarchitecture/summon';
import {
  parseProtocolLine,
  SectionAccumulator,
  type ValidationCapability,
} from '@anarchitecture/summon/engine';
import defaultTokensSource from '@anarchitecture/summon/tokens.css?raw';
import { AppNav, ModeGroup, PageHeader } from '../components/chrome.js';
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
    const fallback = item.fallback === true ? ' · fallback' : '';
    return `${tier}/${purpose}${fallback}`;
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
}: {
  run: BatchTileRun;
  onComplete: (id: number, result: TileResult) => void;
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
    const acc = new SectionAccumulator();
    const start = performance.now();
    let byteCount = 0;

    async function runTile() {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      setStatusClass('streaming');
      setStatus('streaming');
      setBytes(0);
      setIntent(null);
      const renderIncrementally = run.interactivity === 'static';

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
          const changed = acc.apply(parsed);
          if (renderIncrementally && changed && acc.hasAnySection()) {
            surfaceRef.current?.render(acc.compose());
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
        if (!renderIncrementally && acc.hasAnySection()) {
          surfaceRef.current?.render(acc.compose());
        }

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
    <div className="tile">
      <div className="tile-header">
        <div className="tile-prompt">{run.prompt}</div>
        <div className="tile-meta">
          <span className={`status ${statusClass}`}>{status}</span>
          <span>{bytes.toLocaleString()} B</span>
        </div>
        <div className={['tile-intent', intent ? 'on' : '', intent?.err ? 'err' : ''].filter(Boolean).join(' ')}>
          {intent?.text}
        </div>
      </div>
      <div className="tile-body">
        <SummonSurface
          ref={surfaceRef}
          title={run.prompt}
          html=""
          tokensSource={run.tokensCss}
          capabilityRegistry={registry}
          grantedCapabilities={validationCapabilities ?? undefined}
        />
        <div className={['tile-overlay', run.interactivity === 'interactive' && statusClass === 'streaming' ? 'on' : ''].filter(Boolean).join(' ')}>
          Generating...
        </div>
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
      <div className="controls batch-controls">
        <label>
          Direction
          <select id="direction" value={directionId} onChange={(event) => setDirectionId(event.target.value)}>
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
        <label>Count <input id="count" type="number" min="1" max={cap} value={count} onChange={(event) => setCount(Number(event.target.value))} /></label>
        {sourceMode === 'random' ? (
          <label id="seed-wrap">Seed <input id="seed" type="number" className="seed" value={seed} placeholder="auto" onChange={(event) => setSeed(event.target.value)} /></label>
        ) : null}
        {sourceMode === 'same' ? (
          <label id="same-wrap" style={{ flex: '1 1 300px', display: 'flex' }}>
            Prompt
            <textarea id="same-prompt" value={samePrompt} onChange={(event) => setSamePrompt(event.target.value)} placeholder="help me plan a low-key date night for this Friday" />
          </label>
        ) : null}
        <button id="run" type="button" className="btn btn-sm" disabled={running} onClick={runBatch}>Run</button>
        <button id="stop" type="button" className="btn-secondary btn-sm" disabled={!running} onClick={() => abortRef.current?.abort()}>Stop</button>
      </div>
      <div className={`grid ${layout === 'grid' ? 'layout-grid' : 'layout-stacked'} batch-grid`} id="grid">
        {runs.map((run) => <BatchTile key={run.id} run={run} onComplete={onComplete} />)}
      </div>
      <div className="summary batch-summary" id="summary">{summary}</div>
    </>
  );
}
