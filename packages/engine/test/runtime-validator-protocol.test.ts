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

test('accepts data-summon attributes in Arrow artifacts (subset restriction removed)', () => {
  // Experiment 2026-06-25: the legacy-data-summon block was an artificial
  // dialect restriction, not a real sandbox constraint. data-summon-* attrs are
  // now treated as ordinary HTML attributes inside Arrow templates.
  const issues = validateProtocolLine(
    {
      op: 'artifact',
      path: '/artifact',
      value: {
        runtime: 'arrow',
        source: {
          'main.ts': [
            'import { html } from "@arrow-js/core";',
            'export default html`',
            '<section data-summon-local="{&quot;open&quot;:false}">',
            '<button data-summon-on-click="save" data-summon-bind="label">Save</button>',
            '<p data-summon-show="saveError"></p>',
            '<div data-summon-resource="search" data-summon-resource-trigger="submit"></div>',
            '</section>`;',
          ].join('\n'),
        },
      },
    },
    baseContext,
  );
  assert.deepEqual(codes(issues), []);
});

test('accepts trusted component placeholder attributes in Arrow artifacts (subset restriction removed)', () => {
  const issues = validateProtocolLine(
    {
      op: 'artifact',
      path: '/artifact',
      value: {
        runtime: 'arrow',
        source: {
          'main.ts': [
            'import { html } from "@arrow-js/core";',
            'export default html`',
            '<div data-summon-component="MetricCard" data-summon-component-id="metric-1" data-summon-props="{&quot;label&quot;:&quot;Revenue&quot;}"></div>',
            '`;',
          ].join('\n'),
        },
      },
    },
    baseContext,
  );
  assert.deepEqual(codes(issues), []);
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
            'main.ts': [
              'import { html } from "@arrow-js/core";',
              'void fetch("https://example.test/track");',
              'export default html`<div>Weather</div>`;',
            ].join('\n'),
          },
        },
      },
      baseContext,
    )),
    ['arrow-network-not-granted'],
  );

  // IDL property bindings (`.value=`) are a verified @arrow-js/sandbox compiler
  // limitation, so the validator blocks them as a repairable issue (rewrite to
  // attribute + event bindings) rather than letting them crash at runtime.
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

  // Subset restriction removed (experiment 2026-06-25): open-tag template
  // expressions are now accepted, not blocked.
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
    [],
  );
});
