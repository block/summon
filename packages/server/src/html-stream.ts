import {
  contractIssue,
  type ContractIssue,
  type ContractPromptBlock,
  type HtmlPatchAction,
  type HtmlSurfacePatch,
} from '@summon-internal/engine';

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
    'First emit exactly one scaffold frame containing a complete summon.html-bundle/v0 JSON object. The scaffold must contain stable element ids that future patches target. Do not include source["main.js"] or any <script>.',
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
    'After the scaffold is complete, emit zero or more patch frames. Each patch frame starts with one marker line. target must be one stable id from the scaffold. action must be append, replace, update, remove, or morph.',
    '',
    '@@summon-html-patch target="hero" action="replace"',
    '<section id="hero"><h1>Complete validated fragment</h1></section>',
    HTML_STREAM_PATCH_END,
    '',
    'Patch body text may stream gradually, but the server treats it as preview-only until the end marker arrives. Every committed patch fragment must be complete safe HTML: no scripts, external URLs, forms, iframes, inline event handlers, data-summon-* attributes, or parent/window/storage/network behavior.',
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

export class HtmlStreamAccumulator {
  private state: HtmlStreamAccumulatorState = 'waiting-scaffold';
  private buffer = '';
  private currentPatch: {
    target: string;
    action: HtmlPatchAction;
    html: string;
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
    const start = this.buffer.indexOf(HTML_STREAM_SCAFFOLD_START);
    if (start === -1) {
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
    const prefix = this.buffer.slice(0, start);
    if (prefix.trim()) {
      events.push(this.fail(
        'malformed-html-stream-frame',
        'HTML stream scaffold must be the first non-whitespace frame',
        '/html-stream/scaffold',
      ));
      return false;
    }
    this.buffer = this.buffer.slice(start + HTML_STREAM_SCAFFOLD_START.length);
    this.consumeOneLineBreak();
    this.state = 'reading-scaffold';
    return true;
  }

  private consumeScaffoldBody(events: HtmlStreamAccumulatorEvent[], final: boolean): boolean {
    const end = this.buffer.indexOf(HTML_STREAM_SCAFFOLD_END);
    if (end === -1) {
      if (final) {
        events.push(this.fail(
          'unclosed-html-stream-scaffold',
          'HTML stream scaffold frame was not closed',
          '/html-stream/scaffold',
        ));
      }
      return false;
    }

    const rawJson = this.buffer.slice(0, end).trim();
    this.buffer = this.buffer.slice(end + HTML_STREAM_SCAFFOLD_END.length);
    this.consumeOneLineBreak();
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
    const start = this.buffer.indexOf(HTML_STREAM_PATCH_START);
    if (start === -1) {
      if (final) {
        if (this.buffer.trim()) {
          events.push(this.fail(
            'malformed-html-stream-frame',
            'HTML stream contained text outside a scaffold or patch frame',
            '/html-stream',
          ));
        } else {
          this.buffer = '';
        }
      } else {
        this.keepPossibleMarkerTail(HTML_STREAM_PATCH_START.length);
      }
      return false;
    }

    const prefix = this.buffer.slice(0, start);
    if (prefix.trim()) {
      events.push(this.fail(
        'malformed-html-stream-frame',
        'HTML stream contained text outside a patch frame',
        '/html-stream/patch',
      ));
      return false;
    }

    const lineEnd = this.buffer.indexOf('\n', start);
    if (lineEnd === -1) {
      if (final) {
        events.push(this.fail(
          'unclosed-html-stream-patch-marker',
          'HTML stream patch marker was not followed by a patch body',
          '/html-stream/patch',
        ));
      }
      return false;
    }

    const marker = this.buffer.slice(start, lineEnd).trim();
    const parsed = parsePatchMarker(marker);
    if (!parsed.ok) {
      events.push(this.fail(parsed.code, parsed.message, '/html-stream/patch'));
      return false;
    }

    this.currentPatch = {
      target: parsed.target,
      action: parsed.action,
      html: '',
    };
    this.buffer = this.buffer.slice(lineEnd + 1);
    this.state = 'reading-patch';
    return true;
  }

  private consumePatchBody(events: HtmlStreamAccumulatorEvent[], final: boolean): boolean {
    const patch = this.currentPatch;
    if (!patch) {
      events.push(this.fail('internal-html-stream-state', 'HTML stream accumulator lost patch state', '/html-stream/patch'));
      return false;
    }

    const end = this.buffer.indexOf(HTML_STREAM_PATCH_END);
    if (end === -1) {
      if (final) {
        events.push(this.fail(
          'unclosed-html-stream-patch',
          `HTML stream patch for "${patch.target}" was not closed`,
          '/html-stream/patch',
        ));
        return false;
      }
      const keepChars = HTML_STREAM_PATCH_END.length - 1;
      if (this.buffer.length <= keepChars) return false;
      const preview = this.buffer.slice(0, this.buffer.length - keepChars);
      this.buffer = this.buffer.slice(this.buffer.length - keepChars);
      this.appendPatchPreview(events, patch, preview);
      return false;
    }

    const preview = this.buffer.slice(0, end);
    this.appendPatchPreview(events, patch, preview);
    this.buffer = this.buffer.slice(end + HTML_STREAM_PATCH_END.length);
    this.consumeOneLineBreak();
    const includeHtml = patch.action !== 'remove' || patch.html.trim().length > 0;
    const committedPatch: HtmlSurfacePatch = {
      runtime: 'html',
      action: patch.action,
      target: patch.target,
      ...(includeHtml ? { html: patch.html } : {}),
    };
    events.push({ type: 'patch', patch: committedPatch });
    this.currentPatch = null;
    this.state = 'waiting-patch';
    return true;
  }

  private appendPatchPreview(
    events: HtmlStreamAccumulatorEvent[],
    patch: { target: string; action: HtmlPatchAction; html: string },
    delta: string,
  ): void {
    if (!delta) return;
    patch.html += delta;
    events.push({
      type: 'preview-delta',
      value: {
        runtime: 'html',
        target: patch.target,
        action: patch.action,
        delta,
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

  private consumeOneLineBreak(): void {
    if (this.buffer.startsWith('\r\n')) {
      this.buffer = this.buffer.slice(2);
    } else if (this.buffer.startsWith('\n')) {
      this.buffer = this.buffer.slice(1);
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
