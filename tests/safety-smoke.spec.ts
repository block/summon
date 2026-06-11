import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const bootstrapSource = readFileSync(
  new URL('../packages/sandbox-runtime/src/bootstrap.js', import.meta.url),
  'utf8',
).replace(/<\/script/gi, '<\\/script');

function collectPageErrors(page: Page): Error[] {
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  return errors;
}

const hostSearchPlan = {
  purpose: 'explore',
  runtime: 'declarative',
  data: 'host-resource',
  authority: 'read',
  persistence: 'replayable',
};

const componentIslandsPlan = {
  purpose: 'review',
  runtime: 'declarative',
  data: 'embedded',
  authority: 'host-action',
  persistence: 'replayable',
};

const componentIslandsPolicy = {
  tier: 'declarative',
  purpose: 'review',
  grants: ['choose'],
  components: ['MetricCard', 'TrendSparkline', 'ApprovalStatus'],
};

function jsonl(lines: any[]): string {
  return `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`;
}

test('adversarial sandbox boundary holds', async ({ page }) => {
  await page.goto('/adversarial.html');

  const summary = page.locator('#summary');
  await expect(summary).toContainText('Sandbox boundary holding.', { timeout: 30_000 });
  await expect(summary).toContainText(/All 25 tests passed/);
  await expect(page.locator('#results .fail')).toHaveCount(0);

  const results = page.locator('#results');
  await expect(results).toContainText('intent="exfiltrate"');
  await expect(results).toContainText('intent="escalate"');
});

test('bootstrap self-test fails closed on unsafe sandbox config', async ({ page }) => {
  await page.goto('/fatal.html');

  await expect(page.locator('#case-a-result')).toContainText('SUMMON_READY');
  await expect(page.locator('#case-a-result .fail')).toHaveCount(0);

  const fatalResult = page.locator('#case-b-result');
  await expect(fatalResult).toContainText('SUMMON_FATAL');
  await expect(fatalResult).toContainText(/null-origin|top\.location readable|window\.top\.location readable/);
  await expect(fatalResult.locator('.fail')).toHaveCount(0);
});

test('strict input keeps sensitive entry in host overlay', async ({ page }) => {
  await page.goto('/strict.html');

  const hostInput = page.locator('[data-summon-strict-slot="card_number"] input');
  await expect(hostInput).toBeVisible();
  await hostInput.fill('4242 4242 4242 4242');

  const sandbox = page.frameLocator('#sandbox');
  const payButton = sandbox.locator('#pay');
  await expect(payButton).toBeEnabled();
  await payButton.click();

  await expect(page.locator('#log')).toContainText('tokenized: last4=4242');
  const result = sandbox.locator('#result');
  await expect(result).toContainText('Tokenized.');
  await expect(result).toContainText('last4=4242');
  await expect(result).not.toContainText('4242 4242 4242 4242');
});

test('generate page boots without server credentials', async ({ page }) => {
  const pageErrors = collectPageErrors(page);

  await page.goto('/generate.html');

  await expect(page.locator('#sandbox')).toHaveAttribute('sandbox', 'allow-scripts');
  await expect(page.locator('#go')).toBeEnabled();
  await expect(page.locator('#welcome')).toBeVisible();
  await expect(page.locator('#welcome')).toContainText('Host Data Search');
  await expect(page.locator('#scenario')).toContainText('Host Data Search');
  await expect(page.locator('.generate-shell')).toBeVisible();
  await expect(page.locator('.scenario-card.active')).toContainText('Host Data Search');
  await expect(page.locator('#contract-summary [data-contract-row="requested"]')).toContainText(
    'Requested surface config',
  );
  await expect(page.locator('#custom-contract-panel')).toBeHidden();
  await page.locator('#custom-contract-enabled').check();
  await expect(page.locator('#custom-contract-panel')).toBeVisible();

  expect(pageErrors.map((error) => error.message)).toEqual([]);
});

test('sandbox node patches preserve untouched sibling DOM', async ({ page }) => {
  const sandboxId = 'node-patch-test';
  await page.setContent(`
    <script>
      window.__summonMessages = [];
      window.addEventListener('message', (event) => window.__summonMessages.push(event.data));
    </script>
    <iframe id="sandbox" sandbox="allow-scripts"></iframe>
  `);
  const srcdoc = `<!doctype html>
    <html>
      <head>
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-src 'none'; child-src 'none'; media-src 'none'; object-src 'none'; worker-src 'none'">
        <meta charset="utf-8">
        <script>window.__SUMMON_SANDBOX_ID__=${JSON.stringify(sandboxId)};window.__SUMMON_RESOURCES__={};</script>
        <script>${bootstrapSource}</script>
      </head>
      <body><div id="summon-root"></div></body>
    </html>`;
  await page.locator('#sandbox').evaluate((iframe, html) => {
    (iframe as HTMLIFrameElement).srcdoc = html;
  }, srcdoc);
  await expect.poll(async () => page.evaluate(() => {
    const messages = (window as any).__summonMessages as any[];
    return messages.some((message) => message?.type === 'SUMMON_READY');
  })).toBe(true);

  async function patchNode(patch: any) {
    await page.locator('#sandbox').evaluate((iframe, nextPatch) => {
      (iframe as HTMLIFrameElement).contentWindow?.postMessage({
        type: 'SUMMON_NODE_PATCH',
        patch: nextPatch,
      }, '*');
    }, patch);
  }

  await patchNode({
    sectionId: 'main',
    nodeId: 'root',
    html: '<div data-summon-node="root"></div>',
  });
  await patchNode({
    sectionId: 'main',
    nodeId: 'a',
    parentId: 'root',
    html: '<label data-summon-node="a">Name <input value=""></label>',
  });
  await patchNode({
    sectionId: 'main',
    nodeId: 'b',
    parentId: 'root',
    html: '<p data-summon-node="b">Draft</p>',
  });

  const sandbox = page.frameLocator('#sandbox');
  const input = sandbox.locator('[data-summon-node="a"] input');
  await expect(input).toBeVisible();
  await input.fill('sticky value');
  await expect(input).toBeFocused();

  await patchNode({
    sectionId: 'main',
    nodeId: 'b',
    parentId: 'root',
    html: '<p data-summon-node="b">Final</p>',
  });

  await expect(sandbox.locator('[data-summon-node="b"]')).toContainText('Final');
  await expect(input).toHaveValue('sticky value');
  await expect(input).toBeFocused();

  await patchNode({
    sectionId: 'main',
    nodeId: 'card',
    parentId: 'root',
    html: '<article data-summon-node="card"><h2>Sales</h2><div class="slot" data-summon-node-children><div data-summon-skeleton></div><div data-summon-skeleton><span>Loading</span></div></div></article>',
  });
  const card = sandbox.locator('[data-summon-node="card"]');
  await expect(card).toHaveClass(/summon-node-enter/);
  await expect(sandbox.locator('[data-summon-node="card"] [data-summon-node-children] > [data-summon-skeleton]')).toHaveCount(2);

  await patchNode({
    sectionId: 'main',
    nodeId: 'card-value',
    parentId: 'card',
    html: '<p data-summon-node="card-value">Inside card</p>',
  });

  const cardSlot = sandbox.locator('[data-summon-node="card"] [data-summon-node-children]');
  const cardSlotChild = sandbox.locator(
    '[data-summon-node="card"] [data-summon-node-children] > [data-summon-node="card-value"]',
  );
  await expect(cardSlot).toHaveClass(/summon-slot-filled/);
  await expect(sandbox.locator('[data-summon-node="card"] [data-summon-node-children] > [data-summon-skeleton]')).toHaveCount(0);
  await expect(cardSlotChild).toContainText('Inside card');
  await expect(cardSlotChild).toHaveClass(/summon-node-enter/);
  await expect(cardSlotChild).not.toHaveClass(/summon-node-enter/);

  await patchNode({
    sectionId: 'main',
    nodeId: 'card',
    parentId: 'root',
    html: '<article data-summon-node="card"><h2>Sales updated</h2><div class="slot" data-summon-node-children></div></article>',
  });

  await expect(card).toHaveClass(/summon-node-update/);
  await expect(card).toContainText('Sales updated');
  await expect(cardSlotChild).toContainText('Inside card');
  await expect(cardSlotChild).not.toHaveClass(/summon-node-update/);
});

test('generate showcase uses the agent broker by default', async ({ page }) => {
  let captured: any = null;
  await page.route('**/api/generate', async (route) => {
    captured = route.request().postDataJSON();
    const body = jsonl([
      {
        op: 'meta',
        path: '/agent-intent',
        value: {
          purpose: 'explore',
          interaction: 'search',
          dataNeed: 'host-resource',
          sideEffect: 'none',
          requestedCapabilities: ['search'],
          requestedComponents: [],
          confidence: 0.72,
          rationale: 'deterministic keyword and catalog match',
        },
      },
      {
        op: 'meta',
        path: '/agent-policy-resolution',
        value: {
          source: 'default',
          proposedSurfacePolicy: {
            tier: 'declarative',
            purpose: 'explore',
            grants: ['search'],
            components: [],
            persistence: 'replayable',
          },
          surfacePolicy: {
            tier: 'declarative',
            purpose: 'explore',
            grants: ['search'],
            persistence: 'replayable',
          },
          rejectedCapabilities: [],
          rejectedComponents: [],
          fallback: false,
        },
      },
      { op: 'meta', path: '/surface-policy', value: { tier: 'declarative', purpose: 'explore', grants: ['search'] } },
      { op: 'meta', path: '/surface-plan', value: hostSearchPlan },
      { op: 'set', path: '/screen', value: { sections: ['main'] } },
      {
        op: 'add',
        path: '/section/main',
        html: '<section><h1>Dinner Finder</h1><button data-summon-intent="search">Search</button></section>',
      },
      {
        op: 'meta',
        path: '/stream-graph-summary',
        value: {
          health: {
            complete: true,
            missingDeclared: [],
            blockedCount: 0,
            skippedCount: 0,
            repairedCount: 0,
          },
          sections: [],
        },
      },
    ]);
    await route.fulfill({ status: 200, contentType: 'text/plain', body });
  });

  await page.goto('/generate.html');
  await page.locator('#scenario').selectOption('host-resource-search');
  await page.locator('#go').click();
  await expect(page.locator('#iframe-status')).toContainText('done');

  expect(captured).toBeTruthy();
  expect(captured.agent).toEqual({ enabled: true });
  expect(captured.surfacePolicy).toBeUndefined();
  expect(captured.surfacePlan).toBeUndefined();
  expect(captured.capabilities.intents.map((intent: any) => intent.name)).toEqual(['search']);
  expect(captured.scriptPolicy).toBe('forbid');
  await expect(page.locator('#contract-summary [data-contract-row="broker"]')).toContainText('default');
  await expect(page.locator('#log')).toContainText('agent policy');
});

test('batch page brokers each generation request', async ({ page }) => {
  const captured: any[] = [];
  await page.route('**/api/generate', async (route) => {
    const request = route.request().postDataJSON();
    captured.push(request);
    const body = jsonl([
      { op: 'meta', path: '/agent-intent', value: { purpose: 'inform', interaction: 'none', dataNeed: 'embedded', sideEffect: 'none', requestedCapabilities: [], requestedComponents: [], confidence: 0.58 } },
      { op: 'meta', path: '/agent-policy-resolution', value: { source: 'default', surfacePolicy: { tier: 'static', purpose: 'inform', persistence: 'replayable' }, rejectedCapabilities: [], rejectedComponents: [], fallback: false } },
      { op: 'set', path: '/screen', value: { sections: ['main'] } },
      { op: 'add', path: '/section/main', html: '<section><h1>Batch brokered</h1></section>' },
    ]);
    await route.fulfill({ status: 200, contentType: 'text/plain', body });
  });

  await page.goto('/batch.html');
  await page.locator('#count').fill('1');
  await page.locator('#run').click();

  await expect(page.locator('#summary')).toContainText('1 ok');
  expect(captured).toHaveLength(1);
  expect(captured[0].agent).toEqual({ enabled: true });
  expect(captured[0].surfacePolicy).toBeUndefined();
  expect(captured[0].surfacePlan).toBeUndefined();
  await expect(page.locator('.tile-intent')).toContainText('agent policy');
});

test('fragment compare launches section and html node streams from the same prompt', async ({ page }) => {
  const captured: any[] = [];
  let releaseBoth!: () => void;
  const bothArrived = new Promise<void>((resolve) => {
    releaseBoth = resolve;
  });

  await page.route('**/api/generate', async (route) => {
    const request = route.request().postDataJSON();
    captured.push(request);
    if (captured.length === 2) releaseBoth();
    await bothArrived;

    const body = request.fragmentMode === 'html-node-v0'
      ? jsonl([
          { op: 'meta', path: '/agent-intent', value: { purpose: 'review', interaction: 'none', dataNeed: 'embedded', sideEffect: 'none', requestedCapabilities: [], requestedComponents: [], confidence: 0.58 } },
          { op: 'meta', path: '/agent-policy-resolution', value: { source: 'default', surfacePolicy: { tier: 'static', purpose: 'review', persistence: 'replayable' }, rejectedCapabilities: [], rejectedComponents: [], fallback: false } },
          { op: 'meta', path: '/experimental-fragments', value: { mode: 'html-node-v0' } },
          { op: 'set', path: '/screen', value: { sections: ['main'] } },
          { op: 'add', path: '/section/main/node/root', html: '<div data-summon-node="root"></div>' },
          { op: 'add', path: '/section/main/node/card', parent: 'root', html: '<article data-summon-node="card"><h1>Node stream</h1><div data-summon-node-children><div data-summon-skeleton></div></div></article>' },
          { op: 'add', path: '/section/main/node/body', parent: 'card', html: '<p data-summon-node="body">Rendered as HTML node patches.</p>' },
        ])
      : jsonl([
          { op: 'meta', path: '/agent-intent', value: { purpose: 'review', interaction: 'none', dataNeed: 'embedded', sideEffect: 'none', requestedCapabilities: [], requestedComponents: [], confidence: 0.58 } },
          { op: 'meta', path: '/agent-policy-resolution', value: { source: 'default', surfacePolicy: { tier: 'static', purpose: 'review', persistence: 'replayable' }, rejectedCapabilities: [], rejectedComponents: [], fallback: false } },
          { op: 'set', path: '/screen', value: { sections: ['main'] } },
          { op: 'add', path: '/section/main', html: '<section><h1>Section stream</h1><p>Rendered as section fragments.</p></section>' },
        ]);
    await route.fulfill({ status: 200, contentType: 'text/plain', body });
  });

  await page.goto('/fragment-compare.html');
  await expect(page.locator('#prompt-preset-matrix')).toContainText('Operational workflows');
  await expect(page.locator('#prompt-preset-matrix')).toContainText('Complex');
  await page.getByRole('button', { name: /Operational workflows, Complex: Migration Control/ }).click();
  const prompt = await page.locator('#prompt').inputValue();
  expect(prompt).toContain('migration control room');
  await page.locator('#run').click();

  await expect.poll(() => captured.length).toBe(2);
  const sectionRequest = captured.find((request) => request.fragmentMode !== 'html-node-v0');
  const nodeRequest = captured.find((request) => request.fragmentMode === 'html-node-v0');
  expect(sectionRequest?.prompt).toBe(prompt);
  expect(nodeRequest?.prompt).toBe(prompt);
  expect(sectionRequest?.agent).toEqual({ enabled: true });
  expect(nodeRequest?.agent).toEqual({ enabled: true });
  expect(sectionRequest?.surfacePlan).toBeUndefined();
  expect(nodeRequest?.surfacePlan).toBeUndefined();
  expect(sectionRequest?.directionId).toBe('');
  expect(nodeRequest?.directionId).toBe('');
  expect(sectionRequest?.modelOptions).toEqual(nodeRequest?.modelOptions);
  expect(sectionRequest?.modelOptions?.anthropicThinking).toBe('off');
  expect(sectionRequest?.fragmentMode).toBeUndefined();
  expect(nodeRequest?.fragmentMode).toBe('html-node-v0');

  await expect(page.locator('#section-status')).toContainText('done');
  await expect(page.locator('#block-status')).toContainText('done');
  await expect(page.frameLocator('#section-frame').locator('body')).toContainText('Section stream');
  await expect(page.frameLocator('#block-frame').locator('body')).toContainText('Node stream');
  await expect(page.locator('#block-metrics')).toContainText('patches');
});

test('generate showcase sends raw SurfacePlan from the advanced override', async ({ page }) => {
  let captured: any = null;
  await page.route('**/api/generate', async (route) => {
    captured = route.request().postDataJSON();
    const surfacePlan = captured.surfacePlan;
    const body = jsonl([
      { op: 'meta', path: '/surface-plan', value: surfacePlan },
      { op: 'meta', path: '/shape', value: 'card' },
      {
        op: 'meta',
        path: '/token-overrides',
        value: {
          applied: [{ token: 'color-accent', value: '#0f8cff' }],
          rejected: [],
        },
      },
      { op: 'set', path: '/screen', value: { sections: ['main'] } },
      {
        op: 'add',
        path: '/section/main',
        html: '<section><form data-summon-on-submit="submit"><input name="title"><button>Save</button></form></section>',
      },
      {
        op: 'meta',
        path: '/repair-summary',
        value: { queued: 0, cancelled: 0, repaired: 0, failed: 0 },
      },
      {
        op: 'meta',
        path: '/stream-graph-summary',
        value: {
          health: {
            complete: true,
            missingDeclared: [],
            blockedCount: 0,
            skippedCount: 0,
            repairedCount: 0,
          },
          sections: [],
        },
      },
    ]);
    await route.fulfill({ status: 200, contentType: 'text/plain', body });
  });

  await page.goto('/generate.html');
  await expect(page.locator('#scenario')).toContainText('Validation Retry Diagnostics');
  await page.locator('#scenario').selectOption('repair-diagnostics');
  await page.locator('#token-preset').selectOption('accent-blue');

  await expect(page.locator('#prompt')).toHaveValue(/onboarding checklist/);
  await expect(page.locator('.scenario-card.active')).toContainText('Validation Retry Diagnostics');
  await expect(page.locator('#repair-enabled')).toBeChecked();
  await expect(page.locator('#custom-contract-panel')).toBeHidden();
  await page.locator('#custom-contract-enabled').check();
  await expect(page.locator('#custom-contract-panel')).toBeVisible();
  await expect(page.locator('#surface-purpose')).toHaveValue('collect');
  await expect(page.locator('#edit-card')).toBeHidden();

  await page.locator('#go').click();
  await expect(page.locator('#iframe-status')).toContainText('done');
  await expect(page.locator('#result-toolbar')).toBeVisible();
  await expect(page.locator('#edit-card')).toBeVisible();
  await expect(page.locator('#contract-summary [data-contract-row="effective"]')).toContainText(
    'collect · declarative',
  );

  expect(captured).toBeTruthy();
  expect(captured.mode).toBe('interactive');
  expect(captured.scriptPolicy).toBe('forbid');
  expect(captured.surfacePolicy).toBeUndefined();
  expect(captured.surfacePlan).toEqual({
    purpose: 'collect',
    runtime: 'declarative',
    data: 'embedded',
    authority: 'host-action',
    persistence: 'replayable',
  });
  expect(captured.capabilities.intents.map((intent: any) => intent.name)).toEqual(['submit']);
  expect(captured.capabilities.intents[0].surface).toEqual({ authority: 'host-action' });
  expect(captured.tokenOverrides).toEqual({
    'color-accent': '#0f8cff',
    'color-accent-fg': '#ffffff',
  });
  expect(captured.repair).toEqual({ enabled: true, maxAttempts: 1, maxTargets: 2 });
});

test('generate loads Ghost root scenario and logs Ghost metadata', async ({ page }) => {
  let captured: any = null;
  await page.route('**/api/directions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'ghost',
          name: 'Ghost',
          description: 'Ghost base tokens',
          tokensCss: ':root { --color-bg: #ffffff; --color-fg: #101010; }',
        },
      ]),
    });
  });
  await page.route('**/api/ghost-roots', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'checkout', defaultTargetPath: '.', defaultBaseDirectionId: 'ghost' },
      ]),
    });
  });
  await page.route('**/api/generate', async (route) => {
    captured = route.request().postDataJSON();
    const body = jsonl([
      {
        op: 'meta',
        path: '/ghost-context',
        value: {
          product: 'Checkout',
          source: 'root',
          targetPath: '.',
          layers: ['checkout'],
          baseDirectionId: 'ghost',
          styleSource: 'ghost-config-token-css',
        },
      },
      {
        op: 'meta',
        path: '/agent-intent',
        value: {
          purpose: 'review',
          interaction: 'select',
          dataNeed: 'embedded',
          sideEffect: 'local-state',
          requestedCapabilities: ['choose'],
          requestedComponents: [],
          confidence: 0.72,
        },
      },
      {
        op: 'meta',
        path: '/agent-policy-resolution',
        value: {
          source: 'default',
          surfacePolicy: {
            tier: 'declarative',
            purpose: 'review',
            grants: ['choose'],
            persistence: 'replayable',
          },
          rejectedCapabilities: [],
          rejectedComponents: [],
          fallback: false,
        },
      },
      { op: 'meta', path: '/surface-policy', value: { tier: 'declarative', purpose: 'review', grants: ['choose'] } },
      { op: 'meta', path: '/surface-plan', value: componentIslandsPlan },
      { op: 'set', path: '/screen', value: { sections: ['main'] } },
      { op: 'add', path: '/section/main', html: '<section><h1>Checkout Review</h1><button data-summon-intent="choose">Accept</button></section>' },
      {
        op: 'meta',
        path: '/ghost-token-source',
        value: {
          kind: 'css',
          source: 'ghost-config-token-css',
          css: ':root { --color-bg: #fafafa; --color-accent: #1a73e8; }',
          baseDirectionId: 'ghost',
          warnings: [],
        },
      },
      {
        op: 'meta',
        path: '/ghost-review-packet',
        value: {
          baseDirectionId: 'ghost',
          styleSource: 'ghost-config-token-css',
          declaredSections: ['main'],
          validation: { blocked: 0, warnings: 0 },
        },
      },
      {
        op: 'meta',
        path: '/stream-graph-summary',
        value: {
          health: {
            complete: true,
            missingDeclared: [],
            blockedCount: 0,
            skippedCount: 0,
            repairedCount: 0,
          },
          sections: [],
        },
      },
    ]);
    await route.fulfill({ status: 200, contentType: 'text/plain', body });
  });

  await page.goto('/generate.html');
  await expect(page.locator('#scenario')).toContainText('Ghost steer: checkout');
  await page.locator('#scenario').selectOption('ghost-checkout');
  await page.locator('#go').click();

  await expect(page.locator('#iframe-status')).toContainText('done');
  await expect(page.locator('#log')).toContainText('ghost context');
  await expect(page.locator('#log')).toContainText('Checkout Review');
  await expect(page.locator('#log')).toContainText('ghost review packet');

  expect(captured).toBeTruthy();
  expect(captured.ghost).toEqual({
    rootId: 'checkout',
    targetPath: '.',
    baseDirectionId: 'ghost',
  });
  expect(captured.directionId).toBeUndefined();
  expect(captured.agent).toEqual({ enabled: true });
  expect(captured.surfacePolicy).toBeUndefined();
  expect(captured.surfacePlan).toBeUndefined();
  expect(captured.capabilities.intents.map((intent: any) => intent.name)).toEqual(['choose']);
});

test('component islands render in host overlay without widening the sandbox', async ({ page }) => {
  let captured: any = null;
  await page.route('**/api/generate', async (route) => {
    captured = route.request().postDataJSON();
    const html = `
      <section style="padding:24px;min-height:900px;">
        <div
          data-summon-component="MetricCard"
          data-summon-component-id="launch-score"
          data-summon-props='{"label":"Launch score","value":"84","delta":"+6 pts","tone":"good"}'
          style="margin-top:160px;width:240px;height:112px;"
        ></div>
        <p id="sandbox-proof">Sandbox placeholder only</p>
      </section>`;
    const body = jsonl([
      {
        op: 'meta',
        path: '/agent-intent',
        value: {
          purpose: 'review',
          interaction: 'select',
          dataNeed: 'embedded',
          sideEffect: 'local-state',
          requestedCapabilities: ['choose'],
          requestedComponents: ['MetricCard', 'TrendSparkline', 'ApprovalStatus'],
          confidence: 0.72,
        },
      },
      {
        op: 'meta',
        path: '/agent-policy-resolution',
        value: {
          source: 'default',
          surfacePolicy: componentIslandsPolicy,
          rejectedCapabilities: [],
          rejectedComponents: [],
          fallback: false,
        },
      },
      { op: 'meta', path: '/surface-plan', value: componentIslandsPlan },
      { op: 'set', path: '/screen', value: { sections: ['main'] } },
      { op: 'add', path: '/section/main', html },
      {
        op: 'meta',
        path: '/stream-graph-summary',
        value: {
          health: {
            complete: true,
            missingDeclared: [],
            blockedCount: 0,
            skippedCount: 0,
            repairedCount: 0,
          },
          sections: [],
        },
      },
    ]);
    await route.fulfill({ status: 200, contentType: 'text/plain', body });
  });

  await page.goto('/generate.html');
  await page.locator('#scenario').selectOption('component-islands');
  await page.locator('#go').click();

  const hostIsland = page.locator('[data-summon-component-id="launch-score"]');
  await expect(hostIsland).toContainText('Launch score');
  await expect(hostIsland).toContainText('84');
  await expect(page.locator('#sandbox')).toHaveAttribute('sandbox', 'allow-scripts');

  expect(captured.components.components.map((component: any) => component.name)).toEqual([
    'MetricCard',
    'TrendSparkline',
    'ApprovalStatus',
  ]);
  expect(captured.agent).toEqual({ enabled: true });
  expect(captured.surfacePolicy).toBeUndefined();
  expect(captured.surfacePlan).toBeUndefined();
  expect(captured.scriptPolicy).toBe('forbid');

  const sandbox = page.frameLocator('#sandbox');
  await expect(sandbox.locator('[data-summon-component-id="launch-score"]')).not.toContainText('84');

  const iframe = await page.locator('#sandbox').elementHandle();
  const frame = await iframe?.contentFrame();
  expect(frame).toBeTruthy();
  const beforeScroll = await hostIsland.boundingBox();
  expect(beforeScroll).toBeTruthy();
  await frame!.evaluate(() => window.scrollTo(0, 80));
  await expect.poll(async () => (await hostIsland.boundingBox())?.y ?? 0).toBeLessThan(beforeScroll!.y - 40);

  await frame!.evaluate(() => {
    const el = document.querySelector<HTMLElement>('[data-summon-component-id="launch-score"]');
    if (el) el.style.height = '150px';
  });
  await expect.poll(async () => (await hostIsland.boundingBox())?.height ?? 0).toBeGreaterThan(130);

  await page.evaluate(() => {
    window.postMessage({
      type: 'SUMMON_COMPONENTS',
      sandbox_id: 'forged',
      components: [{
        id: 'forged-card',
        name: 'MetricCard',
        props: { label: 'Forged', value: '999' },
        bounds: { x: 0, y: 0, width: 120, height: 80 },
      }],
    }, '*');
  });
  await expect(page.locator('[data-summon-component-id="forged-card"]')).toHaveCount(0);
});

test('component island prop failures do not render host DOM and emit diagnostics', async ({ page }) => {
  await page.route('**/api/generate', async (route) => {
    const captured = route.request().postDataJSON();
    const html = `
      <section style="padding:24px;">
        <div
          data-summon-component="MetricCard"
          data-summon-component-id="bad-props"
          data-summon-props='{"label":42,"value":"84"}'
          style="width:240px;height:112px;"
        ></div>
      </section>`;
    const body = jsonl([
      { op: 'meta', path: '/surface-plan', value: componentIslandsPlan },
      { op: 'set', path: '/screen', value: { sections: ['main'] } },
      { op: 'add', path: '/section/main', html },
      {
        op: 'meta',
        path: '/stream-graph-summary',
        value: {
          health: {
            complete: true,
            missingDeclared: [],
            blockedCount: 0,
            skippedCount: 0,
            repairedCount: 0,
          },
          sections: [],
        },
      },
    ]);
    await route.fulfill({ status: 200, contentType: 'text/plain', body });
  });

  await page.goto('/generate.html');
  await page.locator('#scenario').selectOption('component-islands');
  await page.locator('#go').click();

  await expect(page.locator('[data-summon-component-id="bad-props"]')).toHaveCount(0);
  await expect(page.locator('#devtools-log')).toContainText('component-error');
  await expect(page.locator('#devtools-log')).toContainText('props-invalid');
});
