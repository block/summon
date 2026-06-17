import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createProtocolHardener,
  type ContractIssue,
  type ProtocolHardenerResult,
  type ProtocolSkipMetaValue,
  type ValidationContext,
} from '../src/index.ts';

const baseContext: ValidationContext = {
  mode: 'static',
  surfacePlan: {
    purpose: 'inform',
    runtime: 'arrow',
    data: 'embedded',
    authority: 'none',
    persistence: 'replayable',
    network: 'none',
  },
};

function artifactLine(source = 'import { html } from "@arrow-js/core";\nexport default html`<p>Hi</p>`'): string {
  return JSON.stringify({
    op: 'artifact',
    path: '/artifact',
    value: {
      runtime: 'arrow',
      source: {
        'main.ts': source,
      },
    },
  });
}

function issueCodes(issues: ContractIssue[]): string[] {
  return issues.map((issue) => issue.code).sort();
}

function skipValue(result: ProtocolHardenerResult): ProtocolSkipMetaValue {
  const line = result.outboundLines[0];
  if (!line || line.op !== 'meta' || line.path !== '/protocol-skip') {
    throw new Error(`expected /protocol-skip, got ${JSON.stringify(line)}`);
  }
  return line.value as ProtocolSkipMetaValue;
}

test('malformed text emits protocol-skip and does not block', () => {
  const hardener = createProtocolHardener({ validationContext: baseContext });
  const result = hardener.processRawLine('not json at all');

  assert.equal(result.blocked, undefined);
  assert.deepEqual(result.acceptedLines, []);
  assert.equal(skipValue(result).code, 'malformed-jsonl');
  assert.equal(skipValue(result).severity, 'warn');
});

test('meta lines pass through unless host-owned', () => {
  const hardener = createProtocolHardener({ validationContext: baseContext });
  const status = hardener.processRawLine(JSON.stringify({ op: 'meta', path: '/status', value: 'writing' }));
  const hostOwned = hardener.processRawLine(JSON.stringify({ op: 'meta', path: '/surface-plan', value: {} }));

  assert.deepEqual(status.outboundLines.map((line) => line.path), ['/status']);
  assert.deepEqual(status.acceptedLines, []);
  assert.equal(hostOwned.blocked?.code, 'host-owned-meta');
  assert.deepEqual(hostOwned.outboundLines, []);
});

test('valid Arrow artifacts are accepted and emitted', () => {
  const hardener = createProtocolHardener({ validationContext: baseContext });
  const result = hardener.processRawLine(artifactLine());

  assert.equal(result.blocked, undefined);
  assert.deepEqual(result.outboundLines.map((line) => line.path), ['/artifact']);
  assert.deepEqual(result.acceptedLines.map((line) => line.path), ['/artifact']);
  assert.deepEqual(result.issues, []);
});

test('invalid Arrow artifacts block with validation issues', () => {
  const hardener = createProtocolHardener({ validationContext: baseContext });
  const result = hardener.processRawLine(artifactLine('import { html } from "@arrow-js/core";\nexport default html`<input .value=${state.title}>`'));

  assert.equal(result.blocked?.code, 'unsupported-arrow-idl-binding');
  assert.deepEqual(result.outboundLines, []);
  assert.deepEqual(result.acceptedLines, []);
  assert.deepEqual(issueCodes(result.issues), ['unsupported-arrow-idl-binding']);
});

test('legacy section protocol is skipped as unsupported JSONL protocol', () => {
  const hardener = createProtocolHardener({ validationContext: baseContext });
  const setResult = hardener.processRawLine(JSON.stringify({ op: 'set', path: '/screen', value: { sections: ['hero'] } }));
  const addResult = hardener.processRawLine(JSON.stringify({ op: 'add', path: '/section/hero', html: '<p>Hi</p>' }));

  assert.equal(setResult.blocked, undefined);
  assert.equal(addResult.blocked, undefined);
  assert.equal(skipValue(setResult).code, 'malformed-jsonl');
  assert.equal(skipValue(addResult).code, 'malformed-jsonl');
  assert.deepEqual(setResult.acceptedLines, []);
  assert.deepEqual(addResult.acceptedLines, []);
});
