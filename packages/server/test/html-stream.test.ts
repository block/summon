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

test('HtmlStreamAccumulator drops provider thinking outside HTML frames and patch markup', () => {
  const accumulator = new HtmlStreamAccumulator();
  const events: HtmlStreamAccumulatorEvent[] = [];

  events.push(...accumulator.push([
    'Thinking through layout before answering.\n',
    HTML_STREAM_SCAFFOLD_START,
    '\n',
    '{"schema":"summon.html-bundle/v0","source":{"body.html":"<main><section id=\\"hero\\"></section></main>","main.css":"#hero{color:red}"}}',
    '\n',
    HTML_STREAM_SCAFFOLD_END,
    '\n',
    'The scaffold is ready; now patch it.\n',
    HTML_STREAM_PATCH_START,
    ' target="hero" action="replace"\n',
    'Thinking: use a concise hero.\n',
  ].join('')));
  events.push(...accumulator.push('<section id="hero"><h2>Ready</h2></section>\nFinal result above.'));
  events.push(...accumulator.push(`\n${HTML_STREAM_PATCH_END}\nMore commentary after the patch.`));
  events.push(...accumulator.finish());

  const previews = events.filter((event): event is Extract<HtmlStreamAccumulatorEvent, { type: 'preview-delta' }> => event.type === 'preview-delta');
  assert.ok(previews.length > 0);
  assert.equal(previews.map((event) => event.value.delta).join('').includes('Thinking'), false);
  assert.equal(previews.map((event) => event.value.delta).join('').includes('Final result'), false);

  const patch = events.find((event): event is Extract<HtmlStreamAccumulatorEvent, { type: 'patch' }> => event.type === 'patch');
  assert.deepEqual(patch?.patch, {
    runtime: 'html',
    action: 'replace',
    target: 'hero',
    html: '<section id="hero"><h2>Ready</h2></section>',
  });
  assert.equal(events.some((event) => event.type === 'error'), false);
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

test('HtmlStreamAccumulator treats markers as line-oriented frames', () => {
  const accumulator = new HtmlStreamAccumulator();
  const events: HtmlStreamAccumulatorEvent[] = [];

  events.push(...accumulator.push([
    `Provider commentary with an inline ${HTML_STREAM_SCAFFOLD_START} token.`,
    HTML_STREAM_SCAFFOLD_START,
    '{"schema":"summon.html-bundle/v0","source":{"body.html":"<main><section id=\\"hero\\"></section></main>"}}',
    HTML_STREAM_SCAFFOLD_END,
    '',
  ].join('\n')));

  assert.equal(events.filter((event) => event.type === 'scaffold').length, 1);
  assert.equal(events.some((event) => event.type === 'error'), false);
});

test('HtmlStreamAccumulator rejects malformed patch markers and marker text in patch bodies', () => {
  const malformed = new HtmlStreamAccumulator();
  malformed.push(`${HTML_STREAM_SCAFFOLD_START}\n{"schema":"summon.html-bundle/v0","source":{"body.html":"<main><section id=\\"hero\\"></section></main>"}}\n${HTML_STREAM_SCAFFOLD_END}\n`);
  const malformedEvents = malformed.push(`${HTML_STREAM_PATCH_START} target="../hero" action="replace"\n<section id="hero">Bad</section>\n${HTML_STREAM_PATCH_END}\n`);
  assert.equal(malformedEvents.at(-1)?.type, 'error');
  assert.equal((malformedEvents.at(-1) as Extract<HtmlStreamAccumulatorEvent, { type: 'error' }>).issue.code, 'invalid-html-stream-patch-target');

  const markerInBody = new HtmlStreamAccumulator();
  markerInBody.push(`${HTML_STREAM_SCAFFOLD_START}\n{"schema":"summon.html-bundle/v0","source":{"body.html":"<main><section id=\\"hero\\"></section></main>"}}\n${HTML_STREAM_SCAFFOLD_END}\n`);
  const markerEvents = markerInBody.push([
    `${HTML_STREAM_PATCH_START} target="hero" action="replace"`,
    '<section id="hero">',
    `User visible text ${HTML_STREAM_PATCH_START} should not be treated as HTML.`,
    '</section>',
    HTML_STREAM_PATCH_END,
    '',
  ].join('\n'));
  assert.equal(markerEvents.at(-1)?.type, 'error');
  assert.equal((markerEvents.at(-1) as Extract<HtmlStreamAccumulatorEvent, { type: 'error' }>).issue.code, 'html-stream-marker-in-patch-body');
  assert.equal(markerEvents.some((event) => event.type === 'patch'), false);
});

test('HtmlStreamAccumulator preserves partial marker tails and enforces frame limits', () => {
  const splitEnd = new HtmlStreamAccumulator();
  splitEnd.push(`${HTML_STREAM_SCAFFOLD_START}\n{"schema":"summon.html-bundle/v0","source":{"body.html":"<main><section id=\\"hero\\"></section></main>"}}\n${HTML_STREAM_SCAFFOLD_END}\n`);
  splitEnd.push(`${HTML_STREAM_PATCH_START} target="hero" action="replace"\n<section id="hero"><h2>Split`);
  const beforeEnd = splitEnd.push('</h2></section>\n@@end-summon-html-pa');
  assert.equal(beforeEnd.some((event) => event.type === 'patch'), false);
  const afterEnd = splitEnd.push('tch\n');
  assert.equal(afterEnd.at(-1)?.type, 'patch');
  assert.equal((afterEnd.at(-1) as Extract<HtmlStreamAccumulatorEvent, { type: 'patch' }>).patch.html, '<section id="hero"><h2>Split</h2></section>\n');

  const oversized = new HtmlStreamAccumulator();
  const oversizedEvents = oversized.push('x'.repeat(512 * 1024 + 1));
  assert.equal(oversizedEvents.at(-1)?.type, 'error');
  assert.equal((oversizedEvents.at(-1) as Extract<HtmlStreamAccumulatorEvent, { type: 'error' }>).issue.code, 'html-stream-frame-limit');
});
