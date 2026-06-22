import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import {
  consumeSurfaceStream,
  type SurfacePreviewSnapshot,
  type SurfaceStreamContext,
} from '@anarchitecture/summon/browser';
import {
  normalizeSurfacePlan,
  type ArrowSurfaceArtifact,
  type ProtocolLine,
  type SurfaceContractView,
  type SurfacePlan,
  type ValidationContext,
} from '@anarchitecture/summon/engine';
import type { DevtoolsEvent } from '@anarchitecture/summon/devtools';
import type { SummonSurfaceHandle } from '@anarchitecture/summon-react';
import type { Mode } from '../../../showcase.js';
import type { ExtraDevtoolsEvent } from '../devtools.js';
import { reduceSurfacePreviewSnapshot } from '../generationPreview.js';
import {
  agentBrokerRequestFor,
  agentGoalText,
  agentPolicyText,
  ghostRootFromSelection,
  missingArtifactMessage,
  parseSurfaceContractView,
  summarizeStreamGraphMeta,
  summarizeValidationMeta,
  surfaceRequestFor,
  toolPackFor,
} from '../surfaceHelpers.js';
import type { StreamOptions, StreamResult, TimingEntry } from '../types.js';

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
  modeRef,
  artifactRevisionRef,
  directionId,
  tokensFor,
  appendDevEvent,
  logLine,
  setBytes,
  setMode,
  setCurrentAgentGoalSummary,
  setCurrentAgentPolicySummary,
  setCurrentEffectiveSurfacePlan,
  setCurrentSurfaceContractView,
  setActiveTokensSourceOverride,
  setSurfaceTokensSource,
  setCurrentValidationSummary,
  setCurrentStreamHealth,
  setStatus,
  setPreviewSnapshot,
  setArtifactRevision,
  appendTimingEntry,
}: {
  surfaceRef: MutableRefObject<SummonSurfaceHandle | null>;
  modeRef: MutableRefObject<Mode>;
  artifactRevisionRef: MutableRefObject<number>;
  directionId: string | null;
  tokensFor: (id: string | null) => string;
  appendDevEvent: (event: DevtoolsEvent | ExtraDevtoolsEvent) => void;
  logLine: (cls: string, text: string) => void;
  setBytes: (value: number) => void;
  setMode: (value: Mode) => void;
  setCurrentAgentGoalSummary: (value: string | null) => void;
  setCurrentAgentPolicySummary: (value: string | null) => void;
  setCurrentEffectiveSurfacePlan: (value: SurfacePlan | null) => void;
  setCurrentSurfaceContractView: (value: SurfaceContractView | null) => void;
  setActiveTokensSourceOverride: (value: string | null) => void;
  setSurfaceTokensSource: (value: string) => void;
  setCurrentValidationSummary: (value: string | null) => void;
  setCurrentStreamHealth: (value: string | null) => void;
  setStatus: (value: string) => void;
  setPreviewSnapshot: Dispatch<SetStateAction<SurfacePreviewSnapshot | null>>;
  setArtifactRevision: (value: number) => void;
  appendTimingEntry: (entry: Omit<TimingEntry, 'id' | 'at'> & { at?: number }) => void;
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
    if (line.op === 'meta' && line.path === '/agent-goal') {
      const summary = agentGoalText(line.value);
      setCurrentAgentGoalSummary(summary);
      logLine('op-meta', `agent goal -> ${summary}`);
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
        logLine('op-meta', `surface contract -> ${contract.tools.length} tools`);
      }
      return;
    }
    if (line.op === 'meta' && line.path === '/playground-mode') {
      const value = line.value as { validation?: unknown; broker?: unknown; repairs?: unknown; repairIssueCodes?: unknown } | undefined;
      const repairCodes = Array.isArray(value?.repairIssueCodes)
        ? value.repairIssueCodes.filter((code): code is string => typeof code === 'string')
        : [];
      logLine('op-meta', `playground -> validation=${String(value?.validation ?? 'observe')}; broker=${String(value?.broker ?? 'off')}; repairs=${String(value?.repairs ?? 0)}${repairCodes.length ? `; repairCodes=${repairCodes.join(',')}` : ''}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/validation-observed') {
      const value = line.value as { code?: unknown; message?: unknown } | undefined;
      logLine('op-meta', `observed validation -> ${String(value?.code ?? 'issue')}: ${String(value?.message ?? JSON.stringify(line.value))}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/ghost-context') {
      const value = line.value as {
        product?: unknown;
        source?: unknown;
        targetPath?: unknown;
        layers?: unknown;
        baseDirectionId?: unknown;
        styleSource?: unknown;
        taskContract?: { preserve?: unknown; validate?: unknown };
      } | undefined;
      const product = typeof value?.product === 'string' ? value.product : 'Ghost fingerprint';
      const source = typeof value?.source === 'string' ? value.source : 'root';
      const targetPath = typeof value?.targetPath === 'string' ? value.targetPath : '.';
      const layers = Array.isArray(value?.layers) ? value.layers.filter((layer): layer is string => typeof layer === 'string') : [];
      const base = typeof value?.baseDirectionId === 'string' ? value.baseDirectionId : 'none';
      const style = typeof value?.styleSource === 'string' ? value.styleSource : 'unknown';
      const preserveCount = Array.isArray(value?.taskContract?.preserve) ? value.taskContract.preserve.length : 0;
      const validateCount = Array.isArray(value?.taskContract?.validate) ? value.taskContract.validate.length : 0;
      const task = preserveCount || validateCount ? `; task=${preserveCount}/${validateCount}` : '';
      logLine('op-meta', `fingerprint context -> ${product}; source=${source}; target=${targetPath}; layers=${layers.join(' > ') || '.'}; token fallback=${base}; style=${style}${task}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/ghost-token-source') {
      const value = line.value as { kind?: unknown; source?: unknown; css?: unknown; warnings?: unknown; baseDirectionId?: unknown } | undefined;
      if (typeof value?.css === 'string') {
        setActiveTokensSourceOverride(value.css);
        setSurfaceTokensSource(value.css);
      }
      const source = typeof value?.source === 'string' ? value.source : 'unknown';
      const kind = typeof value?.kind === 'string' ? value.kind : 'unknown';
      const base = typeof value?.baseDirectionId === 'string' ? `; base=${value.baseDirectionId}` : '';
      logLine('op-meta', `fingerprint tokens -> ${kind} (${source})${base}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/ghost-review-packet') {
      const value = line.value as { baseDirectionId?: unknown; styleSource?: unknown; artifactFiles?: unknown; validation?: { blocked?: unknown; warnings?: unknown } } | undefined;
      const base = typeof value?.baseDirectionId === 'string' ? value.baseDirectionId : 'none';
      const style = typeof value?.styleSource === 'string' ? value.styleSource : 'unknown';
      const artifactFiles = Array.isArray(value?.artifactFiles) ? value.artifactFiles.filter((file): file is string => typeof file === 'string') : [];
      const blocked = typeof value?.validation?.blocked === 'number' ? value.validation.blocked : 0;
      const warnings = typeof value?.validation?.warnings === 'number' ? value.validation.warnings : 0;
      logLine('op-meta', `fingerprint review packet -> base=${base}; style=${style}; artifact=${artifactFiles.join(', ') || 'none'}; validation=${blocked}/${warnings}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/validation-summary') {
      setCurrentValidationSummary(summarizeValidationMeta(line.value));
      logLine('op-meta', `validation -> ${JSON.stringify(line.value)}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/stream-graph-summary') {
      setCurrentStreamHealth(summarizeStreamGraphMeta(line.value));
      logLine('op-meta', `stream diagnostics -> ${JSON.stringify(line.value)}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/timing') {
      const timing = parseTimingEntry(line.value);
      if (timing) {
        appendTimingEntry(timing);
        logLine('op-meta', `timing -> ${timing.source}:${timing.phase} ${formatTimingMs(timing.elapsedMs)}`);
      } else {
        logLine('op-meta', `timing -> invalid ${JSON.stringify(line.value)}`);
      }
      return;
    }
    if (line.op === 'meta' && line.path === '/status') {
      const status = String(line.value);
      setStatus(status);
      logLine('op-meta', `status -> ${status}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/model-output-mode') {
      const value = line.value as { format?: unknown; schema?: unknown; repairAttempts?: unknown; repairing?: unknown } | undefined;
      const format = typeof value?.format === 'string' ? value.format : 'unknown';
      const schema = typeof value?.schema === 'string' ? value.schema : 'unknown';
      const repairs = typeof value?.repairAttempts === 'number' ? value.repairAttempts : 0;
      const repairing = Array.isArray(value?.repairing) ? `; repairing=${value.repairing.join(',')}` : '';
      logLine('op-meta', `model output -> ${format}; schema=${schema}; repairs=${repairs}${repairing}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/thinking') {
      const text = typeof line.value === 'string' ? line.value : JSON.stringify(line.value);
      logLine('op-meta', `. ${text.slice(0, 160)}${text.length > 160 ? '...' : ''}`);
      return;
    }
    if (line.op === 'meta') {
      logLine('op-meta', `meta ${line.path} = ${JSON.stringify(line.value)}`);
      return;
    }
    if (line.op === 'artifact') {
      const artifact = line.value as ArrowSurfaceArtifact | undefined;
      const files = artifact && artifact.runtime === 'arrow'
        ? Object.keys(artifact.source).join(', ')
        : 'invalid';
      logLine('op-add', `artifact ${line.path} -> ${files}`);
      artifactRevisionRef.current += 1;
      setArtifactRevision(artifactRevisionRef.current);
      return;
    }
  }, [
    appendDevEvent,
    appendTimingEntry,
    artifactRevisionRef,
    directionId,
    logLine,
    modeRef,
    setActiveTokensSourceOverride,
    setArtifactRevision,
    setBytes,
    setCurrentAgentGoalSummary,
    setCurrentAgentPolicySummary,
    setCurrentEffectiveSurfacePlan,
    setCurrentStreamHealth,
    setCurrentSurfaceContractView,
    setCurrentValidationSummary,
    setMode,
    setStatus,
    setSurfaceTokensSource,
    tokensFor,
  ]);

  return useCallback(async (opts: StreamOptions): Promise<StreamResult> => {
    const active = opts.active;
    const ghostRootId = ghostRootFromSelection(opts.directionId);
    const toolPack = toolPackFor(active);
    const surfaceRequest = opts.playgroundMode ? {} : surfaceRequestFor(active);
    const agent = opts.playgroundMode ? undefined : agentBrokerRequestFor(active);
    const streamStartedAt = performance.now();
    const markClientTiming = (
      phase: string,
      label: string,
      durationMs?: number,
    ) => {
      appendTimingEntry({
        phase,
        label,
        elapsedMs: roundMs(performance.now() - streamStartedAt),
        ...(durationMs === undefined ? {} : { durationMs: roundMs(durationMs) }),
        source: 'client',
      });
    };
    const validationContext: ValidationContext = {
      mode: active.mode,
      allowedTools: toolPack.tools.map((tool) => tool.name),
      tools: toolPack.tools,
      surfacePlan: active.surfacePlan,
    };

    const modelSelectionPayload = {
      ...(active.modelProvider ? { modelProvider: active.modelProvider } : {}),
      ...(active.generationModel ? { generationModel: active.generationModel } : {}),
      ...(active.utilityModel ? { utilityModel: active.utilityModel } : {}),
      ...(active.customModel ? { customModel: true } : {}),
      ...(active.modelOptions ? { modelOptions: active.modelOptions } : {}),
    };
    const steeringPayload = ghostRootId
      ? {
          fingerprint: {
            id: ghostRootId,
            targetPath: opts.ghostTargetPath,
            ...(opts.ghostBaseDirectionId ? { baseDirectionId: opts.ghostBaseDirectionId } : {}),
          },
        }
      : { directionId: opts.directionId };
    const requestBody = opts.playgroundMode
      ? {
          prompt: opts.prompt,
          playground: true,
          validationMode: 'observe',
          maxRepairAttempts: 0,
          ...modelSelectionPayload,
          ...steeringPayload,
          tools: toolPack,
        }
      : {
          prompt: opts.prompt,
          validationMode: 'enforce',
          ...modelSelectionPayload,
          ...steeringPayload,
          tools: toolPack,
          ...(agent ? { agent } : {}),
          ...surfaceRequest,
          ...(opts.layout ? { layout: opts.layout } : {}),
        };

    markClientTiming('request-start', 'Generation request started');
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: opts.signal,
    });
    markClientTiming('response-headers', 'Response headers received');

    if (!response.ok) {
      const text = await readErrorResponse(response);
      throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
    }
    if (!response.body) throw new Error('no response body');

    let byteTotal = 0;
    let firstByteSeen = false;
    let firstArtifactSeen = false;
    let surfacePlanFromStream: SurfacePlan | null = null;
    const result = await consumeSurfaceStream(chunksWithByteCounts(response.body, (count) => {
      if (!firstByteSeen) {
        firstByteSeen = true;
        markClientTiming('first-byte', 'First response byte received');
      }
      byteTotal += count;
      setBytes(byteTotal);
    }), {
      mode: () => modeRef.current,
      shouldApplyLine: () => 'apply',
      onLine: (line, context) => {
        appendDevEvent({ kind: 'server-line', at: Date.now(), line });
        if (line.op !== 'meta') applyLineTo(line, context);
      },
      onMeta: (line, context) => {
        if (line.path === '/surface-plan') surfacePlanFromStream = normalizeSurfacePlan(line.value);
        applyLineTo(line, context);
      },
      onArtifact: (artifact, line, context) => {
        if (!firstArtifactSeen) {
          firstArtifactSeen = true;
          markClientTiming('first-artifact', 'First accepted artifact received');
        }
        surfaceRef.current?.renderArtifact(artifact);
      },
      onSurfaceEvent: (event) => {
        setPreviewSnapshot((snapshot) =>
          reduceSurfacePreviewSnapshot(snapshot, event),
        );
        appendDevEvent({
          kind: 'surface-preview-event',
          at: Date.now(),
          surfaceId: surfaceRef.current?.surfaceId ?? 'pending',
          event,
        });
        if (event.type === 'surface.status') {
          setStatus(event.status);
          logLine('op-meta', `preview -> ${event.status}${event.text ? `: ${event.text}` : ''}`);
        } else {
          logLine('op-meta', `preview -> ${event.type}`);
        }
      },
      onParseError: (raw) => {
        appendDevEvent({ kind: 'transport-parse-error', at: Date.now(), raw });
        logLine('raw', `. ${raw.slice(0, 120)}`);
      },
      onGraph: (snapshot) => {
        appendDevEvent({
          kind: 'stream-graph',
          at: Date.now(),
          health: snapshot.health,
          artifacts: snapshot.artifacts.map(({ revision, runtime, bytes, firstSeenLine, lastUpdatedLine }) => ({
            revision,
            runtime,
            bytes,
            firstSeenLine,
            lastUpdatedLine,
          })),
        });
      },
      validationContext,
      validationMode: 'observe',
    });
    markClientTiming('stream-complete', 'Stream complete');
    if (
      active.surfacePlan.runtime === 'arrow' &&
      !result.protocolLines.some((line) => line.op === 'artifact' && line.path === '/artifact')
    ) {
      throw new Error(missingArtifactMessage(result.protocolLines));
    }

    return {
      ...result,
      surfacePlan: surfacePlanFromStream,
    };
  }, [
    appendDevEvent,
    applyLineTo,
    artifactRevisionRef,
    appendTimingEntry,
    logLine,
    modeRef,
    setBytes,
    setPreviewSnapshot,
    surfaceRef,
  ]);
}

function parseTimingEntry(value: unknown): Omit<TimingEntry, 'id' | 'at'> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.phase !== 'string') return null;
  if (typeof item.elapsedMs !== 'number' || !Number.isFinite(item.elapsedMs)) return null;
  const source = item.source === 'client' || item.source === 'server' ? item.source : null;
  if (!source) return null;
  const durationMs = typeof item.durationMs === 'number' && Number.isFinite(item.durationMs)
    ? roundMs(item.durationMs)
    : undefined;
  return {
    phase: item.phase,
    label: typeof item.label === 'string' ? item.label : item.phase,
    elapsedMs: roundMs(item.elapsedMs),
    ...(durationMs === undefined ? {} : { durationMs }),
    source,
  };
}

function roundMs(value: number): number {
  return Math.max(0, Math.round(value));
}

function formatTimingMs(value: number): string {
  return `${Math.round(value).toLocaleString()}ms`;
}

async function readErrorResponse(response: Response): Promise<string> {
  const text = await response.text().catch(() => '');
  if (!text) return '';
  try {
    const parsed = JSON.parse(text) as { error?: unknown };
    if (typeof parsed.error === 'string') return parsed.error;
  } catch {
    // Fall through to the raw response body.
  }
  return text;
}
