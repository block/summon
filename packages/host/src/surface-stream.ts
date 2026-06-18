import {
  normalizeArrowSurfaceArtifact,
  normalizeValidationLimits,
  parseProtocolLine,
  StreamGraph,
  validateProtocolLine,
  validateArrowSurfaceArtifact,
  type ContractIssue,
  type ArrowSurfaceArtifact,
  type ArtifactLine,
  type MetaLine,
  type ProtocolLine,
  type ProtocolValidationMode,
  type SurfaceEvent,
  type SurfaceEventLine,
  type StreamGraphSnapshot,
  type SurfacePlanMode,
  type ValidationContext,
} from '@summon-internal/engine';

export type SurfaceStreamChunk = string | Uint8Array;
export type SurfaceStreamSource =
  | ReadableStream<SurfaceStreamChunk>
  | AsyncIterable<SurfaceStreamChunk>
  | Iterable<SurfaceStreamChunk>;

export type SurfaceStreamLineDecision =
  | boolean
  | 'apply'
  | 'discard'
  | 'stop';

export interface SurfaceStreamContext {
  lineNumber: number;
  raw?: string;
  graph: StreamGraph;
  protocolLines: readonly ProtocolLine[];
  acceptedStructuralLines: number;
}

export interface SurfaceStreamParseError {
  lineNumber: number;
  raw: string;
}

export interface SurfaceStreamOptions {
  mode: SurfacePlanMode | (() => SurfacePlanMode);
  streamGraph?: StreamGraph;
  shouldApplyLine?: (
    line: ProtocolLine,
    context: SurfaceStreamContext,
  ) => SurfaceStreamLineDecision | Promise<SurfaceStreamLineDecision>;
  onLine?: (
    line: ProtocolLine,
    context: SurfaceStreamContext,
  ) => void | Promise<void>;
  onMeta?: (
    line: MetaLine,
    context: SurfaceStreamContext,
  ) => void | Promise<void>;
  onSurfaceEvent?: (
    event: SurfaceEvent,
    line: SurfaceEventLine,
    context: SurfaceStreamContext,
  ) => void | Promise<void>;
  onArtifact?: (
    artifact: ArrowSurfaceArtifact,
    line: ArtifactLine,
    context: SurfaceStreamContext,
  ) => void | Promise<void>;
  onParseError?: (
    raw: string,
    context: SurfaceStreamContext,
  ) => void | Promise<void>;
  onGraph?: (
    snapshot: StreamGraphSnapshot,
    context: SurfaceStreamContext,
  ) => void | Promise<void>;
  onError?: (
    error: Error,
    context: SurfaceStreamContext,
  ) => void | Promise<void>;
  validationContext?: ValidationContext;
  validationMode?: ProtocolValidationMode;
}

export interface SurfaceStreamResult {
  protocolLines: ProtocolLine[];
  surfaceEvents: SurfaceEvent[];
  streamGraph: StreamGraphSnapshot;
  validationIssues: ContractIssue[];
  parseErrors: SurfaceStreamParseError[];
  stopped: boolean;
  discarded: boolean;
}

export async function consumeSurfaceStream(
  source: SurfaceStreamSource,
  options: SurfaceStreamOptions,
): Promise<SurfaceStreamResult> {
  const graph = options.streamGraph ?? new StreamGraph();
  const protocolLines: ProtocolLine[] = [];
  const surfaceEvents: SurfaceEvent[] = [];
  const validationIssues: ContractIssue[] = [];
  const parseErrors: SurfaceStreamParseError[] = [];
  const decoder = new TextDecoder();
  let buffer = '';
  let lineNumber = 0;
  let acceptedStructuralLines = 0;
  let stopped = false;
  let discarded = false;

  const context = (
    raw?: string,
  ): SurfaceStreamContext => ({
    lineNumber,
    raw,
    graph,
    protocolLines,
    acceptedStructuralLines,
  });

  const emitGraph = async (ctx: SurfaceStreamContext) => {
    await options.onGraph?.(graph.snapshot(), ctx);
  };

  const handleRawLine = async (raw: string) => {
    lineNumber += 1;
    if (stopped) return;
    if (!raw.trim()) return;

    const line = parseProtocolLine(raw);
    if (!line) {
      const error = { lineNumber, raw };
      parseErrors.push(error);
      await options.onParseError?.(raw, context(raw));
      return;
    }

    const decision = normalizeLineDecision(
      await options.shouldApplyLine?.(line, context(raw)),
    );
    if (decision === 'discard' || decision === 'stop') {
      discarded = true;
      if (decision === 'stop') stopped = true;
      return;
    }

    const acceptedLine = compileAcceptedLine(
      line,
      options.validationContext,
      options.validationMode ?? 'enforce',
      validationIssues,
      graph,
    );
    if (!acceptedLine) {
      await emitGraph(context(raw));
      return;
    }

    graph.applyLine(acceptedLine);
    if (acceptedLine.op !== 'meta') {
      acceptedStructuralLines += 1;
    }
    const ctx = context(raw);
    protocolLines.push(acceptedLine);

    if (acceptedLine.op === 'meta' && acceptedLine.path === '/validation-blocked' && isContractIssue(acceptedLine.value)) {
      pushValidationIssue(validationIssues, acceptedLine.value);
    }
    if (acceptedLine.op === 'meta' && acceptedLine.path === '/validation-observed' && isContractIssue(acceptedLine.value)) {
      pushValidationIssue(validationIssues, acceptedLine.value);
    }
    if (acceptedLine.op === 'meta' && acceptedLine.path === '/validation-summary') {
      for (const issue of validationSummaryExamples(acceptedLine.value)) {
        pushValidationIssue(validationIssues, issue);
      }
    }

    await options.onLine?.(acceptedLine, ctx);
    if (acceptedLine.op === 'meta') {
      await options.onMeta?.(acceptedLine, ctx);
      return;
    }
    if (acceptedLine.op === 'event') {
      await emitGraph(ctx);
      if (isSurfaceEventValue(acceptedLine.value)) {
        surfaceEvents.push(acceptedLine.value);
        await options.onSurfaceEvent?.(acceptedLine.value, acceptedLine, ctx);
      }
      return;
    }
    if (acceptedLine.op === 'artifact') {
      await emitGraph(ctx);
      if (isArrowSurfaceArtifactValue(acceptedLine.value)) {
        await options.onArtifact?.(acceptedLine.value, acceptedLine, ctx);
      }
      return;
    }

    await emitGraph(ctx);
  };

  try {
    for await (const chunk of chunksFromSource(source)) {
      if (stopped) break;
      buffer += decodeChunk(chunk, decoder);
      let nl = buffer.indexOf('\n');
      while (nl !== -1) {
        await handleRawLine(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
        if (stopped) break;
        nl = buffer.indexOf('\n');
      }
    }

    if (!stopped) buffer += decoder.decode();
    const tail = buffer.trim();
    if (tail) await handleRawLine(tail);

    const finalContext = context();
    await emitGraph(finalContext);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    await options.onError?.(error, context());
    throw error;
  }

  return {
    protocolLines,
    surfaceEvents,
    streamGraph: graph.snapshot(),
    validationIssues,
    parseErrors,
    stopped,
    discarded,
  };
}

function compileAcceptedLine(
  line: ProtocolLine,
  validationContext: ValidationContext | undefined,
  validationMode: ProtocolValidationMode,
  validationIssues: ContractIssue[],
  graph: StreamGraph,
): ProtocolLine | null {
  if (line.op === 'artifact') {
    return compileAcceptedArtifactLine(line, validationContext, validationMode, validationIssues, graph);
  }
  if (line.op === 'event') {
    return compileAcceptedEventLine(line, validationContext, validationIssues, graph);
  }
  if (line.op === 'meta') return line;
  return null;
}

function compileAcceptedEventLine(
  line: SurfaceEventLine,
  validationContext: ValidationContext | undefined,
  validationIssues: ContractIssue[],
  graph: StreamGraph,
): SurfaceEventLine | null {
  const issues = validateProtocolLine(line, validationContext ?? {
    mode: 'static',
    allowedTools: [],
    tools: [],
  });
  let blocked = false;
  for (const issue of issues) {
    pushValidationIssue(validationIssues, issue);
    graph.recordIssue(issue);
    if (issue.severity === 'block') blocked = true;
  }
  if (blocked || !isSurfaceEventValue(line.value)) return null;
  return line;
}

function compileAcceptedArtifactLine(
  line: ArtifactLine,
  validationContext: ValidationContext | undefined,
  validationMode: ProtocolValidationMode,
  validationIssues: ContractIssue[],
  graph: StreamGraph,
): ArtifactLine | null {
  const normalized = normalizeArrowSurfaceArtifact(line.value);
  const observedArtifact = validationMode === 'observe'
    ? artifactFromObservedValue(line.value)
    : null;
  const issues = [...normalized.issues];
  if (normalized.artifact) {
    const limits = normalizeValidationLimits(validationContext?.limits);
    issues.push(...validateArrowSurfaceArtifact(normalized.artifact, {
      maxSourceBytes: limits.maxProtocolLineBytes,
      network: validationContext?.surfacePlan?.network ?? 'none',
    }));
  }

  let blocked = false;
  for (const issue of issues) {
    pushValidationIssue(validationIssues, issue);
    graph.recordIssue(issue);
    if (issue.severity === 'block') blocked = true;
  }
  if ((blocked && validationMode !== 'observe') || (!normalized.artifact && !observedArtifact)) return null;
  return { ...line, value: normalized.artifact ?? observedArtifact };
}

function artifactFromObservedValue(value: unknown): ArrowSurfaceArtifact | null {
  if (!isArrowSurfaceArtifactValue(value)) return null;
  return value;
}

function isArrowSurfaceArtifactValue(value: unknown): value is ArrowSurfaceArtifact {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (value as { runtime?: unknown }).runtime === 'arrow' &&
    typeof (value as { source?: unknown }).source === 'object' &&
    (value as { source?: unknown }).source !== null &&
    !Array.isArray((value as { source?: unknown }).source)
  );
}

function isSurfaceEventValue(value: unknown): value is SurfaceEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  switch (event.type) {
    case 'surface.start':
      return typeof event.id === 'string' && typeof event.kind === 'string';
    case 'region.add':
      return typeof event.id === 'string' && typeof event.role === 'string';
    case 'node.add':
      return typeof event.id === 'string' && typeof event.parent === 'string' && typeof event.kind === 'string';
    case 'node.patch':
      return typeof event.id === 'string' && !!event.props && typeof event.props === 'object' && !Array.isArray(event.props);
    case 'surface.status':
      return event.status === 'planning' ||
        event.status === 'contract' ||
        event.status === 'drafting' ||
        event.status === 'validating' ||
        event.status === 'rendering' ||
        event.status === 'finalizing';
    case 'surface.finalize':
      return event.artifactExpected === true;
    default:
      return false;
  }
}

async function* chunksFromSource(
  source: SurfaceStreamSource,
): AsyncGenerator<SurfaceStreamChunk, void, void> {
  if (isReadableStream(source)) {
    const reader = source.getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) return;
        if (value !== undefined) yield value;
      }
    } finally {
      reader.releaseLock();
    }
    return;
  }

  if (isAsyncIterable(source)) {
    for await (const chunk of source) yield chunk;
    return;
  }

  for (const chunk of source) yield chunk;
}

function decodeChunk(chunk: SurfaceStreamChunk, decoder: TextDecoder): string {
  return typeof chunk === 'string'
    ? decoder.decode() + chunk
    : decoder.decode(chunk, { stream: true });
}

function normalizeLineDecision(
  decision: SurfaceStreamLineDecision | undefined,
): Exclude<SurfaceStreamLineDecision, boolean> {
  if (decision === undefined || decision === true || decision === 'apply') return 'apply';
  if (decision === false || decision === 'discard') return 'discard';
  return 'stop';
}

function isReadableStream(value: SurfaceStreamSource): value is ReadableStream<SurfaceStreamChunk> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getReader' in value &&
    typeof value.getReader === 'function'
  );
}

function isAsyncIterable(
  value: SurfaceStreamSource,
): value is AsyncIterable<SurfaceStreamChunk> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Symbol.asyncIterator in value
  );
}

function isContractIssue(value: unknown): value is ContractIssue {
  if (!value || typeof value !== 'object') return false;
  const issue = value as Partial<ContractIssue>;
  return (
    typeof issue.source === 'string' &&
    (issue.severity === 'block' || issue.severity === 'warn') &&
    typeof issue.code === 'string' &&
    typeof issue.message === 'string'
  );
}

function validationSummaryExamples(value: unknown): ContractIssue[] {
  if (!value || typeof value !== 'object') return [];
  const summary = value as { examples?: unknown };
  if (!Array.isArray(summary.examples)) return [];
  return summary.examples.filter(isContractIssue);
}

function pushValidationIssue(issues: ContractIssue[], issue: ContractIssue): void {
  if (issues.some((candidate) => sameIssue(candidate, issue))) return;
  issues.push(issue);
}

function sameIssue(a: ContractIssue, b: ContractIssue): boolean {
  return (
    a.source === b.source &&
    a.severity === b.severity &&
    a.code === b.code &&
    a.message === b.message &&
    a.path === b.path
  );
}
