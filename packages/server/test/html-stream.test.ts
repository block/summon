import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HTML_STREAM_PATCH_END,
  HTML_STREAM_PATCH_START,
  HTML_STREAM_SCAFFOLD_END,
  HTML_STREAM_SCAFFOLD_START,
  HtmlStreamAccumulator,
  type HtmlStreamAccumulatorEvent,
} from '../src/html-stream.ts';

test('HtmlStreamAccumulator handles scaffold chunks, preview deltas, and closed patch commits', () => {
  const accumulator = new HtmlStreamAccumulator();
  const events: HtmlStreamAccumulatorEvent[] = [];
  const scaffold = [
    HTML_STREAM_SCAFFOLD_START,
    '\n',
    '{"schema":"summon.html-bundle/v0","source":{"body.html":"<main><section id=\\"hero\\"></section></main>"}}',
    '\n',
    HTML_STREAM_SCAFFOLD_END,
    '\n',
  ].join('');

  for (let i = 0; i < scaffold.length; i += 11) {
    events.push(...accumulator.push(scaffold.slice(i, i + 11)));
  }

  assert.equal(events.filter((event) => event.type === 'scaffold').length, 1);
  assert.equal(events.some((event) => event.type === 'error'), false);

  events.length = 0;
  events.push(...accumulator.push(`${HTML_STREAM_PATCH_START} target="hero" action="replace"\n<section id="hero"><div class="streaming-shell">`));
  assert.deepEqual(events.map((event) => event.type), ['preview-delta']);
  assert.match((events[0] as Extract<HtmlStreamAccumulatorEvent, { type: 'preview-delta' }>).value.delta, /^<section id="hero"><div/);

  events.length = 0;
  events.push(...accumulator.push(`<h2>Updated</h2></div></section>\n${HTML_STREAM_PATCH_END}\n`));
  assert.deepEqual(events.map((event) => event.type), ['preview-delta', 'patch']);
  const patch = events[1] as Extract<HtmlStreamAccumulatorEvent, { type: 'patch' }>;
  assert.deepEqual(patch.patch, {
    runtime: 'html',
    action: 'replace',
    target: 'hero',
    html: '<section id="hero"><div class="streaming-shell"><h2>Updated</h2></div></section>\n',
  });
});

test('HtmlStreamAccumulator reports malformed frames and unclosed patches', () => {
  const missingScaffold = new HtmlStreamAccumulator();
  const missingEvents = missingScaffold.finish();
  assert.equal(missingEvents[0]?.type, 'error');
  assert.equal((missingEvents[0] as Extract<HtmlStreamAccumulatorEvent, { type: 'error' }>).issue.code, 'missing-html-stream-scaffold');

  const unclosed = new HtmlStreamAccumulator();
  unclosed.push(`${HTML_STREAM_SCAFFOLD_START}\n{"schema":"summon.html-bundle/v0","source":{"body.html":"<main><section id=\\"hero\\"></section></main>"}}\n${HTML_STREAM_SCAFFOLD_END}\n`);
  unclosed.push(`${HTML_STREAM_PATCH_START} target="hero" action="replace"\n<section id="hero">`);
  const unclosedEvents = unclosed.finish();
  assert.equal(unclosedEvents.at(-1)?.type, 'error');
  assert.equal((unclosedEvents.at(-1) as Extract<HtmlStreamAccumulatorEvent, { type: 'error' }>).issue.code, 'unclosed-html-stream-patch');
});
