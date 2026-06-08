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
