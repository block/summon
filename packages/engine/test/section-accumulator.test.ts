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
