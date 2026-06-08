import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createProtocolHardener,
  type ProtocolHardenerResult,
  type ProtocolLine,
  type ProtocolSkipMetaValue,
  type ScreenSynthesizedMetaValue,
  type SummonLayout,
  type ValidationContext,
  type ContractIssue,
} from '../src/index.ts';

const baseContext: ValidationContext = {
  mode: 'static',
  capabilities: [{ name: 'choose', triggers: ['click'] }],
  definedTokens: new Set(['color-text', 'space-2', 'radius-pill']),
};

const interactiveContext: ValidationContext = {
  mode: 'interactive',
  capabilities: [
    { name: 'choose', triggers: ['click'] },
    { name: 'search', triggers: ['submit', 'mount'] },
  ],
};

function add(section: string, html = '<p>Hi</p>'): string {
  return JSON.stringify({ op: 'add', path: `/section/${section}`, html });
}

function screen(sections: string[]): string {
  return JSON.stringify({ op: 'set', path: '/screen', value: { sections } });
}

function opPaths(result: ProtocolHardenerResult): string[] {
  return result.outboundLines.map((line) => `${line.op}:${line.path}`);
}

function acceptedOpPaths(result: ProtocolHardenerResult): string[] {
  return result.acceptedLines.map((line) => `${line.op}:${line.path}`);
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

function synthesizedValue(result: ProtocolHardenerResult): ScreenSynthesizedMetaValue {
  const line = result.outboundLines[0];
  if (!line || line.op !== 'meta' || line.path !== '/screen-synthesized') {
    throw new Error(`expected /screen-synthesized, got ${JSON.stringify(line)}`);
  }
  return line.value as ScreenSynthesizedMetaValue;
}

function screenSections(line: ProtocolLine): string[] {
  if (line.op !== 'set') throw new Error(`expected set line, got ${line.op}`);
  const value = line.value as { sections?: unknown };
  return Array.isArray(value.sections)
    ? value.sections.filter((section): section is string => typeof section === 'string')
    : [];
}

test('malformed text emits protocol-skip and does not block', () => {
  const hardener = createProtocolHardener({ validationContext: baseContext });
  const result = hardener.processRawLine('not json at all');

  assert.equal(result.blocked, undefined);
  assert.deepEqual(result.acceptedLines, []);
  assert.equal(skipValue(result).code, 'malformed-jsonl');
  assert.equal(skipValue(result).severity, 'warn');
});

test('early add synthesizes a screen before accepting the section', () => {
  const hardener = createProtocolHardener({ validationContext: baseContext });
  const result = hardener.processRawLine(add('hero'));

  assert.deepEqual(opPaths(result), [
    'meta:/screen-synthesized',
    'set:/screen',
    'add:/section/hero',
  ]);
  assert.deepEqual(synthesizedValue(result), {
    sections: ['hero'],
    reason: 'add-before-screen',
  });
  assert.deepEqual(acceptedOpPaths(result), ['set:/screen', 'add:/section/hero']);
  assert.deepEqual(screenSections(result.acceptedLines[0]!), ['hero']);
});

test('synthetic screen grows until a valid real screen arrives', () => {
  const hardener = createProtocolHardener({ validationContext: baseContext });

  hardener.processRawLine(add('hero'));
  const second = hardener.processRawLine(add('details'));
  assert.deepEqual(screenSections(second.outboundLines[1]!), ['hero', 'details']);

  const real = hardener.processRawLine(screen(['details']));
  assert.deepEqual(acceptedOpPaths(real), ['set:/screen']);
  assert.deepEqual(screenSections(real.acceptedLines[0]!), ['details']);

  const declared = hardener.processRawLine(add('details', '<p>Updated</p>'));
  assert.deepEqual(acceptedOpPaths(declared), ['add:/section/details']);
});

test('synthetic screen caps at the configured section limit', () => {
  const hardener = createProtocolHardener({
    validationContext: baseContext,
    maxSyntheticSections: 2,
  });

  hardener.processRawLine(add('one'));
  hardener.processRawLine(add('two'));
  const third = hardener.processRawLine(add('three'));

  assert.equal(third.blocked, undefined);
  assert.deepEqual(third.acceptedLines, []);
  assert.equal(skipValue(third).code, 'synthetic-section-limit');
});

test('real screen order rejects later undeclared sections', () => {
  const hardener = createProtocolHardener({ validationContext: baseContext });

  hardener.processRawLine(screen(['hero']));
  const result = hardener.processRawLine(add('details'));

  assert.equal(result.blocked, undefined);
  assert.deepEqual(result.acceptedLines, []);
  assert.equal(skipValue(result).code, 'undeclared-section');
});

test('layout mode skips model screens and out-of-slot adds', () => {
  const layout: SummonLayout = {
    id: 'card-structured',
    slots: [
      { id: 'header', purpose: 'title and main takeaway' },
      { id: 'content', purpose: 'supporting details' },
    ],
  };
  const hardener = createProtocolHardener({ validationContext: baseContext, layout });

  const screenResult = hardener.processRawLine(screen(['header', 'content']));
  assert.equal(skipValue(screenResult).code, 'layout-disallowed');

  const outOfSlot = hardener.processRawLine(add('actions'));
  assert.equal(skipValue(outOfSlot).code, 'layout-disallowed');

  const allowed = hardener.processRawLine(add('header'));
  assert.deepEqual(acceptedOpPaths(allowed), ['add:/section/header']);
});

test('edit mode accepts targeted section replacement without synthetic screen', () => {
  const hardener = createProtocolHardener({
    validationContext: baseContext,
    initialScreenSections: ['hero', 'details'],
    allowedSectionIds: ['details'],
  });
  const result = hardener.processRawLine(add('details', '<p>Updated</p>'));

  assert.deepEqual(opPaths(result), ['add:/section/details']);
  assert.deepEqual(acceptedOpPaths(result), ['add:/section/details']);
});

test('edit mode rejects untargeted section replacements', () => {
  const hardener = createProtocolHardener({
    validationContext: baseContext,
    initialScreenSections: ['hero', 'details'],
    allowedSectionIds: ['details'],
  });
  const result = hardener.processRawLine(add('hero', '<p>Wrong target</p>'));

  assert.equal(skipValue(result).code, 'section-not-targeted');
  assert.equal(result.repairFeedback?.[0]?.status, 'skipped');
});

test('blocked add returns repair feedback and rejected line', () => {
  const hardener = createProtocolHardener({ validationContext: baseContext });
  const result = hardener.processRawLine(add('hero', '<img src="https://example.com/a.png">'));

  assert.equal(result.blocked?.code, 'external-url');
  assert.equal(result.rejectedLine?.path, '/section/hero');
  assert.equal(result.repairFeedback?.[0]?.schemaId, 'summon.repair-feedback.v2');
  assert.equal(result.repairFeedback?.[0]?.status, 'blocked');
  assert.equal(result.repairFeedback?.[0]?.retryable, true);
  assert.equal(result.repairFeedback?.[0]?.target, '/section/hero');
});

test('patch set can reorder existing screen sections', () => {
  const hardener = createProtocolHardener({
    validationContext: baseContext,
    initialScreenSections: ['hero', 'details'],
  });
  const result = hardener.processRawLine(screen(['details', 'hero']));

  assert.deepEqual(acceptedOpPaths(result), ['set:/screen']);
  assert.deepEqual(screenSections(result.acceptedLines[0]!), ['details', 'hero']);
});

test('unsafe HTML blocks and emits no accepted add', () => {
  const hardener = createProtocolHardener({ validationContext: baseContext });
  const result = hardener.processRawLine(add('hero', '<img src="https://example.com/a.png">'));

  assert.equal(result.blocked?.code, 'external-url');
  assert.deepEqual(result.outboundLines, []);
  assert.deepEqual(result.acceptedLines, []);
});

test('ungranted mount, click, and submit trigger usage blocks', () => {
  const hardener = createProtocolHardener({ validationContext: interactiveContext });

  const mount = hardener.processRawLine(add('hero', '<div data-summon-on-mount="choose"></div>'));
  assert.equal(mount.blocked?.code, 'intent-trigger-not-granted');

  const click = createProtocolHardener({ validationContext: interactiveContext })
    .processRawLine(add('hero', '<button data-summon-on-click="search">Search</button>'));
  assert.equal(click.blocked?.code, 'intent-trigger-not-granted');

  const submit = createProtocolHardener({ validationContext: interactiveContext })
    .processRawLine(add('hero', '<form data-summon-on-submit="choose"></form>'));
  assert.equal(submit.blocked?.code, 'intent-trigger-not-granted');
});

test('style warnings do not skip or block accepted lines', () => {
  const hardener = createProtocolHardener({ validationContext: baseContext });
  const result = hardener.processRawLine(
    add('hero', '<p style="color:#fff;margin:13px">Hi</p>'),
  );

  assert.equal(result.blocked, undefined);
  assert.deepEqual(issueCodes(result.issues), ['raw-color', 'raw-px']);
  assert.deepEqual(acceptedOpPaths(result), ['set:/screen', 'add:/section/hero']);
});

test('accepted structural lines remain suitable for Ghost review packets', () => {
  const hardener = createProtocolHardener({ validationContext: baseContext });
  const result = hardener.processRawLine(add('hero'));

  assert.deepEqual(opPaths(result), [
    'meta:/screen-synthesized',
    'set:/screen',
    'add:/section/hero',
  ]);
  assert.equal(result.acceptedLines.every((line) => line.op === 'set' || line.op === 'add'), true);
});
