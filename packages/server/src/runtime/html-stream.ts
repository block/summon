import {
  contractIssue,
  runtimeProfile,
  validateProtocolLine,
  type ContractIssue,
  type ContractPromptBlock,
  type HtmlPatchAction,
  type HtmlSurfacePatch,
  type ProtocolLine,
} from '@summon-internal/engine';
import type { RuntimeValidationResult } from './bundle.js';
import { validateAndAcceptHtmlBundle } from './html-bundle.js';
import {
  missingArtifactIssueForProfile,
  nowMs,
  writeInitialOutputMode,
  type RuntimeContext,
  type RuntimeStrategy,
} from './strategy.js';

export const HTML_STREAM_SCAFFOLD_START = '@@summon-html-scaffold';
export const HTML_STREAM_SCAFFOLD_END = '@@end-summon-html-scaffold';
export const HTML_STREAM_PATCH_START = '@@summon-html-patch';
export const HTML_STREAM_PATCH_END = '@@end-summon-html-patch';

export const HTML_STREAM_FRAME_PROMPT_BLOCK: ContractPromptBlock = {
  id: 'html-stream-frame-protocol',
  cache: 'none',
  text: [
    'Experimental HTML stream protocol:',
    '',
    'Return raw text frames only. Do not call tools and do not return markdown fences.',
    '',
    'First emit exactly one scaffold frame containing a complete summon.html-bundle/v0 JSON object. The scaffold must contain stable element ids that future patches target and should render lightweight visible placeholders so the container is never blank while patch frames are still streaming. Do not include source["main.js"] or any <script>.',
    'If you include preview.regions, it must be an array of objects with string id and role fields, for example { "id": "hero", "role": "summary", "label": "Hero" }. Do not use strings in preview.regions.',
    '',
    HTML_STREAM_SCAFFOLD_START,
    '{',
    '  "schema": "summon.html-bundle/v0",',
    '  "preview": { "kind": "surface", "title": "Short title" },',
    '  "source": {',
    '    "body.html": "<main><section id=\\"hero\\"></section><section id=\\"content\\"></section></main>",',
    '    "main.css": "/* optional CSS */"',
    '  }',
    '}',
    HTML_STREAM_SCAFFOLD_END,
    '',
    'After the scaffold is complete, emit one or more patch frames. Do not stop after the scaffold; this runtime exists to test streamed preview deltas and validated patch commits. Each patch frame starts with one marker line. target must be one stable id from the scaffold. action must be append, replace, update, remove, or morph.',
    '',
    '@@summon-html-patch target="hero" action="replace"',
    '<section id="hero"><h1>Complete validated fragment</h1></section>',
    HTML_STREAM_PATCH_END,
    '',
    'Patch body text may stream gradually, but the server treats it as preview-only until the end marker arrives. Patch bodies must start directly with HTML markup (`<...>`). Do not include reasoning, commentary, markdown, or labels before or inside the patch body.',
    'Every committed patch fragment must be complete safe HTML: no scripts, external URLs, forms, iframes, inline event handlers, data-summon-* attributes, or parent/window/storage/network behavior.',
  ].join('\n'),
};

export interface HtmlStreamPreviewDelta {
  runtime: 'html';
  target: string;
  action: HtmlPatchAction;
  delta: string;
}

export type HtmlStreamAccumulatorEvent =
  | {
      type: 'scaffold';
      bundle: unknown;
    }
  | {
      type: 'preview-delta';
      value: HtmlStreamPreviewDelta;
    }
  | {
      type: 'patch';
      patch: HtmlSurfacePatch;
    }
  | {
      type: 'error';
      issue: ContractIssue;
    };

type HtmlStreamAccumulatorState =
  | 'waiting-scaffold'
  | 'reading-scaffold'
  | 'waiting-patch'
  | 'reading-patch'
  | 'failed';

const PATCH_ACTIONS = new Set<HtmlPatchAction>(['append', 'replace', 'update', 'remove', 'morph']);
const TARGET_ID_RE = /^[A-Za-z][A-Za-z0-9_-]{0,79}$/;
const MAX_FRAME_CHARS = 512 * 1024;
const PATCH_BODY_RESERVED_MARKERS = [
  HTML_STREAM_SCAFFOLD_START,
  HTML_STREAM_SCAFFOLD_END,
  HTML_STREAM_PATCH_START,
  HTML_STREAM_PATCH_END,
];

export class HtmlStreamAccumulator {
  private state: HtmlStreamAccumulatorState = 'waiting-scaffold';
  private buffer = '';
  private currentPatch: {
    target: string;
    action: HtmlPatchAction;
    html: string;
    previewHtml: string;
  } | null = null;

  push(chunk: string): HtmlStreamAccumulatorEvent[] {
    if (this.state === 'failed') return [];
    this.buffer += chunk;
    return this.drain(false);
  }

  finish(): HtmlStreamAccumulatorEvent[] {
    if (this.state === 'failed') return [];
    return this.drain(true);
  }

  private drain(final: boolean): HtmlStreamAccumulatorEvent[] {
    const events: HtmlStreamAccumulatorEvent[] = [];
    while (this.state !== 'failed') {
      if (this.buffer.length > MAX_FRAME_CHARS) {
        events.push(this.fail('html-stream-frame-limit', 'HTML stream frame exceeded the server accumulator limit', '/html-stream'));
        break;
      }

      if (this.state === 'waiting-scaffold') {
        if (!this.consumeScaffoldStart(events, final)) break;
        continue;
      }

      if (this.state === 'reading-scaffold') {
        if (!this.consumeScaffoldBody(events, final)) break;
        continue;
      }

      if (this.state === 'waiting-patch') {
        if (!this.consumePatchStart(events, final)) break;
        continue;
      }

      if (this.state === 'reading-patch') {
        if (!this.consumePatchBody(events, final)) break;
        continue;
      }

      break;
    }
    return events;
  }

  private consumeScaffoldStart(events: HtmlStreamAccumulatorEvent[], final: boolean): boolean {
    const marker = findExactMarkerLine(this.buffer, HTML_STREAM_SCAFFOLD_START);
    if (!marker) {
      if (final) {
        events.push(this.fail(
          'missing-html-stream-scaffold',
          'HTML stream completed without a scaffold frame',
          '/html-stream/scaffold',
        ));
      } else {
        this.keepPossibleMarkerTail(HTML_STREAM_SCAFFOLD_START.length);
      }
      return false;
    }
    // Some streaming providers can surface reasoning/commentary text before the
    // first answer token. Keep that text preview-only by discarding it; the
    // scaffold marker remains the first accepted frame boundary.
    this.buffer = this.buffer.slice(marker.nextIndex);
    this.state = 'reading-scaffold';
    return true;
  }

  private consumeScaffoldBody(events: HtmlStreamAccumulatorEvent[], final: boolean): boolean {
    const marker = findExactMarkerLine(this.buffer, HTML_STREAM_SCAFFOLD_END);
    if (!marker) {
      if (final) {
        events.push(this.fail(
          'unclosed-html-stream-scaffold',
          'HTML stream scaffold frame was not closed',
          '/html-stream/scaffold',
        ));
      }
      return false;
    }

    const rawJson = this.buffer.slice(0, marker.index).trim();
    this.buffer = this.buffer.slice(marker.nextIndex);
    this.state = 'waiting-patch';
    try {
      events.push({ type: 'scaffold', bundle: JSON.parse(rawJson) as unknown });
    } catch {
      events.push(this.fail(
        'invalid-html-stream-scaffold-json',
        'HTML stream scaffold frame did not contain valid JSON',
        '/html-stream/scaffold',
      ));
    }
    return true;
  }

  private consumePatchStart(events: HtmlStreamAccumulatorEvent[], final: boolean): boolean {
    const markerLine = findMarkerLine(this.buffer, HTML_STREAM_PATCH_START);
    if (!markerLine) {
      if (final) {
        // Ignore trailing commentary after the scaffold. Only framed patches are
        // accepted into preview or commit paths.
        this.buffer = '';
      } else {
        this.keepPossibleMarkerTail(HTML_STREAM_PATCH_START.length);
      }
      return false;
    }

    // Drop reasoning/commentary between frames instead of previewing or
    // committing it. Only explicit patch frames are accepted.
    if (!markerLine.hasLineBreak && !final) {
      return false;
    }
    if (!markerLine.hasLineBreak && final) {
      if (final) {
        events.push(this.fail(
          'unclosed-html-stream-patch-marker',
          'HTML stream patch marker was not followed by a patch body',
          '/html-stream/patch',
        ));
      }
      return false;
    }

    const marker = this.buffer.slice(markerLine.index, markerLine.lineEnd).trim();
    const parsed = parsePatchMarker(marker);
    if (!parsed.ok) {
      events.push(this.fail(parsed.code, parsed.message, '/html-stream/patch'));
      return false;
    }

    this.currentPatch = {
      target: parsed.target,
      action: parsed.action,
      html: '',
      previewHtml: '',
    };
    this.buffer = this.buffer.slice(markerLine.nextIndex);
    this.state = 'reading-patch';
    return true;
  }

  private consumePatchBody(events: HtmlStreamAccumulatorEvent[], final: boolean): boolean {
    const patch = this.currentPatch;
    if (!patch) {
      events.push(this.fail('internal-html-stream-state', 'HTML stream accumulator lost patch state', '/html-stream/patch'));
      return false;
    }

    const endMarker = findExactMarkerLine(this.buffer, HTML_STREAM_PATCH_END);
    if (!endMarker) {
      const reserved = findReservedPatchBodyMarker(this.buffer);
      if (reserved) {
        events.push(this.fail(
          'html-stream-marker-in-patch-body',
          `HTML stream patch body contains reserved marker token "${reserved.marker}"`,
          '/html-stream/patch',
        ));
        return false;
      }
      if (final) {
        events.push(this.fail(
          'unclosed-html-stream-patch',
          `HTML stream patch for "${patch.target}" was not closed`,
          '/html-stream/patch',
        ));
        return false;
      }
      const keepChars = possibleMarkerTailLengthForMarkers(this.buffer, PATCH_BODY_RESERVED_MARKERS);
      const preview = this.buffer.slice(0, this.buffer.length - keepChars);
      this.buffer = this.buffer.slice(this.buffer.length - keepChars);
      this.appendPatchPreview(events, patch, preview);
      return false;
    }

    const preview = this.buffer.slice(0, endMarker.index);
    const reserved = findReservedPatchBodyMarker(preview);
    if (reserved) {
      events.push(this.fail(
        'html-stream-marker-in-patch-body',
        `HTML stream patch body contains reserved marker token "${reserved.marker}"`,
        '/html-stream/patch',
      ));
      return false;
    }
    this.appendPatchPreview(events, patch, preview);
    this.buffer = this.buffer.slice(endMarker.nextIndex);
    const committedHtml = cleanPatchHtml(patch.html);
    const includeHtml = patch.action !== 'remove' || committedHtml.trim().length > 0;
    const committedPatch: HtmlSurfacePatch = {
      runtime: 'html',
      action: patch.action,
      target: patch.target,
      ...(includeHtml ? { html: committedHtml } : {}),
    };
    events.push({ type: 'patch', patch: committedPatch });
    this.currentPatch = null;
    this.state = 'waiting-patch';
    return true;
  }

  private appendPatchPreview(
    events: HtmlStreamAccumulatorEvent[],
    patch: { target: string; action: HtmlPatchAction; html: string; previewHtml: string },
    delta: string,
  ): void {
    if (!delta) return;
    patch.html += delta;
    const nextPreviewHtml = previewPatchHtml(patch.html);
    if (nextPreviewHtml.length <= patch.previewHtml.length) return;
    const previewDelta = nextPreviewHtml.slice(patch.previewHtml.length);
    patch.previewHtml = nextPreviewHtml;
    events.push({
      type: 'preview-delta',
      value: {
        runtime: 'html',
        target: patch.target,
        action: patch.action,
        delta: previewDelta,
      },
    });
  }

  private keepPossibleMarkerTail(markerLength: number): void {
    const keep = Math.max(0, markerLength - 1);
    if (this.buffer.length > keep) {
      const discarded = this.buffer.slice(0, this.buffer.length - keep);
      this.buffer = discarded.trim() ? this.buffer : this.buffer.slice(this.buffer.length - keep);
    }
  }

  private fail(code: string, message: string, path: string): HtmlStreamAccumulatorEvent {
    this.state = 'failed';
    return {
      type: 'error',
      issue: contractIssue({
        source: 'protocol',
        severity: 'block',
        code,
        message,
        path,
      }),
    };
  }
}

export class HtmlStreamStrategy implements RuntimeStrategy {
  readonly profile = runtimeProfile('html-stream');

  async writeInitialOutputMode(ctx: RuntimeContext): Promise<void> {
    await writeInitialOutputMode(ctx);
  }

  async consume(ctx: RuntimeContext): Promise<void> {
    if (!ctx.input.playground) {
      await ctx.emitServerPreviewScaffold();
    }
    if (!ctx.input.modelProvider.streamHtmlSurface) {
      await ctx.blockGeneration(contractIssue({
        source: 'system',
        severity: 'block',
        code: 'missing-html-stream-provider',
        message: 'Experimental runtime "html-stream" requires a model provider with streamHtmlSurface()',
        path: '/model-provider',
      }));
      return;
    }

    await ctx.writePhase('drafting', 'Streaming HTML surface');
    await ctx.writeTiming('drafting', 'Streaming HTML surface');
    const providerStartedAt = nowMs();
    const accumulator = new HtmlStreamAccumulator();
    const counters = {
      previewDeltaCount: 0,
      committedPatchCount: 0,
      scaffoldCount: 0,
      blockedPatchReasons: [] as string[],
    };

    const processEvents = async (events: HtmlStreamAccumulatorEvent[]) => {
      for (const event of events) {
        if (ctx.isBlocked()) return;
        if (event.type === 'error') {
          counters.blockedPatchReasons.push(event.issue.code);
          await writeHtmlStreamSummary(ctx, counters);
          await ctx.blockGeneration(event.issue);
          return;
        }
        if (event.type === 'preview-delta') {
          counters.previewDeltaCount += 1;
          await ctx.writeProtocolLine({
            op: 'meta',
            path: '/html-stream-preview',
            value: event.value,
          });
          continue;
        }
        if (event.type === 'scaffold') {
          counters.scaffoldCount += 1;
          const result = await validateAndAcceptHtmlBundle(ctx, event.bundle, 0, false, { strict: true });
          if (!result.accepted) {
            counters.blockedPatchReasons.push(result.blocker.code);
            await writeHtmlStreamSummary(ctx, counters);
            await ctx.blockGeneration(result.blocker);
          }
          continue;
        }
        if (event.type === 'patch') {
          const result = await validateAndAcceptHtmlPatch(ctx, event.patch);
          if (result.accepted) {
            counters.committedPatchCount += 1;
          } else {
            counters.blockedPatchReasons.push(result.blocker.code);
            await writeHtmlStreamSummary(ctx, counters);
            await ctx.blockGeneration(result.blocker);
          }
        }
      }
    };

    await ctx.withStatusHeartbeat({
      status: 'drafting',
      messages: [
        'Still streaming HTML preview',
        'Waiting for validated HTML patch frame',
        'Keeping raw HTML preview inert until commit',
      ],
      run: async () => {
        const stream = ctx.input.modelProvider.streamHtmlSurface!({
          prompt: ctx.input.prompt,
          promptBlocks: [
            ...ctx.systemContracts.promptBlocks,
            HTML_STREAM_FRAME_PROMPT_BLOCK,
          ],
          runtime: 'html-stream',
          signal: ctx.input.signal,
        });
        for await (const chunk of stream) {
          if (ctx.input.signal?.aborted || ctx.isBlocked()) break;
          await processEvents(accumulator.push(chunk));
        }
        if (!ctx.isBlocked()) await processEvents(accumulator.finish());
      },
    });

    if (
      !ctx.isBlocked() &&
      counters.scaffoldCount > 0 &&
      counters.previewDeltaCount === 0 &&
      counters.committedPatchCount === 0
    ) {
      const issue = contractIssue({
        source: 'protocol',
        severity: 'block',
        code: 'missing-html-stream-patch',
        message: 'HTML stream completed after the scaffold without any patch frame. Emit at least one @@summon-html-patch frame so the stream has visible preview and commit output.',
        path: '/html-stream/patch',
      });
      counters.blockedPatchReasons.push(issue.code);
      await writeHtmlStreamSummary(ctx, counters);
      await ctx.blockGeneration(issue);
    }

    await ctx.writeTiming(
      'bundle-received',
      'Received streamed HTML frames',
      nowMs() - providerStartedAt,
    );
    await writeHtmlStreamSummary(ctx, counters);
  }

  missingArtifactIssue(): ContractIssue {
    return missingArtifactIssueForProfile(this.profile);
  }
}

interface MarkerLine {
  index: number;
  lineEnd: number;
  nextIndex: number;
  hasLineBreak: boolean;
}

function findExactMarkerLine(buffer: string, marker: string): MarkerLine | null {
  let from = 0;
  while (from < buffer.length) {
    const line = findMarkerLine(buffer, marker, from);
    if (!line) return null;
    if (buffer.slice(line.index, line.lineEnd).trim() === marker) return line;
    from = line.index + marker.length;
  }
  return null;
}

function findMarkerLine(buffer: string, marker: string, from = 0): MarkerLine | null {
  let index = buffer.indexOf(marker, from);
  while (index !== -1) {
    if (isLineStart(buffer, index)) {
      const newline = buffer.indexOf('\n', index);
      const hasLineBreak = newline !== -1;
      const lineEnd = hasLineBreak ? newline : buffer.length;
      return {
        index,
        lineEnd,
        nextIndex: hasLineBreak ? newline + 1 : buffer.length,
        hasLineBreak,
      };
    }
    index = buffer.indexOf(marker, index + marker.length);
  }
  return null;
}

function isLineStart(buffer: string, index: number): boolean {
  return index === 0 || buffer[index - 1] === '\n';
}

function findReservedPatchBodyMarker(buffer: string): { marker: string; index: number } | null {
  let found: { marker: string; index: number } | null = null;
  for (const marker of PATCH_BODY_RESERVED_MARKERS) {
    const index = buffer.indexOf(marker);
    if (index === -1) continue;
    if (!found || index < found.index) found = { marker, index };
  }
  return found;
}

function possibleMarkerTailLength(buffer: string, marker: string): number {
  const max = Math.min(marker.length - 1, buffer.length);
  for (let length = max; length > 0; length -= 1) {
    if (marker.startsWith(buffer.slice(buffer.length - length))) return length;
  }
  return 0;
}

function possibleMarkerTailLengthForMarkers(buffer: string, markers: readonly string[]): number {
  let keep = 0;
  for (const marker of markers) {
    keep = Math.max(keep, possibleMarkerTailLength(buffer, marker));
  }
  return keep;
}

function cleanPatchHtml(value: string): string {
  return trimPatchHtml(value, { requireClosedTag: false });
}

function previewPatchHtml(value: string): string {
  return trimPatchHtml(value, { requireClosedTag: true });
}

function trimPatchHtml(value: string, options: { requireClosedTag: boolean }): string {
  const start = value.indexOf('<');
  if (start === -1) return '';
  const fromFirstTag = value.slice(start);
  const lastTagEnd = fromFirstTag.lastIndexOf('>');
  if (lastTagEnd === -1) return options.requireClosedTag ? '' : fromFirstTag;
  const trailing = fromFirstTag.slice(lastTagEnd + 1);
  if (trailing.trim()) return fromFirstTag.slice(0, lastTagEnd + 1);
  return fromFirstTag;
}

function parsePatchMarker(marker: string):
  | { ok: true; target: string; action: HtmlPatchAction }
  | { ok: false; code: string; message: string } {
  if (!marker.startsWith(HTML_STREAM_PATCH_START)) {
    return {
      ok: false,
      code: 'invalid-html-stream-patch-marker',
      message: 'HTML stream patch marker must start with @@summon-html-patch',
    };
  }
  const attrs = marker.slice(HTML_STREAM_PATCH_START.length).trim();
  const values = new Map<string, string>();
  for (const match of attrs.matchAll(/([A-Za-z][A-Za-z0-9_-]*)="([^"]*)"/g)) {
    values.set(match[1]!, match[2]!);
  }
  const target = values.get('target') ?? '';
  const action = values.get('action') ?? '';
  if (!TARGET_ID_RE.test(target)) {
    return {
      ok: false,
      code: 'invalid-html-stream-patch-target',
      message: 'HTML stream patch target must be a stable scaffold element id',
    };
  }
  if (!PATCH_ACTIONS.has(action as HtmlPatchAction)) {
    return {
      ok: false,
      code: 'invalid-html-stream-patch-action',
      message: 'HTML stream patch action must be append, replace, update, remove, or morph',
    };
  }
  return {
    ok: true,
    target,
    action: action as HtmlPatchAction,
  };
}

async function validateAndAcceptHtmlPatch(
  ctx: RuntimeContext,
  patch: HtmlSurfacePatch,
): Promise<RuntimeValidationResult> {
  await ctx.writePhase('validating', 'Validating HTML patch');
  const validationStartedAt = nowMs();
  const line: ProtocolLine = {
    op: 'patch',
    path: '/artifact/html-patch',
    value: patch,
  };
  const issues = validateProtocolLine(line, {
    ...ctx.systemContracts.validationContext,
    experimentalHtmlScript: false,
  });
  ctx.addValidationIssues(issues);
  const blocker = issues.find((issue) => issue.severity === 'block');
  await ctx.writeTiming(
    'validating',
    blocker ? 'Blocked HTML patch' : 'Validated HTML patch',
    nowMs() - validationStartedAt,
  );
  if (blocker) {
    return { accepted: false, issues, blocker };
  }

  await ctx.writePhase('rendering', 'Committing accepted HTML patch');
  const renderStartedAt = nowMs();
  await ctx.writeAcceptedLine(line);
  await ctx.writeTiming('rendering', 'Committed accepted HTML patch', nowMs() - renderStartedAt);
  return { accepted: true, issues: [], blocker: null as never };
}

async function writeHtmlStreamSummary(
  ctx: RuntimeContext,
  counters: {
    previewDeltaCount: number;
    committedPatchCount: number;
    scaffoldCount: number;
    blockedPatchReasons: readonly string[];
  },
): Promise<void> {
  await ctx.writeProtocolLine({
    op: 'meta',
    path: '/html-stream-summary',
    value: {
      previewDeltaCount: counters.previewDeltaCount,
      committedPatchCount: counters.committedPatchCount,
      blockedPatchReasons: [...counters.blockedPatchReasons],
    },
  });
}
