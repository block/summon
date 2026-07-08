import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { assembleCatalog } from '@design-intelligence/ghost/core';
import {
  compileConjurorContext,
} from '../src/ghost/conjuror.js';
import type { TextCompletionRequest } from '../src/types.js';

const surfacePlan = {
  purpose: 'inform',
  runtime: 'surface-document',
  data: 'embedded',
  authority: 'none',
  persistence: 'ephemeral',
} as const;

const baseOptions = {
  userPrompt: 'show the queue dashboard',
  mode: 'static' as const,
  surfacePlan,
};

describe('Conjuror', () => {
  it('keeps small auto corpora in full-corpus order', async () => {
    const catalog = assembleCatalog({
      placedNodes: [
        node('index', 'front door'),
        node('rail', 'rail body', 'pattern', 'Update rail'),
        node('card', 'card body', 'pattern', 'Dense card'),
      ],
    });

    const compiled = await compileConjurorContext(catalog, [], {
      ...baseOptions,
      strategy: 'auto',
      fullPullNodeLimit: 12,
      preselectedSurface: 'rail',
    });

    assert.equal(compiled.packet.strategy, 'full-corpus');
    assert.equal(compiled.surface, 'rail');
    assert.deepEqual(compiled.pulled.map((pulled) => [pulled.id, pulled.reason]), [
      ['index', 'front-door'],
      ['rail', 'anchor'],
      ['card', 'corpus'],
    ]);
    assert.match(compiled.prompt, /## index — front door\n\nfront door/);
    assert.match(compiled.prompt, /## rail — lead composition\n\nrail body/);
  });

  it('selects a compiled lead and supports while dropping invalid selector ids', async () => {
    const catalog = largeCatalog();
    const compiled = await compileConjurorContext(catalog, [], {
      ...baseOptions,
      strategy: 'compiled',
      completeText: async () => JSON.stringify({
        leadId: 'dashboard',
        supportIds: ['metric-card', 'missing-node', 'activity-rail'],
        excluded: [{ id: 'settings', reason: 'not relevant' }, { id: 'also-missing', reason: 'bad id' }],
      }),
    });

    assert.equal(compiled.packet.strategy, 'compiled');
    assert.equal(compiled.surface, 'dashboard');
    assert.deepEqual(compiled.pulled.map((pulled) => pulled.id), [
      'index',
      'dashboard',
      'activity-rail',
      'metric-card',
      'tokens',
    ]);
    assert.equal(compiled.pulled.find((pulled) => pulled.id === 'dashboard')?.reason, 'anchor');
    assert.ok(compiled.packet.warnings.some((warning) => warning.includes('missing-node')));
    assert.deepEqual(compiled.packet.excludedNodes, [{ id: 'settings', reason: 'not relevant' }]);
  });

  it('falls back safely when selector output is malformed', async () => {
    const catalog = largeCatalog();
    const compiled = await compileConjurorContext(catalog, [], {
      ...baseOptions,
      strategy: 'compiled',
      completeText: async () => 'not json',
    });

    assert.equal(compiled.packet.strategy, 'compiled');
    assert.ok(compiled.pulled.some((pulled) => pulled.id === 'index'));
    assert.ok(compiled.pulled.some((pulled) => pulled.id === 'tokens'));
    assert.ok(compiled.packet.warnings.some((warning) => warning.includes('malformed')));
    assert.match(compiled.prompt, /# Ghost Fingerprint/);
  });

  it('pulls the full corpus in steering order: concrete first, guard last', async () => {
    const catalog = assembleCatalog({
      placedNodes: [
        node('index', 'front door'),
        node('zz-skeleton', 'lead-in\n\n## Skeleton\n\n```html\n<main>\n  <h1>seed</h1>\n</main>\n```', 'pattern', 'Skeleton carrier'),
        node('aa-prose', 'plain prose body', 'principle', 'Plain prose'),
        node('mm-guard', 'never do the forbidden thing', 'constraint', 'Guardrail'),
      ],
      guardKinds: ['constraint'],
    });

    const compiled = await compileConjurorContext(catalog, [], {
      ...baseOptions,
      strategy: 'full-corpus',
      preselectedSurface: 'index',
    });

    // concrete (skeleton carrier) beats alphabetical order; guard sinks last.
    assert.deepEqual(compiled.pulled.map((pulled) => pulled.id), [
      'index',
      'zz-skeleton',
      'aa-prose',
      'mm-guard',
    ]);
  });

  it('strips Skeleton sections from bodies and emits them last as the artifact seed', async () => {
    const catalog = assembleCatalog({
      placedNodes: [
        node('index', 'front door'),
        node('shell', 'prose about the shell\n\n## Skeleton\n\n```html\n<main>\n  <h1>seed</h1>\n</main>\n```', 'pattern', 'App shell'),
      ],
    });

    const compiled = await compileConjurorContext(catalog, [], {
      ...baseOptions,
      strategy: 'full-corpus',
      preselectedSurface: 'shell',
    });

    // Body keeps its prose but loses the Skeleton section.
    assert.match(compiled.prompt, /## shell — lead composition\n\nprose about the shell/);
    assert.ok(!/lead composition[\s\S]*?## Skeleton/.test(compiled.prompt.split('## Skeletons')[0] ?? ''));
    // Skeleton fences re-emitted as the final block.
    const skeletonIndex = compiled.prompt.indexOf('## Skeletons — begin the artifact from this structure');
    assert.ok(skeletonIndex > compiled.prompt.indexOf('## shell'));
    assert.match(compiled.prompt, /### From shell\n\n```html\n<main>\n {2}<h1>seed<\/h1>\n<\/main>\n```/);
  });

  it('advertises concrete, skeleton, and posture flags in the compiled selector menu', async () => {
    let selectorPrompt = '';
    const catalog = assembleCatalog({
      placedNodes: [
        node('index', 'front door'),
        node('shell', 'body\n\n## Skeleton\n\n```html\n<div>\n  <p>x</p>\n</div>\n```', 'pattern', 'App shell'),
        node('rule', 'guard body', 'constraint', 'Never break this'),
        ...['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map((id) => node(`node-${id}`, `${id} body`)),
      ],
      guardKinds: ['constraint'],
    });

    await compileConjurorContext(catalog, [], {
      ...baseOptions,
      strategy: 'compiled',
      completeText: async (request: TextCompletionRequest) => {
        selectorPrompt = request.prompt;
        return JSON.stringify({ leadId: 'shell', supportIds: [] });
      },
    });

    assert.match(selectorPrompt, /- shell kind=pattern concrete=true skeleton=true: App shell/);
    assert.match(selectorPrompt, /- rule kind=constraint posture=guard: Never break this/);
  });

  it('includes token CSS nodes even when the selector omits them', async () => {
    const catalog = largeCatalog();
    const compiled = await compileConjurorContext(catalog, [], {
      ...baseOptions,
      strategy: 'compiled',
      completeText: async (_request: TextCompletionRequest) => JSON.stringify({
        leadId: 'dashboard',
        supportIds: ['metric-card'],
      }),
    });

    assert.ok(compiled.pulled.some((pulled) => pulled.id === 'tokens'));
    assert.match(compiled.prompt, /```css\n:root \{ --accent: red; \}\n```/);
  });
});

function node(id: string, body: string, kind = 'pattern', description = id) {
  return {
    id,
    doc: {
      frontmatter: { description },
      body,
    },
    kind,
  };
}

function largeCatalog() {
  return assembleCatalog({
    placedNodes: [
      node('index', 'front door grammar'),
      node('dashboard', 'dashboard body', 'pattern', 'Operational dashboard for queue health'),
      node('metric-card', 'metric card body', 'pattern', 'Metric cards for operational KPIs'),
      node('activity-rail', 'activity rail body', 'pattern', 'Chronological activity rail'),
      node('settings', 'settings body', 'pattern', 'Settings editor'),
      node('tokens', 'token body\n\n```css\n:root { --accent: red; }\n```', 'token', 'Token CSS'),
      node('node-a', 'a body'),
      node('node-b', 'b body'),
      node('node-c', 'c body'),
      node('node-d', 'd body'),
      node('node-e', 'e body'),
      node('node-f', 'f body'),
      node('node-g', 'g body'),
    ],
  });
}
