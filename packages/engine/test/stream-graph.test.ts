import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compileSystemContracts,
  StreamGraph,
  type ContractIssue,
  type RepairFeedbackMetaValue,
  type SummonLayout,
} from '../src/index.ts';

test('screen declaration creates ordered edges and missing declared nodes', () => {
  const graph = new StreamGraph();
  graph.applyLine({ op: 'set', path: '/screen', value: { sections: ['hero', 'details'] } });

  const snap = graph.snapshot();
  assert.deepEqual(snap.edges, [
    { from: 'screen', to: 'hero', order: 0 },
    { from: 'screen', to: 'details', order: 1 },
  ]);
  assert.deepEqual(
    snap.sections.map(({ id, declared, present, revision, bytes }) => ({
      id,
      declared,
      present,
      revision,
      bytes,
    })),
    [
      { id: 'hero', declared: true, present: false, revision: 0, bytes: 0 },
      { id: 'details', declared: true, present: false, revision: 0, bytes: 0 },
    ],
  );
  assert.deepEqual(snap.health.missingDeclared, ['hero', 'details']);
  assert.equal(snap.health.complete, false);
});

test('section adds mark nodes present and increment revisions on replacement', () => {
  const graph = new StreamGraph();
  graph.applyLine({ op: 'set', path: '/screen', value: { sections: ['hero'] } });
  graph.applyLine({ op: 'add', path: '/section/hero', html: '<p>Hero</p>' });
  graph.applyLine({ op: 'add', path: '/section/hero', html: '<p>Updated</p>' });

  const hero = graph.snapshot().sections[0]!;
  assert.equal(hero.present, true);
  assert.equal(hero.revision, 2);
  assert.equal(hero.bytes, '<p>Updated</p>'.length);
  assert.equal(hero.firstDeclaredLine, 1);
  assert.equal(hero.firstSeenLine, 2);
  assert.equal(hero.lastUpdatedLine, 3);
  assert.deepEqual(graph.snapshot().health.missingDeclared, []);
});

test('add-before-screen records undeclared present state', () => {
  const graph = new StreamGraph();
  graph.applyLine({ op: 'add', path: '/section/hero', html: '<p>Hero</p>' });

  const snap = graph.snapshot();
  assert.deepEqual(snap.health.undeclaredPresent, ['hero']);
  assert.equal(snap.health.complete, false);
  assert.equal(snap.sections[0]?.declared, false);
  assert.equal(snap.sections[0]?.present, true);
});

test('contract issues update skipped and blocked health counters', () => {
  const graph = new StreamGraph();
  const skipped: ContractIssue = {
    source: 'protocol',
    severity: 'warn',
    code: 'undeclared-section',
    message: 'Section was not declared',
    path: '/section/details',
  };
  const blocked: ContractIssue = {
    source: 'html',
    severity: 'block',
    code: 'external-url',
    message: 'External URL is not allowed',
    path: '/section/details',
  };

  graph.recordIssue(skipped);
  graph.recordIssue(blocked);

  const snap = graph.snapshot();
  assert.equal(snap.health.skippedCount, 1);
  assert.equal(snap.health.blockedCount, 1);
  assert.equal(snap.sections[0]?.id, 'details');
  assert.equal(snap.sections[0]?.lastIssue?.code, 'external-url');
});

test('validation summary merges aggregate graph health', () => {
  const graph = new StreamGraph();
  graph.applyLine({
    op: 'meta',
    path: '/validation-summary',
    value: {
      blocked: 2,
      warnings: 3,
      codes: {
        'undeclared-section': 2,
        'token-contract-warning': 1,
        'external-url': 2,
      },
    },
  });

  const snap = graph.snapshot();
  assert.equal(snap.health.skippedCount, 2);
  assert.equal(snap.health.blockedCount, 2);
});

test('repair feedback updates repaired and blocked status', () => {
  const graph = new StreamGraph();
  const issue: ContractIssue = {
    source: 'html',
    severity: 'block',
    code: 'unsafe-tag',
    message: 'Unsafe tag',
    path: '/section/hero',
  };
  const blocked: RepairFeedbackMetaValue = {
    schemaId: 'summon.repair-feedback.v2',
    status: 'blocked',
    target: '/section/hero',
    issues: [issue],
    retryable: true,
    hints: ['Repair it.'],
  };
  const repaired: RepairFeedbackMetaValue = {
    ...blocked,
    status: 'repaired',
    retryable: false,
  };

  graph.recordRepairFeedback(blocked);
  graph.recordRepairFeedback(repaired);

  const snap = graph.snapshot();
  assert.equal(snap.health.blockedCount, 1);
  assert.equal(snap.health.repairedCount, 1);
  assert.equal(snap.sections[0]?.lastIssue?.code, 'unsafe-tag');
});

test('startup layout lines seed graph state', () => {
  const layout: SummonLayout = {
    id: 'two-slot',
    slots: [
      { id: 'summary', purpose: 'main answer' },
      { id: 'details', purpose: 'supporting detail' },
    ],
  };
  const contracts = compileSystemContracts({
    mode: 'static',
    layout,
  });
  const graph = new StreamGraph();
  for (const line of contracts.startupLines) graph.applyLine(line);

  assert.deepEqual(graph.snapshot().edges, [
    { from: 'screen', to: 'summary', order: 0 },
    { from: 'screen', to: 'details', order: 1 },
  ]);
});

test('snapshots, hydrates, and resets deterministically', () => {
  const graph = new StreamGraph();
  graph.applyLine({ op: 'set', path: '/screen', value: { sections: ['hero'] } });
  graph.applyLine({ op: 'add', path: '/section/hero', html: '<p>Hero</p>' });
  graph.applyLine({
    op: 'meta',
    path: '/protocol-skip',
    value: {
      code: 'malformed-jsonl',
      message: 'Model emitted a non-JSONL protocol line',
      severity: 'warn',
    },
  });

  const snap = graph.snapshot();
  const restored = StreamGraph.fromSnapshot(snap);
  assert.deepEqual(restored.snapshot(), snap);

  restored.reset();
  assert.deepEqual(restored.snapshot(), {
    sections: [],
    edges: [],
    health: {
      complete: true,
      missingDeclared: [],
      undeclaredPresent: [],
      skippedCount: 0,
      blockedCount: 0,
      repairedCount: 0,
    },
  });
});
