import assert from 'node:assert/strict';
import test from 'node:test';
import {
  StreamGraph,
  type ContractIssue,
} from '../src/index.ts';

const artifact = {
  runtime: 'arrow',
  source: {
    'main.ts': 'export default html`<p>Hello</p>`',
  },
};

test('artifact lines create ordered Arrow revisions', () => {
  const graph = new StreamGraph();
  graph.applyLine({ op: 'artifact', path: '/artifact', value: artifact });
  graph.applyLine({
    op: 'artifact',
    path: '/artifact',
    value: {
      runtime: 'arrow',
      source: {
        'main.ts': 'export default html`<p>Updated</p>`',
        'main.css': 'p { color: var(--color-text); }',
      },
    },
  });

  const snap = graph.snapshot();
  assert.equal(snap.artifacts.length, 2);
  assert.deepEqual(
    snap.artifacts.map(({ revision, runtime, firstSeenLine, lastUpdatedLine }) => ({
      revision,
      runtime,
      firstSeenLine,
      lastUpdatedLine,
    })),
    [
      { revision: 1, runtime: 'arrow', firstSeenLine: 1, lastUpdatedLine: 1 },
      { revision: 2, runtime: 'arrow', firstSeenLine: 1, lastUpdatedLine: 2 },
    ],
  );
  assert.equal(snap.health.complete, true);
});

test('contract issues update warning and blocked health counters', () => {
  const graph = new StreamGraph();
  graph.applyLine({ op: 'artifact', path: '/artifact', value: artifact });
  const warning: ContractIssue = {
    source: 'artifact',
    severity: 'warn',
    code: 'unsupported-arrow-pattern',
    message: 'Arrow source uses a discouraged pattern',
  };
  const blocked: ContractIssue = {
    source: 'protocol',
    severity: 'block',
    code: 'invalid-arrow-artifact',
    message: 'Artifact line value must be an Arrow artifact object',
    path: '/artifact',
  };

  graph.recordIssue(warning);
  graph.recordIssue(blocked);

  const snap = graph.snapshot();
  assert.equal(snap.health.warningCount, 1);
  assert.equal(snap.health.blockedCount, 1);
  assert.equal(snap.health.complete, false);
  assert.equal(snap.artifacts[0]?.lastIssue?.code, 'invalid-arrow-artifact');
});

test('validation summary merges aggregate graph health', () => {
  const graph = new StreamGraph();
  graph.applyLine({
    op: 'meta',
    path: '/validation-summary',
    value: {
      blocked: 2,
      warnings: 3,
    },
  });

  const snap = graph.snapshot();
  assert.equal(snap.health.warningCount, 3);
  assert.equal(snap.health.blockedCount, 2);
});

test('preview event lines update stream graph preview status', () => {
  const graph = new StreamGraph();
  graph.applyLine({
    op: 'event',
    path: '/surface',
    value: { type: 'surface.status', status: 'drafting', text: 'Drafting layout' },
  });
  graph.applyLine({
    op: 'event',
    path: '/surface',
    value: { type: 'surface.start', id: 'main', kind: 'comparison', title: 'Choice' },
  });

  assert.deepEqual(graph.snapshot().preview, {
    events: {
      count: 2,
      firstSeenLine: 1,
      lastUpdatedLine: 2,
      lastType: 'surface.start',
    },
    lastStatus: 'drafting',
    lastStatusText: 'Drafting layout',
  });
});

test('snapshots, hydrates, and resets deterministically', () => {
  const graph = new StreamGraph();
  graph.applyLine({ op: 'artifact', path: '/artifact', value: artifact });
  graph.applyLine({
    op: 'meta',
    path: '/validation-summary',
    value: {
      blocked: 0,
      warnings: 1,
    },
  });

  const snap = graph.snapshot();
  const restored = StreamGraph.fromSnapshot(snap);
  assert.deepEqual(restored.snapshot(), snap);

  restored.reset();
  assert.deepEqual(restored.snapshot(), {
    artifacts: [],
    preview: {
      events: {
        count: 0,
      },
    },
    health: {
      complete: true,
      warningCount: 0,
      blockedCount: 0,
    },
  });
});
