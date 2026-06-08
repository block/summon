import assert from 'node:assert/strict';
import test from 'node:test';
import { validateHtmlFragment } from '../src/index.ts';
import { baseContext, codes } from './runtime-validator-fixtures.ts';

test('surface plan blocks scripts and capabilities that exceed declarative static scope', () => {
  const issues = validateHtmlFragment(
    '<button data-summon-on-click="choose">Pick</button><script>sandbox.emit("choose", {})</script>',
    {
      mode: 'interactive',
      scriptPolicy: 'allow',
      surfacePlan: {
        purpose: 'inform',
        runtime: 'declarative',
        data: 'embedded',
        authority: 'none',
        persistence: 'replayable',
      },
      capabilities: [{ name: 'choose', kind: 'action', triggers: ['click'] }],
    },
  );
  assert.deepEqual(codes(issues), [
    'script-not-granted',
    'surface-authority-exceeded',
  ]);
});

test('surface plan blocks approval-gated capability usage without approval authority', () => {
  const issues = validateHtmlFragment(
    '<button data-summon-on-click="approve_price">Approve</button>',
    {
      mode: 'interactive',
      surfacePlan: {
        purpose: 'operate',
        runtime: 'declarative',
        data: 'embedded',
        authority: 'host-action',
        persistence: 'replayable',
      },
      capabilities: [
        {
          name: 'approve_price',
          kind: 'action',
          triggers: ['click'],
          surface: { authority: 'approval-gated' },
        },
      ],
    },
  );
  assert.deepEqual(codes(issues), ['surface-authority-exceeded']);
});

test('surface plan requires worker-backed capabilities for worker runtime', () => {
  const issues = validateHtmlFragment(
    '<div data-summon-resource="analysis" data-summon-resource-trigger="mount"><p data-summon-show="$analysis.loading">Loading</p><p data-summon-show="$analysis.error" data-summon-bind="$analysis.error"></p><p data-summon-show="$analysis.data" data-summon-bind="$analysis.data"></p></div>',
    {
      mode: 'interactive',
      surfacePlan: {
        purpose: 'explore',
        runtime: 'worker',
        data: 'worker',
        authority: 'read',
        persistence: 'replayable',
      },
      capabilities: [
        {
          name: 'analysis',
          kind: 'resource',
          triggers: ['mount'],
          stateKeys: { loading: 'loading', data: 'analysis', error: 'error' },
          surface: { data: 'host-resource', authority: 'read' },
        },
      ],
    },
  );
  assert.deepEqual(codes(issues), [
    'surface-data-exceeded',
    'surface-runtime-exceeded',
  ]);
});

test('warns for style drift without blocking', () => {
  const issues = validateHtmlFragment(
    '<div style="color:#ff00ff;margin:13px;border-radius:var(--radius-card);">Hi</div>',
    baseContext,
  );
  assert.equal(issues.some((issue) => issue.severity === 'block'), false);
  assert.deepEqual(codes(issues), ['raw-color', 'raw-px', 'unknown-token']);
});

test('enforces centralized validation limits', () => {
  const htmlLimit = validateHtmlFragment('<p>too large</p>', {
    ...baseContext,
    limits: { maxSectionHtmlBytes: 4 },
  });
  assert.deepEqual(codes(htmlLimit), ['section-html-limit']);

  const depthLimit = validateHtmlFragment('<div><div><div>deep</div></div></div>', {
    ...baseContext,
    limits: { maxDomDepth: 2 },
  });
  assert.deepEqual(codes(depthLimit), ['dom-depth-limit']);

  const nodeLimit = validateHtmlFragment('<p>a</p><p>b</p><p>c</p>', {
    ...baseContext,
    limits: { maxDomNodes: 2 },
  });
  assert.deepEqual(codes(nodeLimit), ['dom-node-limit']);

  const cssLimit = validateHtmlFragment('<style>.x{color:red}</style>', {
    ...baseContext,
    limits: { maxCssBytes: 4 },
  });
  assert.deepEqual(codes(cssLimit), ['css-size-limit']);
});
