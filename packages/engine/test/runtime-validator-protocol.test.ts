import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ProtocolParseError,
  parseProtocolLine,
  parseProtocolLineStrict,
  validateProtocolLine,
} from '../src/index.ts';
import { baseContext, codes } from './runtime-validator-fixtures.ts';

test('rejects malformed JSONL before validation', () => {
  assert.equal(parseProtocolLine('not-json'), null);
});

test('strict protocol parser rejects oversized lines', () => {
  assert.throws(
    () => parseProtocolLineStrict('{"op":"meta","path":"/x"}', { maxLineBytes: 4 }),
    (err) => err instanceof ProtocolParseError && err.code === 'oversized-line',
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

test('accepts valid Arrow artifacts', () => {
  const issues = validateProtocolLine(
    {
      op: 'artifact',
      path: '/artifact',
      value: {
        runtime: 'arrow',
        source: {
          'main.ts': 'import { html } from "@arrow-js/core";\nexport default html`<button>Save</button>`',
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

test('parser rejects legacy section protocol ops', () => {
  assert.throws(
    () => parseProtocolLineStrict(JSON.stringify({ op: 'set', path: '/screen', value: { sections: ['hero'] } })),
    (err) => err instanceof ProtocolParseError && err.code === 'invalid-op',
  );
  assert.throws(
    () => parseProtocolLineStrict(JSON.stringify({ op: 'add', path: '/section/hero', html: '<p>Hi</p>' })),
    (err) => err instanceof ProtocolParseError && err.code === 'invalid-op',
  );
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

  assert.deepEqual(
    codes(validateProtocolLine(
      {
        op: 'artifact',
        path: '/artifact',
        value: {
          runtime: 'arrow',
          source: {
            'main.ts': 'import { html } from "@arrow-js/core"; export default html`<input .value="${() => "nope"}" />`',
          },
        },
      },
      baseContext,
    )),
    ['unsupported-arrow-idl-binding'],
  );

  assert.deepEqual(
    codes(validateProtocolLine(
      {
        op: 'artifact',
        path: '/artifact',
        value: {
          runtime: 'arrow',
          source: {
            'main.ts': 'import { html } from "@arrow-js/core"; export default html`<button ${() => "disabled"}>Save</button>`',
          },
        },
      },
      baseContext,
    )),
    ['unsupported-arrow-open-tag-expression'],
  );
});
