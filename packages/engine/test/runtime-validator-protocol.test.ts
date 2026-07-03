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

test('accepts valid Surface Document artifacts', () => {
  const issues = validateProtocolLine(
    {
      op: 'artifact',
      path: '/artifact',
      value: {
        runtime: 'surface-document',
        source: {
          'main.html': '<main><button id="save">Save</button></main>',
          'main.css': 'button { color: var(--color-text); }',
        },
      },
    },
    {
      ...baseContext,
      surfacePlan: {
        purpose: 'operate',
        runtime: 'surface-document',
        data: 'embedded',
        authority: 'host-action',
        persistence: 'replayable',
        network: 'none',
      },
    },
  );
  assert.deepEqual(issues, []);
});

test('accepts arbitrary inert data-* attributes in Surface Document artifacts', () => {
  // data-* attributes are ordinary inert HTML attributes; the renderer reads
  // none of them, so they carry no risk and must not be rejected.
  const issues = validateProtocolLine(
    {
      op: 'artifact',
      path: '/artifact',
      value: {
        runtime: 'surface-document',
        source: {
          'main.html': [
            '<section data-state="{&quot;open&quot;:false}">',
            '<button data-role="save" data-label="label">Save</button>',
            '<p data-error="saveError"></p>',
            '<div data-region="search"></div>',
            '</section>',
          ].join('\n'),
          'main.css': 'section { color: var(--color-text); }',
        },
      },
    },
    baseContext,
  );
  assert.deepEqual(codes(issues), []);
});

test('parser rejects unsupported section protocol ops', () => {
  assert.throws(
    () => parseProtocolLineStrict(JSON.stringify({ op: 'set', path: '/screen', value: { sections: ['hero'] } })),
    (err) => err instanceof ProtocolParseError && err.code === 'invalid-op',
  );
  assert.throws(
    () => parseProtocolLineStrict(JSON.stringify({ op: 'add', path: '/section/hero', html: '<p>Hi</p>' })),
    (err) => err instanceof ProtocolParseError && err.code === 'invalid-op',
  );
});

test('blocks malformed and unsafe Surface Document artifacts', () => {
  assert.deepEqual(
    codes(validateProtocolLine(
      {
        op: 'artifact',
        path: '/artifact',
        value: {
          runtime: 'surface-document',
          source: {
            'main.css': 'main { color: var(--color-text); }',
          },
        },
      },
      baseContext,
    )),
    ['missing-surface-document-file'],
  );

  assert.deepEqual(
    codes(validateProtocolLine(
      {
        op: 'artifact',
        path: '/artifact',
        value: {
          runtime: 'surface-document',
          source: {
            'main.ts': 'export default html`<div>unsupported</div>`',
          },
        },
      },
      baseContext,
    )),
    ['invalid-surface-document-source-path', 'missing-surface-document-file', 'missing-surface-document-file'],
  );

  assert.deepEqual(
    codes(validateProtocolLine(
      {
        op: 'artifact',
        path: '/artifact',
        value: {
          runtime: 'surface-document',
          source: {
            'main.html': '<main><button onclick="evil()">Save</button></main>',
            'main.css': 'main {}',
          },
        },
      },
      baseContext,
    )),
    ['surface-document-html-inline-handler'],
  );

  assert.deepEqual(
    codes(validateProtocolLine(
      {
        op: 'artifact',
        path: '/artifact',
        value: {
          runtime: 'surface-document',
          source: {
            'main.html': '<main>ok</main>',
            'main.css': '@import url("https://evil.test/steal.css");',
          },
        },
      },
      baseContext,
    )),
    ['surface-document-css-external-url', 'surface-document-css-import'],
  );

  assert.deepEqual(
    codes(validateProtocolLine(
      {
        op: 'artifact',
        path: '/artifact',
        value: {
          runtime: 'surface-document',
          source: {
            'main.html': '<main>ok</main>',
            'main.css': 'main {}',
            'main.js': 'void fetch("https://example.test/track");',
          },
        },
      },
      baseContext,
    )),
    ['surface-document-network-not-granted'],
  );
});
