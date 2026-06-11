import assert from 'node:assert/strict';
import test from 'node:test';
import { SectionAccumulator } from '../src/index.ts';

test('snapshots, hydrates, and reports detailed section changes', () => {
  const acc = new SectionAccumulator();
  assert.deepEqual(
    acc.applyDetailed({ op: 'set', path: '/screen', value: { sections: ['hero', 'details'] } }),
    { changed: true, kind: 'screen', orderChanged: true },
  );
  assert.equal(acc.apply({ op: 'add', path: '/section/hero', html: '<p>Hero</p>' }), true);
  assert.equal(acc.apply({ op: 'add', path: '/section/details', html: '<p>Details</p>' }), true);

  const snapshot = acc.snapshot();
  assert.deepEqual(snapshot, {
    sections: [
      { id: 'hero', html: '<p>Hero</p>' },
      { id: 'details', html: '<p>Details</p>' },
    ],
  });

  const restored = SectionAccumulator.fromSnapshot(snapshot);
  const replacement = restored.applyDetailed({
    op: 'add',
    path: '/section/details',
    html: '<p>Updated</p>',
  });
  assert.equal(replacement.changed, true);
  assert.equal(replacement.kind, 'section');
  assert.equal(replacement.sectionId, 'details');
  assert.equal(replacement.htmlChanged, true);
  assert.equal(replacement.orderChanged, false);
  assert.match(restored.compose(), /Updated/);
});

test('repeated section add replaces existing html without changing order', () => {
  const acc = new SectionAccumulator();
  acc.applyDetailed({ op: 'set', path: '/screen', value: { sections: ['hero'] } });

  const placeholder = acc.applyDetailed({
    op: 'add',
    path: '/section/hero',
    html: '<div aria-busy="true">Drafting...</div>',
  });
  assert.deepEqual(placeholder, {
    changed: true,
    kind: 'section',
    sectionId: 'hero',
    orderChanged: false,
    htmlChanged: true,
  });

  const final = acc.applyDetailed({
    op: 'add',
    path: '/section/hero',
    html: '<article><h1>Final answer</h1></article>',
  });
  assert.deepEqual(final, {
    changed: true,
    kind: 'section',
    sectionId: 'hero',
    orderChanged: false,
    htmlChanged: true,
  });
  assert.doesNotMatch(acc.compose(), /Drafting/);
  assert.match(acc.compose(), /Final answer/);
  assert.deepEqual(acc.snapshot().sections.map((section) => section.id), ['hero']);
});

test('block fragments compose inside stable section wrappers', () => {
  const acc = new SectionAccumulator();
  acc.applyDetailed({ op: 'set', path: '/screen', value: { sections: ['summary'] } });
  assert.deepEqual(
    acc.applyDetailed({ op: 'set', path: '/section/summary', value: { blocks: ['headline', 'metrics'] } }),
    { changed: true, kind: 'section', sectionId: 'summary', orderChanged: true },
  );
  acc.applyDetailed({
    op: 'add',
    path: '/section/summary/block/headline',
    html: '<h1>Closeout</h1>',
  });
  acc.applyDetailed({
    op: 'add',
    path: '/section/summary/block/metrics',
    html: '<p>42 orders</p>',
  });

  assert.equal(acc.compose(), [
    '<section data-summon-section="summary">',
    '<div data-summon-block="headline">',
    '<h1>Closeout</h1>',
    '</div>',
    '<div data-summon-block="metrics">',
    '<p>42 orders</p>',
    '</div>',
    '</section>',
  ].join('\n'));
});

test('block replacement updates one block and whole-section add clears block state', () => {
  const acc = new SectionAccumulator();
  acc.applyDetailed({ op: 'set', path: '/screen', value: { sections: ['summary'] } });
  acc.applyDetailed({ op: 'set', path: '/section/summary', value: { blocks: ['a', 'b'] } });
  acc.applyDetailed({ op: 'add', path: '/section/summary/block/a', html: '<p>A</p>' });
  acc.applyDetailed({ op: 'add', path: '/section/summary/block/b', html: '<p>Draft</p>' });

  const replacement = acc.applyDetailed({
    op: 'add',
    path: '/section/summary/block/b',
    html: '<p>Final</p>',
  });
  assert.equal(replacement.changed, true);
  assert.equal(replacement.blockId, 'b');
  assert.match(acc.compose(), /<p>A<\/p>/);
  assert.match(acc.compose(), /<p>Final<\/p>/);
  assert.doesNotMatch(acc.compose(), /Draft/);

  acc.applyDetailed({ op: 'add', path: '/section/summary', html: '<article>Opaque</article>' });
  assert.equal(
    acc.compose(),
    '<section data-summon-section="summary">\n<article>Opaque</article>\n</section>',
  );
});

test('html node patches compose into nested section HTML', () => {
  const acc = new SectionAccumulator();
  acc.applyDetailed({ op: 'set', path: '/screen', value: { sections: ['main'] } });
  acc.applyDetailed({
    op: 'add',
    path: '/section/main/node/root',
    html: '<div data-summon-node="root" class="dashboard"></div>',
  });
  acc.applyDetailed({
    op: 'add',
    path: '/section/main/node/headline',
    parent: 'root',
    html: '<header data-summon-node="headline"><h1>Closeout</h1></header>',
  });
  acc.applyDetailed({
    op: 'add',
    path: '/section/main/node/metric',
    parent: 'root',
    html: '<article data-summon-node="metric"><strong>42</strong></article>',
  });

  assert.equal(acc.compose(), [
    '<section data-summon-section="main">',
    '<div data-summon-node="root" class="dashboard">',
    '<header data-summon-node="headline"><h1>Closeout</h1></header>',
    '<article data-summon-node="metric"><strong>42</strong></article>',
    '</div>',
    '</section>',
  ].join('\n'));
});

test('html node replacement updates only that node in composed HTML', () => {
  const acc = new SectionAccumulator();
  acc.applyDetailed({ op: 'set', path: '/screen', value: { sections: ['main'] } });
  acc.applyDetailed({
    op: 'add',
    path: '/section/main/node/root',
    html: '<div data-summon-node="root"></div>',
  });
  acc.applyDetailed({
    op: 'add',
    path: '/section/main/node/a',
    parent: 'root',
    html: '<p data-summon-node="a">A</p>',
  });
  acc.applyDetailed({
    op: 'add',
    path: '/section/main/node/b',
    parent: 'root',
    html: '<p data-summon-node="b">Draft</p>',
  });

  const replacement = acc.applyDetailed({
    op: 'add',
    path: '/section/main/node/b',
    parent: 'root',
    html: '<p data-summon-node="b">Final</p>',
  });
  assert.equal(replacement.changed, true);
  assert.equal(replacement.nodeId, 'b');
  assert.equal(replacement.nodePatch?.parentId, 'root');
  assert.match(acc.compose(), /data-summon-node="a">A/);
  assert.match(acc.compose(), /data-summon-node="b">Final/);
  assert.doesNotMatch(acc.compose(), /Draft/);
});

test('whole-section add clears html node state', () => {
  const acc = new SectionAccumulator();
  acc.applyDetailed({ op: 'set', path: '/screen', value: { sections: ['main'] } });
  acc.applyDetailed({
    op: 'add',
    path: '/section/main/node/root',
    html: '<div data-summon-node="root"></div>',
  });

  acc.applyDetailed({ op: 'add', path: '/section/main', html: '<article>Opaque</article>' });
  assert.equal(
    acc.compose(),
    '<section data-summon-section="main">\n<article>Opaque</article>\n</section>',
  );
});
