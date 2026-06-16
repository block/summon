import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ProtocolParseError,
  parseProtocolLine,
  parseProtocolLineStrict,
  validateProtocolLine,
} from '../src/index.ts';
import { baseContext, codes } from './runtime-validator-fixtures.ts';

test('blocks invalid section paths', () => {
  const issues = validateProtocolLine(
    { op: 'add', path: '/section/Bad_Section', html: '<p>Hi</p>' },
    baseContext,
  );
  assert.deepEqual(codes(issues), ['invalid-section-path']);
});

test('rejects malformed JSONL before validation', () => {
  assert.equal(parseProtocolLine('not-json'), null);
});

test('strict protocol parser rejects oversized lines', () => {
  assert.throws(
    () => parseProtocolLineStrict('{"op":"meta","path":"/x"}', { maxLineBytes: 4 }),
    (err) => err instanceof ProtocolParseError && err.code === 'oversized-line',
  );
});

test('blocks malformed screen declarations', () => {
  const issues = validateProtocolLine(
    { op: 'set', path: '/screen', value: { sections: ['hero', 'hero'] } },
    baseContext,
  );
  assert.deepEqual(codes(issues), ['duplicate-section-id']);
});

test('blocks malformed block declarations and paths', () => {
  assert.deepEqual(
    codes(validateProtocolLine(
      { op: 'set', path: '/section/hero', value: { blocks: ['headline', 'headline'] } },
      baseContext,
    )),
    ['duplicate-block-id'],
  );
  assert.deepEqual(
    codes(validateProtocolLine(
      { op: 'set', path: '/section/hero', value: { blocks: [] } },
      baseContext,
    )),
    ['invalid-block-count'],
  );
  assert.deepEqual(
    codes(validateProtocolLine(
      { op: 'add', path: '/section/hero/block/Bad_Block', html: '<p>Hi</p>' },
      baseContext,
    )),
    ['invalid-block-path'],
  );
});

test('blocks generated host-owned surface meta paths', () => {
  assert.deepEqual(
    codes(validateProtocolLine(
      { op: 'meta', path: '/surface-policy', value: { tier: 'static' } },
      baseContext,
    )),
    ['host-owned-meta'],
  );
  assert.deepEqual(
    codes(validateProtocolLine(
      { op: 'meta', path: '/surface-plan', value: {} },
      baseContext,
    )),
    ['host-owned-meta'],
  );
  assert.deepEqual(
    codes(validateProtocolLine(
      { op: 'meta', path: '/surface-contract', value: {} },
      baseContext,
    )),
    ['host-owned-meta'],
  );
});

test('allows safe static markup', () => {
  const issues = validateProtocolLine(
    {
      op: 'add',
      path: '/section/hero',
      html: '<p style="color:var(--color-text);margin:var(--space-2);">Hi</p>',
    },
    baseContext,
  );
  assert.deepEqual(issues, []);
});

test('accepts valid Arrow artifacts', () => {
  const issues = validateProtocolLine(
    {
      op: 'artifact',
      path: '/artifact',
      value: {
        runtime: 'arrow',
        source: {
          'main.ts': 'export default html`<button>Save</button>`',
          'main.css': 'button { color: var(--color-text); }',
        },
      },
    },
    {
      ...baseContext,
      surfacePlan: {
        purpose: 'operate',
        runtime: 'arrow',
        data: 'embedded',
        authority: 'host-action',
        persistence: 'replayable',
        network: 'none',
      },
    },
  );
  assert.deepEqual(issues, []);
});

test('blocks malformed Arrow artifacts and ungranted restricted fetch', () => {
  assert.deepEqual(
    codes(validateProtocolLine(
      {
        op: 'artifact',
        path: '/artifact',
        value: {
          runtime: 'arrow',
          source: {
            'main.ts': 'export default html`<div>A</div>`',
            'main.js': 'export default html`<div>B</div>`',
          },
        },
      },
      baseContext,
    )),
    ['invalid-arrow-entry'],
  );

  assert.deepEqual(
    codes(validateProtocolLine(
      {
        op: 'artifact',
        path: '/artifact',
        value: {
          runtime: 'arrow',
          network: 'restricted-fetch',
          source: {
            'main.ts': 'export default html`<div>Weather</div>`',
          },
        },
      },
      baseContext,
    )),
    ['arrow-network-not-granted'],
  );
});
