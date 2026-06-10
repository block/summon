import { createServer, type Server, type ServerResponse } from 'node:http';
import { expect, test } from '@playwright/test';

const galleryApiPort = Number(process.env.SUMMON_GALLERY_API_PORT ?? 3015);

function streamBody(lines: unknown[]): string {
  return `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`;
}

function modelProviderPayload(): object {
  return {
    defaultProvider: 'anthropic',
    providers: [{
      id: 'anthropic',
      name: 'Anthropic',
      configured: true,
      model: 'claude-sonnet-4-6',
      utilityModel: 'claude-haiku-4-5',
      models: [
        { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', status: 'stable', tier: 'balanced', maxOutputTokens: 64000 },
        { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', status: 'stable', tier: 'fast', maxOutputTokens: 64000 },
      ],
      utilityModels: [
        { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', status: 'stable', tier: 'fast', maxOutputTokens: 64000 },
      ],
      defaults: {
        generationModel: 'claude-sonnet-4-6',
        utilityModel: 'claude-haiku-4-5',
        modelOptions: { maxOutputTokens: 64000, repairMaxOutputTokens: 12000 },
      },
      controls: {
        customModels: true,
        maxOutputTokens: { default: 64000, presets: [12000, 64000] },
        repairMaxOutputTokens: { default: 12000, presets: [4000, 12000] },
      },
    }],
  };
}

function writeProtocolLine(res: ServerResponse, line: unknown): void {
  res.write(`${JSON.stringify(line)}\n`);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function startProgressiveApiServer(): Promise<Server> {
  const server = createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/api/model-providers') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(modelProviderPayload()));
      return;
    }

    if (req.method === 'GET' && req.url === '/api/ghost-roots') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('[]');
      return;
    }

    if (req.method === 'POST' && req.url === '/api/generate') {
      for await (const _chunk of req) {
        // Drain request body before streaming a response.
      }
      res.writeHead(200, {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
      });
      await delay(180);
      writeProtocolLine(res, { op: 'meta', path: '/status', value: 'writing' });
      await delay(250);
      writeProtocolLine(res, { op: 'set', path: '/screen', value: { sections: ['main'] } });
      writeProtocolLine(res, {
        op: 'add',
        path: '/section/main',
        html: '<article style="padding:24px;font-family:system-ui;"><h1>Drafting surface</h1><p>Gathering the shape.</p></article>',
      });
      await delay(900);
      writeProtocolLine(res, {
        op: 'add',
        path: '/section/main',
        html: '<article style="padding:24px;font-family:system-ui;"><h1>Final answer</h1><p>Ready to inspect.</p></article>',
      });
      writeProtocolLine(res, {
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
      });
      res.end();
      return;
    }

    res.writeHead(404);
    res.end('not found');
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(galleryApiPort, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  return server;
}

test('gallery boots and preset selection updates the contract panel', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('[data-preset-id]')).toHaveCount(6);
  await expect(page.locator('#preset-title')).toContainText('Static summary');
  await expect(page.locator('[data-contract-row="policy"]')).toContainText('Surface config');
  await expect(page.locator('[data-contract-row="policy"]')).toContainText('static');

  await page.locator('[data-preset-id="host-resource-search"]').click();
  await expect(page.locator('#preset-title')).toContainText('Host Data Search');
  await expect(page.locator('#prompt')).toHaveValue(/weeknight dinner explorer/);
  await expect(page.locator('[data-contract-row="tier"]')).toContainText('Surface type');
  await expect(page.locator('[data-contract-row="tier"]')).toContainText('declarative');
  await expect(page.locator('[data-contract-row="grants"]')).toContainText('Allowed host tools');
  await expect(page.locator('[data-contract-row="grants"]')).toContainText('search');
});

test('gallery shows progressive placeholder before final stream replacement', async ({ page }) => {
  const server = await startProgressiveApiServer();
  try {
    await page.goto('/');
    await page.locator('#run').click();

    await expect(page.locator('.welcome-kicker')).toHaveText(/Streaming|Writing/);
    await expect(page.locator('#welcome-detail')).toContainText('Waiting for validated surface lines');

    const frame = page.frameLocator('#sandbox');
    await expect(frame.locator('h1')).toContainText('Drafting surface');
    await expect(page.locator('#accepted-count')).toContainText('2');
    await expect(frame.locator('h1')).toContainText('Final answer');
    await expect(frame.locator('text=Drafting surface')).toHaveCount(0);
    await expect(page.locator('#accepted-count')).toContainText('3');
    await expect(page.locator('#status')).toContainText('done');
    await expect(page.locator('#tab-contract')).toHaveAttribute('aria-selected', 'true');
  } finally {
    await closeServer(server);
  }
});

test('mocked generation renders and generated host tool requests update host state', async ({ page }) => {
  let captured: any = null;
  await page.route('**/api/model-providers', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(modelProviderPayload()),
    });
  });
  await page.route('**/api/ghost-roots', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
    });
  });
  await page.route('**/api/generate', async (route) => {
    captured = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: streamBody([
        { op: 'meta', path: '/surface-policy', value: captured.surfacePolicy },
        {
          op: 'meta',
          path: '/surface-plan',
          value: {
            purpose: 'compare',
            runtime: 'declarative',
            data: 'embedded',
            authority: 'host-action',
            persistence: 'replayable',
          },
        },
        { op: 'meta', path: '/status', value: 'writing' },
        { op: 'set', path: '/screen', value: { sections: ['main'] } },
        {
          op: 'add',
          path: '/section/main',
          html: `
            <article style="padding:24px;font-family:system-ui;">
              <h1>Pick a launch path</h1>
              <button data-summon-on-click="choose" data-summon-args='{"option":"Balanced path"}'>Save Balanced path</button>
              <p data-summon-show="lastChoice">Saved <span data-summon-bind="lastChoice"></span></p>
            </article>`,
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
      ]),
    });
  });

  await page.goto('/');
  await page.locator('#generation-model').selectOption('claude-haiku-4-5');
  await page.locator('[data-preset-id="decision-picker"]').click();
  await page.locator('#run').click();
  await expect(page.locator('#status')).toContainText('done');

  expect(captured.modelProvider).toBe('anthropic');
  expect(captured.generationModel).toBe('claude-haiku-4-5');
  expect(captured.utilityModel).toBe('claude-haiku-4-5');
  expect(captured.surfacePolicy).toEqual({
    tier: 'declarative',
    purpose: 'compare',
    grants: ['choose'],
  });
  expect(captured.capabilities.intents.map((intent: any) => intent.name)).toEqual([
    'search',
    'choose',
    'publish_summary',
    'analysis',
    'compute_score',
  ]);
  expect(captured.components).toBeUndefined();

  const frame = page.frameLocator('#sandbox');
  await frame.locator('button').click();
  await expect(page.locator('#state-preview')).toContainText('Balanced path');
  await expect(page.locator('#event-log')).toContainText('host tool choose');
});

test('component island preset renders host overlays and reports invalid props', async ({ page }) => {
  let invalid = false;
  const requests: any[] = [];

  await page.route('**/api/generate', async (route) => {
    const captured = route.request().postDataJSON();
    requests.push(captured);
    const html = invalid
      ? `<section style="padding:24px;">
          <div data-summon-component="MetricCard" data-summon-component-id="bad-props" data-summon-props='{"label":42,"value":"84"}' style="width:220px;height:112px;"></div>
        </section>`
      : `<section style="padding:24px;display:grid;gap:16px;">
          <div data-summon-component="MetricCard" data-summon-component-id="launch-score" data-summon-props='{"label":"Launch score","value":"84","delta":"+6 pts","tone":"good"}' style="width:220px;height:112px;"></div>
          <div data-summon-component="TrendSparkline" data-summon-component-id="quality-trend" data-summon-props='{"label":"Quality trend","points":[62,67,71,76,82,84],"caption":"Six-week readiness climb"}' style="width:260px;height:132px;"></div>
        </section>`;

    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: streamBody([
        { op: 'meta', path: '/surface-policy', value: captured.surfacePolicy },
        {
          op: 'meta',
          path: '/surface-plan',
          value: {
            purpose: 'review',
            runtime: 'declarative',
            data: 'embedded',
            authority: 'host-action',
            persistence: 'replayable',
          },
        },
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
      ]),
    });
  });

  await page.goto('/');
  await page.locator('[data-preset-id="component-islands"]').click();
  await page.locator('#run').click();
  await expect(page.locator('[data-summon-component-id="launch-score"]')).toContainText('Launch score');
  await expect(page.locator('[data-summon-component-id="quality-trend"]')).toContainText('Quality trend');

  expect(requests[0].components.components.map((component: any) => component.name)).toEqual([
    'MetricCard',
    'TrendSparkline',
    'ApprovalStatus',
  ]);

  invalid = true;
  await page.locator('#run').click();
  await expect(page.locator('[data-summon-component-id="bad-props"]')).toHaveCount(0);
  await expect(page.locator('#event-log')).toContainText('component props-invalid');
});

test('gallery loads Ghost root preset and sends Ghost generation payload', async ({ page }) => {
  let captured: any = null;
  await page.route('**/api/ghost-roots', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        id: 'checkout',
        defaultTargetPath: '.',
        defaultBaseDirectionId: 'ghost',
      }]),
    });
  });
  await page.route('**/api/generate', async (route) => {
    captured = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: streamBody([
        {
          op: 'meta',
          path: '/ghost-context',
          value: {
            source: 'root',
            rootId: 'checkout',
            product: 'Checkout',
            targetPath: '.',
            layers: ['.'],
          },
        },
        {
          op: 'meta',
          path: '/ghost-token-source',
          value: {
            kind: 'base-direction',
            source: 'direction:ghost/tokens.css',
            css: ':root { --color-bg: #ffffff; --color-text: #111111; }',
            warnings: [],
          },
        },
        { op: 'meta', path: '/surface-policy', value: captured.surfacePolicy },
        {
          op: 'meta',
          path: '/surface-plan',
          value: {
            purpose: 'review',
            runtime: 'declarative',
            data: 'embedded',
            authority: 'host-action',
            persistence: 'replayable',
          },
        },
        { op: 'set', path: '/screen', value: { sections: ['main'] } },
        { op: 'add', path: '/section/main', html: '<section><h1>Checkout Review</h1></section>' },
        {
          op: 'meta',
          path: '/ghost-review-packet',
          value: {
            source: 'root',
            product: 'Checkout',
            sections: [{ id: 'main', html: '<section><h1>Checkout Review</h1></section>' }],
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
      ]),
    });
  });

  await page.goto('/');
  await expect(page.locator('[data-preset-id="ghost-checkout"]')).toContainText('Ghost steer: checkout');
  await page.locator('[data-preset-id="ghost-checkout"]').click();
  await page.locator('#run').click();
  await expect(page.frameLocator('#sandbox').locator('h1')).toContainText('Checkout Review');

  expect(captured.ghost).toEqual({
    rootId: 'checkout',
    targetPath: '.',
    baseDirectionId: 'ghost',
  });
  expect(captured.surfacePolicy).toEqual({
    tier: 'declarative',
    purpose: 'review',
    grants: ['choose'],
  });
});
