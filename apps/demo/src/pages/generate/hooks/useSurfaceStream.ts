import { useCallback, type MutableRefObject } from 'react';
import { consumeSurfaceStream, type SurfaceStreamContext } from '@anarchitecture/summon/browser';
import {
  normalizeSurfacePlan,
  type ProtocolLine,
  type SectionAccumulator,
  type SurfaceContractView,
  type SurfacePlan,
} from '@anarchitecture/summon/engine';
import type { DevtoolsEvent } from '@anarchitecture/summon/devtools';
import type { SummonSurfaceHandle } from '@anarchitecture/summon-react';
import type { Mode } from '../../../showcase.js';
import { demoSurfaceCeiling } from '../constants.js';
import type { ExtraDevtoolsEvent } from '../devtools.js';
import {
  agentBrokerRequestFor,
  agentIntentText,
  agentPolicyText,
  applyTokenOverrideCss,
  capabilityPackFor,
  componentPackFor,
  ghostRootFromSelection,
  parseAppliedTokenOverrides,
  parseSurfaceContractView,
  summarizeRepairMeta,
  summarizeStreamGraphMeta,
  summarizeValidationMeta,
  surfaceRequestFor,
} from '../surfaceHelpers.js';
import type { StreamOptions, StreamResult } from '../types.js';

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

export function useSurfaceStream({
  surfaceRef,
  accRef,
  modeRef,
  artifactRevisionRef,
  directionId,
  tokensFor,
  appendDevEvent,
  logLine,
  setBytes,
  setMode,
  setCurrentAgentIntentSummary,
  setCurrentAgentPolicySummary,
  setCurrentEffectiveSurfacePlan,
  setCurrentSurfaceContractView,
  setCurrentShape,
  setActiveTokensSourceOverride,
  setSurfaceTokensSource,
  setCurrentValidationSummary,
  setCurrentRepairSummary,
  setCurrentStreamHealth,
  setStatus,
  setArtifactRevision,
}: {
  surfaceRef: MutableRefObject<SummonSurfaceHandle | null>;
  accRef: MutableRefObject<SectionAccumulator>;
  modeRef: MutableRefObject<Mode>;
  artifactRevisionRef: MutableRefObject<number>;
  directionId: string | null;
  tokensFor: (id: string | null) => string;
  appendDevEvent: (event: DevtoolsEvent | ExtraDevtoolsEvent) => void;
  logLine: (cls: string, text: string) => void;
  setBytes: (value: number) => void;
  setMode: (value: Mode) => void;
  setCurrentAgentIntentSummary: (value: string | null) => void;
  setCurrentAgentPolicySummary: (value: string | null) => void;
  setCurrentEffectiveSurfacePlan: (value: SurfacePlan | null) => void;
  setCurrentSurfaceContractView: (value: SurfaceContractView | null) => void;
  setCurrentShape: (value: string | null) => void;
  setActiveTokensSourceOverride: (value: string | null) => void;
  setSurfaceTokensSource: (value: string) => void;
  setCurrentValidationSummary: (value: string | null) => void;
  setCurrentRepairSummary: (value: string | null) => void;
  setCurrentStreamHealth: (value: string | null) => void;
  setStatus: (value: string) => void;
  setArtifactRevision: (value: number) => void;
}) {
  const applyLineTo = useCallback((line: ProtocolLine, context: SurfaceStreamContext) => {
    if (line.op === 'meta' && line.path === '/error') {
      logLine('op-error', `error: ${String(line.value)}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/mode-upgraded') {
      logLine('op-meta', 'mode auto-upgraded -> interactive');
      setMode('interactive');
      modeRef.current = 'interactive';
      return;
    }
    if (line.op === 'meta' && line.path === '/agent-intent') {
      const summary = agentIntentText(line.value);
      setCurrentAgentIntentSummary(summary);
      logLine('op-meta', `agent intent -> ${summary}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/agent-policy-resolution') {
      const summary = agentPolicyText(line.value);
      setCurrentAgentPolicySummary(summary);
      logLine('op-meta', `agent policy -> ${summary}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/surface-plan') {
      const plan = normalizeSurfacePlan(line.value);
      if (plan) {
        setCurrentEffectiveSurfacePlan(plan);
        appendDevEvent({ kind: 'surface-plan', at: Date.now(), plan });
        logLine('op-meta', `surface -> ${plan.purpose}/${plan.runtime}/${plan.data}/${plan.authority}/${plan.persistence}`);
      } else {
        logLine('op-meta', `surface -> invalid ${JSON.stringify(line.value)}`);
      }
      return;
    }
    if (line.op === 'meta' && line.path === '/surface-contract') {
      const contract = parseSurfaceContractView(line.value);
      if (contract) {
        setCurrentSurfaceContractView(contract);
        appendDevEvent({ kind: 'surface-contract', at: Date.now(), contract });
        logLine('op-meta', `surface contract -> ${contract.tools.length} tools, ${contract.components.length} components`);
      }
      return;
    }
    if (line.op === 'meta' && line.path === '/shape') {
      const shape = typeof line.value === 'string' ? line.value : '';
      if (shape) setCurrentShape(shape);
      logLine('op-meta', `shape -> ${shape || JSON.stringify(line.value)}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/experimental-fragments') {
      logLine('op-meta', `fragments -> ${JSON.stringify(line.value)}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/token-overrides') {
      const applied = parseAppliedTokenOverrides(line.value);
      const css = applyTokenOverrideCss(tokensFor(directionId), applied);
      setActiveTokensSourceOverride(css);
      setSurfaceTokensSource(css);
      const composed = accRef.current.hasAnySection() ? accRef.current.compose() : '';
      window.setTimeout(() => surfaceRef.current?.render(composed), 0);
      const rejected = Array.isArray((line.value as { rejected?: unknown } | undefined)?.rejected)
        ? ((line.value as { rejected?: unknown[] }).rejected ?? []).length
        : 0;
      logLine('op-meta', `token overrides -> applied=${applied.length}; rejected=${rejected}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/ghost-context') {
      const value = line.value as { product?: unknown; source?: unknown; targetPath?: unknown; layers?: unknown; baseDirectionId?: unknown; styleSource?: unknown } | undefined;
      const product = typeof value?.product === 'string' ? value.product : 'Ghost';
      const source = typeof value?.source === 'string' ? value.source : 'root';
      const targetPath = typeof value?.targetPath === 'string' ? value.targetPath : '.';
      const layers = Array.isArray(value?.layers) ? value.layers.filter((layer): layer is string => typeof layer === 'string') : [];
      const base = typeof value?.baseDirectionId === 'string' ? value.baseDirectionId : 'none';
      const style = typeof value?.styleSource === 'string' ? value.styleSource : 'unknown';
      logLine('op-meta', `ghost context -> ${product}; source=${source}; target=${targetPath}; layers=${layers.join(' > ') || '.'}; base=${base}; style=${style}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/ghost-token-source') {
      const value = line.value as { kind?: unknown; source?: unknown; css?: unknown; warnings?: unknown; baseDirectionId?: unknown } | undefined;
      if (typeof value?.css === 'string') {
        setActiveTokensSourceOverride(value.css);
        setSurfaceTokensSource(value.css);
        const composed = accRef.current.hasAnySection() ? accRef.current.compose() : '';
        window.setTimeout(() => surfaceRef.current?.render(composed), 0);
      }
      const source = typeof value?.source === 'string' ? value.source : 'unknown';
      const kind = typeof value?.kind === 'string' ? value.kind : 'unknown';
      const base = typeof value?.baseDirectionId === 'string' ? `; base=${value.baseDirectionId}` : '';
      logLine('op-meta', `ghost tokens -> ${kind} (${source})${base}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/ghost-review-packet') {
      const value = line.value as { baseDirectionId?: unknown; styleSource?: unknown; declaredSections?: unknown; validation?: { blocked?: unknown; warnings?: unknown } } | undefined;
      const base = typeof value?.baseDirectionId === 'string' ? value.baseDirectionId : 'none';
      const style = typeof value?.styleSource === 'string' ? value.styleSource : 'unknown';
      const sections = Array.isArray(value?.declaredSections) ? value.declaredSections.filter((section): section is string => typeof section === 'string') : [];
      const blocked = typeof value?.validation?.blocked === 'number' ? value.validation.blocked : 0;
      const warnings = typeof value?.validation?.warnings === 'number' ? value.validation.warnings : 0;
      logLine('op-meta', `ghost review packet -> base=${base}; style=${style}; sections=${sections.join(', ') || 'none'}; validation=${blocked}/${warnings}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/validation-summary') {
      setCurrentValidationSummary(summarizeValidationMeta(line.value));
      logLine('op-meta', `validation -> ${JSON.stringify(line.value)}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/repair-summary') {
      setCurrentRepairSummary(summarizeRepairMeta(line.value));
      logLine('op-meta', `validation retry -> ${JSON.stringify(line.value)}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/stream-graph-summary') {
      setCurrentStreamHealth(summarizeStreamGraphMeta(line.value));
      logLine('op-meta', `stream diagnostics -> ${JSON.stringify(line.value)}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/status') {
      setStatus(String(line.value));
      return;
    }
    if (line.op === 'meta' && line.path === '/thinking') {
      const text = typeof line.value === 'string' ? line.value : JSON.stringify(line.value);
      logLine('op-meta', `. ${text.slice(0, 160)}${text.length > 160 ? '...' : ''}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/protocol-skip') {
      logLine('op-meta', `skip ${JSON.stringify(line.value)}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/screen-synthesized') {
      const value = line.value as { sections?: unknown } | undefined;
      const sections = Array.isArray(value?.sections) ? value.sections.filter((section): section is string => typeof section === 'string') : [];
      logLine('op-meta', `screen synthesized -> ${sections.join(', ') || '(none)'}`);
      return;
    }
    if (line.op === 'meta') {
      logLine('op-meta', `meta ${line.path} = ${JSON.stringify(line.value)}`);
      return;
    }
    if (line.op === 'set') {
      const changed = context.applyResult?.changed ?? false;
      logLine('op-set', `set ${line.path} = ${JSON.stringify(line.value)}`);
      if (changed) {
        artifactRevisionRef.current += 1;
        setArtifactRevision(artifactRevisionRef.current);
      }
      return;
    }
    if (line.op === 'add') {
      const changed = context.applyResult?.changed ?? false;
      const preview = (line.html ?? '').slice(0, 120).replace(/\s+/g, ' ');
      logLine('op-add', `add ${line.path} (${(line.html ?? '').length} chars): ${preview}${(line.html ?? '').length > 120 ? '...' : ''}`);
      if (changed) {
        artifactRevisionRef.current += 1;
        setArtifactRevision(artifactRevisionRef.current);
      }
    }
  }, [
    accRef,
    appendDevEvent,
    artifactRevisionRef,
    directionId,
    logLine,
    modeRef,
    setActiveTokensSourceOverride,
    setArtifactRevision,
    setBytes,
    setCurrentAgentIntentSummary,
    setCurrentAgentPolicySummary,
    setCurrentEffectiveSurfacePlan,
    setCurrentRepairSummary,
    setCurrentShape,
    setCurrentStreamHealth,
    setCurrentSurfaceContractView,
    setCurrentValidationSummary,
    setMode,
    setStatus,
    setSurfaceTokensSource,
    surfaceRef,
    tokensFor,
  ]);

  return useCallback(async (opts: StreamOptions): Promise<StreamResult> => {
    const active = opts.active;
    const ghostRootId = ghostRootFromSelection(opts.directionId);
    const capabilityPack = capabilityPackFor(active);
    const components = componentPackFor(active);
    const surfaceRequest = surfaceRequestFor(active);
    const agent = agentBrokerRequestFor(active);

    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: opts.prompt,
        ...(active.modelProvider ? { modelProvider: active.modelProvider } : {}),
        ...(active.generationModel ? { generationModel: active.generationModel } : {}),
        ...(active.utilityModel ? { utilityModel: active.utilityModel } : {}),
        ...(active.customModel ? { customModel: true } : {}),
        ...(active.modelOptions ? { modelOptions: active.modelOptions } : {}),
        ...(ghostRootId
          ? {
              ghost: {
                rootId: ghostRootId,
                targetPath: opts.ghostTargetPath,
                ...(opts.ghostBaseDirectionId ? { baseDirectionId: opts.ghostBaseDirectionId } : {}),
              },
            }
          : { directionId: opts.directionId }),
        mode: modeRef.current,
        capabilities: capabilityPack,
        ...(components ? { components } : {}),
        surfaceCeiling: demoSurfaceCeiling,
        ...(agent ? { agent } : {}),
        scriptPolicy: active.scriptPolicy,
        ...(opts.fragmentMode !== 'section' && !opts.edit ? { fragmentMode: opts.fragmentMode } : {}),
        ...surfaceRequest,
        ...(active.tokenOverrides ? { tokenOverrides: active.tokenOverrides } : {}),
        ...(opts.layout ? { layout: opts.layout } : {}),
        ...(opts.edit ? { edit: opts.edit } : {}),
        ...(active.repair ? { repair: active.repair } : {}),
      }),
      signal: opts.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
    }
    if (!response.body) throw new Error('no response body');

    let byteTotal = 0;
    let surfacePlanFromStream: SurfacePlan | null = null;
    let shapeFromStream: string | null = null;
    const result = await consumeSurfaceStream(chunksWithByteCounts(response.body, (count) => {
      byteTotal += count;
      setBytes(byteTotal);
    }), {
      mode: () => modeRef.current,
      accumulator: accRef.current,
      shouldApplyLine: (line) => {
        if (
          opts.edit &&
          line.op !== 'meta' &&
          accRef.current.hasAnySection() &&
          artifactRevisionRef.current !== opts.edit.baseRevision
        ) {
          logLine('op-meta', `stale edit discarded (base rev ${opts.edit.baseRevision}, current rev ${artifactRevisionRef.current})`);
          return 'stop';
        }
        return 'apply';
      },
      onLine: (line, context) => {
        appendDevEvent({ kind: 'protocol-line', at: Date.now(), line });
        if (line.op !== 'meta') applyLineTo(line, context);
      },
      onMeta: (line, context) => {
        if (line.path === '/surface-plan') surfacePlanFromStream = normalizeSurfacePlan(line.value);
        if (line.path === '/shape' && typeof line.value === 'string') shapeFromStream = line.value;
        applyLineTo(line, context);
      },
      onParseError: (raw) => {
        appendDevEvent({ kind: 'protocol-parse-error', at: Date.now(), raw });
        logLine('raw', `. ${raw.slice(0, 120)}`);
      },
      onGraph: (snapshot) => {
        appendDevEvent({
          kind: 'stream-graph',
          at: Date.now(),
          health: snapshot.health,
          sections: snapshot.sections.map(({ id, declared, present, revision, bytes }) => ({
            id,
            declared,
            present,
            revision,
            bytes,
          })),
        });
      },
      onRenderHtml: (html) => {
        surfaceRef.current?.render(html);
      },
      onNodePatch: (patch) => {
        surfaceRef.current?.patchNode(patch);
      },
    });

    return {
      ...result,
      surfacePlan: surfacePlanFromStream,
      shape: shapeFromStream,
    };
  }, [
    accRef,
    appendDevEvent,
    applyLineTo,
    artifactRevisionRef,
    logLine,
    modeRef,
    setBytes,
    surfaceRef,
  ]);
}
