import {
  compileArtifactHtml,
  parseProtocolLine,
  SectionAccumulator,
  StreamGraph,
  type CompiledArtifactHtml,
  type CompiledHtmlNodePatch,
  type ContractIssue,
  type MetaLine,
  type ProtocolLine,
  type SectionApplyResult,
  type StreamGraphSnapshot,
  type SurfacePlanMode,
  type ValidationContext,
} from '@summon-internal/engine';

export type SurfaceStreamChunk = string | Uint8Array;
export type SurfaceStreamSource =
  | ReadableStream<SurfaceStreamChunk>
  | AsyncIterable<SurfaceStreamChunk>
  | Iterable<SurfaceStreamChunk>;

export type SurfaceStreamRenderMode = 'live' | 'final' | 'manual';
export type SurfaceStreamLineDecision =
  | boolean
  | 'apply'
  | 'discard'
  | 'stop';

export interface SurfaceStreamContext {
  lineNumber: number;
  raw?: string;
  accumulator: SectionAccumulator;
  graph: StreamGraph;
  protocolLines: readonly ProtocolLine[];
  acceptedStructuralLines: number;
  applyResult?: SectionApplyResult;
}

export interface SurfaceStreamParseError {
  lineNumber: number;
  raw: string;
}

export interface SurfaceStreamOptions {
  mode: SurfacePlanMode | (() => SurfacePlanMode);
  accumulator?: SectionAccumulator;
  streamGraph?: StreamGraph;
  renderMode?: SurfaceStreamRenderMode;
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
  onParseError?: (
    raw: string,
    context: SurfaceStreamContext,
  ) => void | Promise<void>;
  onGraph?: (
    snapshot: StreamGraphSnapshot,
    context: SurfaceStreamContext,
  ) => void | Promise<void>;
  onRenderHtml?: (
    html: CompiledArtifactHtml,
    context: SurfaceStreamContext,
  ) => void | Promise<void>;
  onNodePatch?: (
    patch: CompiledHtmlNodePatch,
    context: SurfaceStreamContext,
  ) => void | Promise<void>;
  onError?: (
    error: Error,
    context: SurfaceStreamContext,
  ) => void | Promise<void>;
  validationContext?: ValidationContext;
}

export interface SurfaceStreamResult {
  protocolLines: ProtocolLine[];
  html: CompiledArtifactHtml;
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
  const accumulator = options.accumulator ?? new SectionAccumulator();
  const graph = options.streamGraph ?? new StreamGraph();
  const protocolLines: ProtocolLine[] = [];
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
    applyResult?: SectionApplyResult,
  ): SurfaceStreamContext => ({
    lineNumber,
    raw,
    accumulator,
    graph,
    protocolLines,
    acceptedStructuralLines,
    ...(applyResult ? { applyResult } : {}),
  });

  const renderMode = (): SurfaceStreamRenderMode => (
    options.renderMode ?? (resolveMode(options.mode) === 'static' ? 'live' : 'final')
  );

  const emitGraph = async (ctx: SurfaceStreamContext) => {
    await options.onGraph?.(graph.snapshot(), ctx);
  };

  const emitRender = async (ctx: SurfaceStreamContext) => {
    if (!accumulator.hasAnySection()) return;
    await options.onRenderHtml?.(accumulator.compose() as CompiledArtifactHtml, ctx);
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

    const acceptedLine = compileAcceptedLine(line, options.validationContext, validationIssues, graph);
    if (!acceptedLine) {
      await emitGraph(context(raw));
      return;
    }

    graph.applyLine(acceptedLine);
    let applyResult: SectionApplyResult | undefined;
    if (acceptedLine.op !== 'meta') {
      applyResult = accumulator.applyDetailed(acceptedLine);
      acceptedStructuralLines += 1;
    }
    const ctx = context(raw, applyResult);
    protocolLines.push(acceptedLine);

    if (acceptedLine.op === 'meta' && acceptedLine.path === '/validation-blocked' && isContractIssue(acceptedLine.value)) {
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

    await emitGraph(ctx);
    if (renderMode() === 'live' && applyResult?.changed) {
      if (applyResult.nodePatch && options.onNodePatch) {
        await options.onNodePatch(applyResult.nodePatch as CompiledHtmlNodePatch, ctx);
        return;
      }
      await emitRender(ctx);
    }
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
    if (renderMode() === 'final') {
      await emitRender(finalContext);
    }
    await emitGraph(finalContext);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    await options.onError?.(error, context());
    throw error;
  }

  const html = accumulator.compose() as CompiledArtifactHtml;
  return {
    protocolLines,
    html,
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
  validationIssues: ContractIssue[],
  graph: StreamGraph,
): ProtocolLine | null {
  if (!validationContext || line.op !== 'add' || line.html === undefined) return line;
  const result = compileArtifactHtml(line.html, validationContext);
  let blocked = false;
  for (const issue of result.issues) {
    const scoped = issue.path ? issue : { ...issue, path: line.path };
    pushValidationIssue(validationIssues, scoped);
    graph.recordIssue(scoped);
    if (issue.severity === 'block') blocked = true;
  }
  if (blocked) return null;
  return { ...line, html: result.html };
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

function resolveMode(mode: SurfacePlanMode | (() => SurfacePlanMode)): SurfacePlanMode {
  return typeof mode === 'function' ? mode() : mode;
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
