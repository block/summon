import {
  useCallback,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import {
  consumeSurfaceStream,
  type HtmlStreamPreviewDelta,
  type SurfacePreviewSnapshot,
  type SurfaceStreamContext,
} from '@anarchitecture/summon/browser';
import {
  normalizeSurfacePlan,
  buildFingerprintSteeringPayload,
  runtimeProfile,
  type ArrowSurfaceArtifact,
  type HtmlSurfaceArtifact,
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
  missingArtifactMessage,
  parseSurfaceContractView,
  summarizeStreamGraphMeta,
  summarizeValidationMeta,
  surfaceRequestFor,
  toolPackFor,
} from '../surfaceHelpers.js';
import { createRunMetricsAccumulator } from '../runMetrics.js';
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
        gatheredNodes?: unknown;
        styleSource?: unknown;
        taskContract?: { preserve?: unknown; validate?: unknown };
      } | undefined;
      const product = typeof value?.product === 'string' ? value.product : 'Ghost fingerprint';
      const source = typeof value?.source === 'string' ? value.source : 'root';
      const targetPath = typeof value?.targetPath === 'string' ? value.targetPath : '.';
      const layers = Array.isArray(value?.layers) ? value.layers.filter((layer): layer is string => typeof layer === 'string') : [];
      const gatheredNodes = Array.isArray(value?.gatheredNodes)
        ? value.gatheredNodes.filter((node): node is string => typeof node === 'string')
        : [];
      const style = typeof value?.styleSource === 'string' ? value.styleSource : 'unknown';
      const preserveCount = Array.isArray(value?.taskContract?.preserve) ? value.taskContract.preserve.length : 0;
      const validateCount = Array.isArray(value?.taskContract?.validate) ? value.taskContract.validate.length : 0;
      const task = preserveCount || validateCount ? `; task=${preserveCount}/${validateCount}` : '';
      const nodes = gatheredNodes.length ? `; nodes=${gatheredNodes.join(',')}` : '';
      logLine('op-meta', `fingerprint context -> ${product}; source=${source}; target=${targetPath}; layers=${layers.join(' > ') || '.'}; style=${style}${nodes}${task}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/ghost-token-source') {
      const value = line.value as { kind?: unknown; source?: unknown; css?: unknown; warnings?: unknown } | undefined;
      if (typeof value?.css === 'string') {
        setActiveTokensSourceOverride(value.css);
        setSurfaceTokensSource(value.css);
      }
      const source = typeof value?.source === 'string' ? value.source : 'unknown';
      const kind = typeof value?.kind === 'string' ? value.kind : 'unknown';
      const warnings = Array.isArray(value?.warnings)
        ? value.warnings.filter((warning): warning is string => typeof warning === 'string')
        : [];
      const warn = warnings.length ? `; warnings=${warnings.length}` : '';
      logLine('op-meta', `fingerprint tokens -> ${kind} (${source})${warn}`);
      return;
    }
    if (line.op === 'meta' && line.path === '/ghost-conformance') {
      const value = line.value as {
        surface?: unknown;
        evaluated?: unknown;
        checks?: unknown;
        summary?: { pass?: unknown; fail?: unknown; inconclusive?: unknown };
      } | undefined;
      const evaluated = value?.evaluated === true;
      const summary = value?.summary;
      const pass = typeof summary?.pass === 'number' ? summary.pass : 0;
      const fail = typeof summary?.fail === 'number' ? summary.fail : 0;
      const inconclusive = typeof summary?.inconclusive === 'number' ? summary.inconclusive : 0;
      logLine('op-meta', `fingerprint conformance -> ${evaluated ? 'evaluated' : 'not evaluated'}; ${pass}p/${fail}f/${inconclusive}i`);
      const checks = parseConformanceChecks(value?.checks);
      for (const check of checks) {
        const reason = check.reason ? `: ${check.reason}` : '';
        logLine('op-meta', `  check ${check.name} [${check.severity}] -> ${check.verdict}${reason}`);
      }
      return;
    }
    if (line.op === 'meta' && line.path === '/ghost-receipt') {
      const value = line.value as {
        fingerprint?: {
          tokenSource?: { kind?: unknown };
          cascade?: unknown;
          gatheredNodes?: unknown;
          routedChecks?: unknown;
        };
        generation?: { artifactFiles?: unknown; validation?: { blocked?: unknown; warnings?: unknown } };
        conformance?: { evaluated?: unknown; summary?: { pass?: unknown; fail?: unknown; inconclusive?: unknown }; checks?: unknown };
      } | undefined;
      const style = typeof value?.fingerprint?.tokenSource?.kind === 'string' ? value.fingerprint.tokenSource.kind : 'unknown';
      const artifactFiles = Array.isArray(value?.generation?.artifactFiles)
        ? value.generation.artifactFiles.filter((file): file is string => typeof file === 'string')
        : [];
      const blocked = typeof value?.generation?.validation?.blocked === 'number' ? value.generation.validation.blocked : 0;
      const warnings = typeof value?.generation?.validation?.warnings === 'number' ? value.generation.validation.warnings : 0;
      const conf = value?.conformance?.summary;
      const pass = typeof conf?.pass === 'number' ? conf.pass : 0;
      const fail = typeof conf?.fail === 'number' ? conf.fail : 0;
      const inconclusive = typeof conf?.inconclusive === 'number' ? conf.inconclusive : 0;
      logLine('op-meta', `fingerprint receipt -> style=${style}; artifact=${artifactFiles.join(', ') || 'none'}; validation=${blocked}/${warnings}; conformance=${pass}p/${fail}f/${inconclusive}i`);

      const cascade = Array.isArray(value?.fingerprint?.cascade)
        ? value.fingerprint.cascade.filter((layer): layer is string => typeof layer === 'string')
        : [];
      if (cascade.length) logLine('op-meta', `  cascade -> ${cascade.join(' > ')}`);

      const gatheredNodes = parseGatheredNodes(value?.fingerprint?.gatheredNodes);
      if (gatheredNodes.length) {
        const rendered = gatheredNodes
          .map((node) => `${node.id}${node.provenance ? `(${node.provenance})` : ''}`)
          .join(', ');
        logLine('op-meta', `  gathered nodes -> ${rendered}`);
      }

      const routedChecks = parseRoutedChecks(value?.fingerprint?.routedChecks);
      if (routedChecks.length) {
        const rendered = routedChecks.map((check) => `${check.name}[${check.severity}]`).join(', ');
        logLine('op-meta', `  routed checks -> ${rendered}`);
      }

      const checks = parseConformanceChecks(value?.conformance?.checks);
      for (const check of checks) {
        const reason = check.reason ? `: ${check.reason}` : '';
        logLine('op-meta', `  conformance ${check.name} [${check.severity}] -> ${check.verdict}${reason}`);
      }
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
    if (line.op === 'meta' && line.path === '/html-stream-preview') {
      const delta = parseHtmlStreamPreviewDelta(line.value);
      if (delta) {
        surfaceRef.current?.applyHtmlPreviewDelta(delta);
        logLine('op-meta', `html preview -> ${delta.action} #${delta.target}`);
      }
      return;
    }
    if (line.op === 'meta' && line.path === '/html-stream-summary') {
      const value = line.value as { previewDeltaCount?: unknown; committedPatchCount?: unknown; blockedPatchReasons?: unknown } | undefined;
      const previewDeltaCount = typeof value?.previewDeltaCount === 'number' ? value.previewDeltaCount : 0;
      const committedPatchCount = typeof value?.committedPatchCount === 'number' ? value.committedPatchCount : 0;
      const blockedPatchReasons = Array.isArray(value?.blockedPatchReasons)
        ? value.blockedPatchReasons.filter((reason): reason is string => typeof reason === 'string')
        : [];
      const summary = `html preview=${previewDeltaCount} patches=${committedPatchCount} blocked=${blockedPatchReasons.length}`;
      setCurrentStreamHealth(summary);
      logLine('op-meta', `html stream -> ${summary}${blockedPatchReasons.length ? ` (${blockedPatchReasons.join(',')})` : ''}`);
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
      const value = line.value as { format?: unknown; schema?: unknown; runtime?: unknown; repairAttempts?: unknown; repairing?: unknown } | undefined;
      const format = typeof value?.format === 'string' ? value.format : 'unknown';
      const schema = typeof value?.schema === 'string' ? value.schema : 'unknown';
      const runtime = typeof value?.runtime === 'string' ? `; runtime=${value.runtime}` : '';
      const repairs = typeof value?.repairAttempts === 'number' ? value.repairAttempts : 0;
      const repairing = Array.isArray(value?.repairing) ? `; repairing=${value.repairing.join(',')}` : '';
      logLine('op-meta', `model output -> ${format}; schema=${schema}${runtime}; repairs=${repairs}${repairing}`);
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
      const artifact = line.value as ArrowSurfaceArtifact | HtmlSurfaceArtifact | { runtime?: string; source?: Record<string, string> } | undefined;
      const validArtifact = artifact?.runtime === 'arrow' || artifact?.runtime === 'html' || artifact?.runtime === 'domjs';
      const files = validArtifact && artifact?.source
        ? Object.keys(artifact.source).join(', ')
        : 'invalid';
      logLine('op-add', `${validArtifact ? artifact.runtime : 'unknown'} artifact ${line.path} -> ${files}`);
      artifactRevisionRef.current += 1;
      setArtifactRevision(artifactRevisionRef.current);
      return;
    }
  }, [
    appendDevEvent,
    appendTimingEntry,
    artifactRevisionRef,
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
    surfaceRef,
  ]);

  return useCallback(async (opts: StreamOptions): Promise<StreamResult> => {
    const active = opts.active;
    const toolPack = toolPackFor(active);
    const surfaceRequest = opts.playgroundMode ? {} : surfaceRequestFor(active);
    const agent = opts.playgroundMode ? undefined : agentBrokerRequestFor(active);
    const streamStartedAt = performance.now();
    const metrics = createRunMetricsAccumulator(opts.experimentalRuntime);
    const elapsedSinceStart = () => performance.now() - streamStartedAt;
    const markClientTiming = (
      phase: string,
      label: string,
      durationMs?: number,
    ): number => {
      const elapsedMs = roundMs(elapsedSinceStart());
      appendTimingEntry({
        phase,
        label,
        elapsedMs,
        ...(durationMs === undefined ? {} : { durationMs: roundMs(durationMs) }),
        source: 'client',
      });
      return elapsedMs;
    };
    const validationContext: ValidationContext = {
      mode: active.mode,
      allowedTools: toolPack.tools.map((tool) => tool.name),
      tools: toolPack.tools,
      surfacePlan: active.surfacePlan,
      experimentalHtmlScript: false,
    };

    const modelSelectionPayload = {
      ...(active.modelProvider ? { modelProvider: active.modelProvider } : {}),
      ...(active.generationModel ? { generationModel: active.generationModel } : {}),
      ...(active.utilityModel ? { utilityModel: active.utilityModel } : {}),
      ...(active.customModel ? { customModel: true } : {}),
      ...(active.modelOptions ? { modelOptions: active.modelOptions } : {}),
      ...(active.modelProfiles ? { modelProfiles: active.modelProfiles } : {}),
    };
    const steeringPayload = buildFingerprintSteeringPayload({
      id: opts.fingerprintId,
      targetPath: opts.fingerprintTargetPath,
    }) ?? {};
    const requestBody = opts.playgroundMode
      ? {
          prompt: opts.prompt,
          playground: true,
          validationMode: 'observe',
          maxRepairAttempts: 0,
          experimentalRuntime: opts.experimentalRuntime,
          ...modelSelectionPayload,
          ...steeringPayload,
          tools: toolPack,
        }
      : {
          prompt: opts.prompt,
          validationMode: 'enforce',
          experimentalRuntime: opts.experimentalRuntime,
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
    let firstPaintTimingSeen = false;
    let firstArtifactSeen = false;
    let surfacePlanFromStream: SurfacePlan | null = null;
    const noteFirstPaintTiming = () => {
      if (firstPaintTimingSeen || metrics.snapshot().ttfp === null) return;
      firstPaintTimingSeen = true;
      markClientTiming('first-paint', 'First preview content received');
    };
    const result = await consumeSurfaceStream(chunksWithByteCounts(response.body, (count) => {
      if (!firstByteSeen) {
        firstByteSeen = true;
        metrics.markFirstByte(markClientTiming('first-byte', 'First response byte received'));
      }
      byteTotal += count;
      metrics.setBytes(byteTotal);
      setBytes(byteTotal);
    }), {
      mode: () => modeRef.current,
      shouldApplyLine: () => 'apply',
      onLine: (line, context) => {
        appendDevEvent({ kind: 'server-line', at: Date.now(), line });
        metrics.observeProtocolLine(line, elapsedSinceStart());
        noteFirstPaintTiming();
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
      onHtmlPatch: (patch) => {
        surfaceRef.current?.applyHtmlPatch(patch);
        logLine('op-artifact', `html patch ${patch.action} #${patch.target}`);
      },
      onSurfaceEvent: (event) => {
        metrics.observeSurfaceEvent(event, elapsedSinceStart());
        noteFirstPaintTiming();
        const appliedSnapshot = surfaceRef.current?.applyPreviewEvent(event) ?? null;
        setPreviewSnapshot((snapshot) =>
          appliedSnapshot ?? reduceSurfacePreviewSnapshot(snapshot, event),
        );
        if (!appliedSnapshot) {
          appendDevEvent({
            kind: 'surface-preview-event',
            at: Date.now(),
            surfaceId: surfaceRef.current?.surfaceId ?? 'pending',
            event,
          });
        }
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
      validationMode: opts.playgroundMode ? 'observe' : 'enforce',
    });
    metrics.markComplete(markClientTiming('stream-complete', 'Stream complete'));
    if (
      !result.protocolLines.some((line) => line.op === 'artifact' && line.path === '/artifact')
    ) {
      throw new Error(missingArtifactMessage(result.protocolLines, opts.experimentalRuntime));
    }

    return {
      ...result,
      surfacePlan: surfacePlanFromStream,
      metrics: metrics.snapshot(),
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

interface ConformanceCheckSummary {
  name: string;
  severity: string;
  verdict: string;
  reason?: string;
}

function parseConformanceChecks(value: unknown): ConformanceCheckSummary[] {
  if (!Array.isArray(value)) return [];
  const checks: ConformanceCheckSummary[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Record<string, unknown>;
    if (typeof item.name !== 'string') continue;
    checks.push({
      name: item.name,
      severity: typeof item.severity === 'string' ? item.severity : 'unknown',
      verdict: typeof item.verdict === 'string' ? item.verdict : 'unknown',
      ...(typeof item.reason === 'string' && item.reason ? { reason: item.reason } : {}),
    });
  }
  return checks;
}

function parseGatheredNodes(value: unknown): Array<{ id: string; provenance?: string }> {
  if (!Array.isArray(value)) return [];
  const nodes: Array<{ id: string; provenance?: string }> = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Record<string, unknown>;
    if (typeof item.id !== 'string') continue;
    nodes.push({
      id: item.id,
      ...(typeof item.provenance === 'string' ? { provenance: item.provenance } : {}),
    });
  }
  return nodes;
}

function parseRoutedChecks(value: unknown): Array<{ name: string; severity: string }> {
  if (!Array.isArray(value)) return [];
  const checks: Array<{ name: string; severity: string }> = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Record<string, unknown>;
    if (typeof item.name !== 'string') continue;
    checks.push({
      name: item.name,
      severity: typeof item.severity === 'string' ? item.severity : 'unknown',
    });
  }
  return checks;
}

function roundMs(value: number): number {
  return Math.max(0, Math.round(value));
}

function formatTimingMs(value: number): string {
  return `${Math.round(value).toLocaleString()}ms`;
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
