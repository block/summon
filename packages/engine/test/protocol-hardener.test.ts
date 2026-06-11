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

function blockSet(section: string, blocks: string[]): string {
  return JSON.stringify({ op: 'set', path: `/section/${section}`, value: { blocks } });
}

function blockAdd(section: string, block: string, html = '<p>Hi</p>'): string {
  return JSON.stringify({ op: 'add', path: `/section/${section}/block/${block}`, html });
}

function nodeAdd(section: string, node: string, html: string, parent?: string): string {
  return JSON.stringify({
    op: 'add',
    path: `/section/${section}/node/${node}`,
    html,
    ...(parent ? { parent } : {}),
  });
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

test('block fragments require declared section and block order before accepted adds', () => {
  const hardener = createProtocolHardener({ validationContext: baseContext });
  hardener.processRawLine(screen(['summary']));

  const declaration = hardener.processRawLine(blockSet('summary', ['headline', 'metrics']));
  assert.deepEqual(acceptedOpPaths(declaration), ['set:/section/summary']);

  const addResult = hardener.processRawLine(blockAdd('summary', 'headline', '<h1>Ready</h1>'));
  assert.equal(addResult.blocked, undefined);
  assert.deepEqual(acceptedOpPaths(addResult), ['add:/section/summary/block/headline']);
});

test('block fragments reject undeclared blocks without blocking the stream', () => {
  const hardener = createProtocolHardener({ validationContext: baseContext });
  hardener.processRawLine(screen(['summary']));
  hardener.processRawLine(blockSet('summary', ['headline']));

  const result = hardener.processRawLine(blockAdd('summary', 'metrics', '<p>Wrong</p>'));
  assert.equal(result.blocked, undefined);
  assert.deepEqual(result.acceptedLines, []);
  assert.equal(skipValue(result).code, 'undeclared-block');
});

test('unsafe block HTML blocks and can be repaired at the block path', () => {
  const hardener = createProtocolHardener({ validationContext: baseContext });
  hardener.processRawLine(screen(['summary']));
  hardener.processRawLine(blockSet('summary', ['headline']));

  const result = hardener.processRawLine(blockAdd('summary', 'headline', '<script>alert(1)</script>'));
  assert.equal(result.blocked?.code, 'static-script');
  assert.equal(result.repairFeedback?.[0]?.target, '/section/summary/block/headline');
  assert.deepEqual(result.acceptedLines, []);
});

test('block fragments validate the recomposed parent section', () => {
  const componentContext: ValidationContext = {
    ...baseContext,
    components: [{ name: 'MetricCard' }],
  };
  const hardener = createProtocolHardener({ validationContext: componentContext });
  hardener.processRawLine(screen(['summary']));
  hardener.processRawLine(blockSet('summary', ['metric-a', 'metric-b']));

  const html = '<div data-summon-component="MetricCard" data-summon-component-id="metric" data-summon-props="{}"></div>';
  assert.equal(hardener.processRawLine(blockAdd('summary', 'metric-a', html)).blocked, undefined);
  const duplicate = hardener.processRawLine(blockAdd('summary', 'metric-b', html));
  assert.equal(duplicate.blocked?.code, 'component-id-duplicate');
  assert.equal(duplicate.repairFeedback?.[0]?.target, '/section/summary/block/metric-b');
});

test('html node fragments require experiment mode and a declared section', () => {
  const disabled = createProtocolHardener({ validationContext: baseContext });
  const disabledResult = disabled.processRawLine(
    nodeAdd('main', 'root', '<div data-summon-node="root"></div>'),
  );
  assert.equal(skipValue(disabledResult).code, 'experimental-node-fragment-disabled');

  const hardener = createProtocolHardener({
    validationContext: { ...baseContext, experimentalFragmentMode: 'html-node-v0' },
  });
  const undeclared = hardener.processRawLine(
    nodeAdd('main', 'root', '<div data-summon-node="root"></div>'),
  );
  assert.equal(skipValue(undeclared).code, 'undeclared-section');
});

test('html node fragments accept parented raw HTML patches', () => {
  const hardener = createProtocolHardener({
    validationContext: { ...baseContext, experimentalFragmentMode: 'html-node-v0' },
  });
  hardener.processRawLine(screen(['main']));

  const root = hardener.processRawLine(
    nodeAdd('main', 'root', '<div data-summon-node="root" class="dashboard"></div>'),
  );
  assert.equal(root.blocked, undefined);
  assert.deepEqual(acceptedOpPaths(root), ['add:/section/main/node/root']);

  const child = hardener.processRawLine(
    nodeAdd('main', 'headline', '<header data-summon-node="headline"><h1>Ready</h1></header>', 'root'),
  );
  assert.equal(child.blocked, undefined);
  assert.deepEqual(acceptedOpPaths(child), ['add:/section/main/node/headline']);
});

test('html node fragments reject missing parents without blocking the stream', () => {
  const hardener = createProtocolHardener({
    validationContext: { ...baseContext, experimentalFragmentMode: 'html-node-v0' },
  });
  hardener.processRawLine(screen(['main']));

  const result = hardener.processRawLine(
    nodeAdd('main', 'headline', '<header data-summon-node="headline"></header>', 'root'),
  );
  assert.equal(result.blocked, undefined);
  assert.deepEqual(result.acceptedLines, []);
  assert.equal(skipValue(result).code, 'undeclared-node-parent');
});

test('unsafe html node patch blocks and can be repaired at the node path', () => {
  const hardener = createProtocolHardener({
    validationContext: { ...baseContext, experimentalFragmentMode: 'html-node-v0' },
  });
  hardener.processRawLine(screen(['main']));

  const result = hardener.processRawLine(
    nodeAdd('main', 'root', '<div data-summon-node="root"><script>alert(1)</script></div>'),
  );
  assert.equal(result.blocked?.code, 'static-script');
  assert.equal(result.repairFeedback?.[0]?.target, '/section/main/node/root');
  assert.deepEqual(result.acceptedLines, []);
});

test('html node patches reject nested node ids', () => {
  const hardener = createProtocolHardener({
    validationContext: { ...baseContext, experimentalFragmentMode: 'html-node-v0' },
  });
  hardener.processRawLine(screen(['main']));

  const result = hardener.processRawLine(
    nodeAdd(
      'main',
      'root',
      '<div data-summon-node="root"><p data-summon-node="nested">Wrong</p></div>',
    ),
  );
  assert.equal(result.blocked?.code, 'nested-node-id');
  assert.equal(result.repairFeedback?.[0]?.target, '/section/main/node/root');
});

test('html node fragments validate the recomposed parent section', () => {
  const componentContext: ValidationContext = {
    ...baseContext,
    experimentalFragmentMode: 'html-node-v0',
    components: [{ name: 'MetricCard' }],
  };
  const hardener = createProtocolHardener({ validationContext: componentContext });
  hardener.processRawLine(screen(['main']));
  hardener.processRawLine(
    nodeAdd('main', 'root', '<div data-summon-node="root"></div>'),
  );

  const html = '<div data-summon-node="metric-a" data-summon-component="MetricCard" data-summon-component-id="metric" data-summon-props="{}"></div>';
  assert.equal(hardener.processRawLine(nodeAdd('main', 'metric-a', html, 'root')).blocked, undefined);
  const duplicate = hardener.processRawLine(
    nodeAdd(
      'main',
      'metric-b',
      '<div data-summon-node="metric-b" data-summon-component="MetricCard" data-summon-component-id="metric" data-summon-props="{}"></div>',
      'root',
    ),
  );
  assert.equal(duplicate.blocked?.code, 'component-id-duplicate');
  assert.equal(duplicate.repairFeedback?.[0]?.target, '/section/main/node/metric-b');
});
