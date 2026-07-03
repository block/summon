import { createServer, type Server, type ServerResponse } from 'node:http';
import { expect, test, type Page } from '@playwright/test';

const galleryApiPort = Number(process.env.SUMMON_GALLERY_API_PORT ?? 3015);

function streamBody(lines: unknown[]): string {
  return `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`;
}

function surfaceDocumentArtifact(source: { html: string; css?: string; js?: string }): object {
  return {
    op: 'artifact',
    path: '/artifact',
    value: {
      runtime: 'surface-document',
      source: {
        'main.html': source.html,
        'main.css': source.css ?? 'main, section, article { color: var(--color-text, #111); }',
        ...(source.js ? { 'main.js': source.js } : {}),
      },
    },
  };
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
        modelOptions: { maxOutputTokens: 64000 },
      },
      controls: {
        customModels: true,
        maxOutputTokens: { default: 64000, presets: [12000, 64000] },
      },
    }],
  };
}

function fingerprintPayload(): object {
  return [{
    id: 'editorial-mono',
    name: 'Editorial Mono',
    summary: 'Default catalog fingerprint for smoke tests.',
    defaultTargetPath: '.',
  }];
}

async function routeCatalogFingerprints(page: Page): Promise<void> {
  await page.route('**/api/fingerprints', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fingerprintPayload()),
    });
  });
}

test.beforeEach(async ({ page }) => {
  await routeCatalogFingerprints(page);
});

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

    if (req.method === 'GET' && req.url === '/api/fingerprints') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(fingerprintPayload()));
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
      writeProtocolLine(res, { op: 'event', path: '/surface', value: { type: 'surface.start', id: 'preview', kind: 'dashboard', title: 'Drafting surface' } });
      writeProtocolLine(res, { op: 'event', path: '/surface', value: { type: 'surface.status', status: 'drafting', text: 'Gathering the shape.' } });
      writeProtocolLine(res, { op: 'event', path: '/surface', value: { type: 'region.add', id: 'summary', parent: 'preview', role: 'summary', label: 'Drafting surface' } });
      writeProtocolLine(res, { op: 'event', path: '/surface', value: { type: 'node.add', id: 'shape', parent: 'summary', kind: 'text', props: { text: 'Gathering the shape.' } } });
      writeProtocolLine(res, { op: 'event', path: '/surface', value: { type: 'surface.finalize', artifactExpected: true } });
      await delay(900);
      writeProtocolLine(res, surfaceDocumentArtifact({
        html: '<article class="final"><h1>Final answer</h1><p>Ready to inspect.</p></article>',
        css: '.final { padding: 24px; font-family: system-ui; }',
      }));
      writeProtocolLine(res, {
        op: 'meta',
        path: '/stream-graph-summary',
        value: {
          health: {
            complete: true,
            blockedCount: 0,
            warningCount: 0,
          },
          artifacts: [{ revision: 1, runtime: 'surface-document', bytes: 1 }],
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

  await expect(page.locator('[data-preset-id]')).toHaveCount(7);
  await expect(page.locator('#preset-title')).toContainText('Rich brief, zero authority');
  await expect(page.locator('[data-contract-row="policy"]')).toContainText('Surface config');
  await expect(page.locator('[data-contract-row="policy"]')).toContainText('static');

  await page.locator('[data-preset-id="host-resource-search"]').click();
  await expect(page.locator('#preset-title')).toContainText('Host data, no sandbox network');
  await expect(page.locator('#prompt')).toHaveValue(/payouts look wrong/);
  await expect(page.locator('[data-contract-row="tier"]')).toContainText('Surface type');
  await expect(page.locator('[data-contract-row="tier"]')).toContainText('declarative');
  await expect(page.locator('[data-contract-row="grants"]')).toContainText('Allowed host tools');
  await expect(page.locator('[data-contract-row="grants"]')).toContainText('search');
  await expect(page.locator('[data-contract-row="fingerprint"]')).toContainText('Editorial Mono');
});

test('gallery shows progressive placeholder before final stream replacement', async ({ page }) => {
  const server = await startProgressiveApiServer();
  try {
    await page.goto('/');
    await page.locator('#run').click();

    await expect(page.locator('#welcome-kicker')).toHaveText(/streaming|writing/i);
    await expect(page.locator('#welcome-detail')).toContainText('sandbox updates as validated structure arrives');

    await expect(page.locator('#accepted-count')).toContainText(/[1-6]/);
    const surface = page.locator('#sandbox .summon-surface-document-host');
    await expect(surface.locator('h1')).toContainText('Final answer');
    const preview = page.locator('#sandbox [data-summon-preview-root]');
    await expect(preview).toHaveCount(0);
    await expect(page.locator('#accepted-count')).toContainText('6');
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
            runtime: 'arrow',
            data: 'embedded',
            authority: 'host-action',
            persistence: 'replayable',
          },
        },
        { op: 'meta', path: '/status', value: 'writing' },
        surfaceDocumentArtifact({
          html: [
            '<article class="picker">',
            '<h1>Pick a launch path</h1>',
            '<button id="save-choice">Save Balanced path</button>',
            '<p id="saving" hidden>Saving...</p>',
            '<p id="save-error" hidden></p>',
            '<p id="saved" hidden>Saved.</p>',
            '<p id="last-choice" hidden>Saved <span id="last-choice-value"></span></p>',
            '</article>',
          ].join(''),
          css: '.picker { padding: 24px; font-family: system-ui; }',
          js: [
            "const s = state({ saving: false, saved: false, error: '', lastChoice: '' });",
            "document.getElementById('saving').hidden = () => !s.saving;",
            "document.getElementById('save-error').hidden = () => !s.error;",
            "document.getElementById('save-error').textContent = () => s.error;",
            "document.getElementById('saved').hidden = () => !s.saved;",
            "document.getElementById('last-choice').hidden = () => !s.lastChoice;",
            "document.getElementById('last-choice-value').textContent = () => s.lastChoice;",
            "document.getElementById('save-choice').onclick = async () => {",
            "  s.saving = true; s.saved = false; s.error = '';",
            "  const result = await callTool('choose', { option: 'Balanced path' });",
            "  s.saving = false;",
            "  if (result.ok) {",
            "    const next = result.state || {};",
            "    s.saved = true;",
            "    s.lastChoice = String(next.lastChoice || 'Balanced path');",
            "  } else {",
            "    s.error = result.error || 'Save failed';",
            "  }",
            "};",
          ].join('\n'),
        }),
        {
          op: 'meta',
          path: '/stream-graph-summary',
          value: {
            health: {
              complete: true,
              blockedCount: 0,
              warningCount: 0,
            },
            artifacts: [{ revision: 1, runtime: 'surface-document', bytes: 1 }],
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
  expect(captured.fingerprint).toEqual({
    id: 'editorial-mono',
    targetPath: '.',
  });
  expect(captured.directionId).toBeUndefined();
  expect(captured.tools.tools.map((tool: any) => tool.name)).toEqual([
    'search',
    'choose',
    'publish_summary',
    'issue_refund',
    'analysis',
    'compute_score',
  ]);
  expect(captured.components).toBeUndefined();

  const surface = page.locator('#sandbox .summon-surface-document-host');
  await surface.locator('button').click();
  await expect(surface.locator('#saved')).toBeVisible();
  await expect(page.locator('#state-preview')).toContainText('Balanced path');
  await expect(page.locator('#state-preview')).toContainText('chooseDone');
  await expect(page.locator('#event-log')).toContainText('host settled choose ok');
});

test('host search resource renders host-owned empty state', async ({ page }) => {
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
  await page.route('**/api/mock-search', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [] }),
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
            purpose: 'explore',
            runtime: 'arrow',
            data: 'host-resource',
            authority: 'read',
            persistence: 'replayable',
          },
        },
        surfaceDocumentArtifact({
          html: [
            '<section class="search">',
            '<h1>Recipe search</h1>',
            '<form id="search-form"><input name="query" value="zzzzzz"><button>Search</button></form>',
            '<p id="loading" style="display:none">Searching...</p>',
            '<p id="error" style="display:none"></p>',
            '<p id="empty" style="display:none">No recipes found.</p>',
            '</section>',
          ].join(''),
          css: '.search { padding: 24px; font-family: system-ui; }',
          js: [
            "const s = state({ loading: false, empty: false, error: '' });",
            "document.getElementById('loading').setAttribute('style', () => s.loading ? '' : 'display:none');",
            "document.getElementById('error').setAttribute('style', () => s.error ? '' : 'display:none');",
            "document.getElementById('error').textContent = () => s.error;",
            "document.getElementById('empty').setAttribute('style', () => s.empty ? '' : 'display:none');",
            "document.getElementById('search-form').addEventListener('submit', async () => {",
            "  s.loading = true; s.empty = false; s.error = '';",
            "  const result = await callTool('search', { query: 'zzzzzz' });",
            "  s.loading = false;",
            "  if (result.ok) {",
            "    const next = result.state || {};",
            "    s.empty = Boolean(next.noResults);",
            "  } else {",
            "    s.error = result.error || 'Search failed';",
            "  }",
            "});",
          ].join('\n'),
        }),
        {
          op: 'meta',
          path: '/stream-graph-summary',
          value: {
            health: {
              complete: true,
              blockedCount: 0,
              warningCount: 0,
            },
            artifacts: [{ revision: 1, runtime: 'surface-document', bytes: 1 }],
          },
        },
      ]),
    });
  });

  await page.goto('/');
  await page.locator('[data-preset-id="host-resource-search"]').click();
  await page.locator('#run').click();
  await expect(page.locator('#status')).toContainText('done');

  expect(captured.surfacePolicy).toEqual({
    tier: 'declarative',
    purpose: 'explore',
    grants: ['search'],
  });
  expect(captured.fingerprint).toEqual({
    id: 'editorial-mono',
    targetPath: '.',
  });
  expect(captured.directionId).toBeUndefined();

  const surface = page.locator('#sandbox .summon-surface-document-host');
  await expect(surface.locator('#empty')).toBeHidden();
  await surface.locator('form').evaluate((form) => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await expect(surface.locator('#empty')).toBeVisible();
  await expect(page.locator('#state-preview')).toContainText('noResults');
});

test('approval refund uses host-owned approval card for approve and deny decisions', async ({ page }) => {
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
            purpose: 'operate',
            runtime: 'arrow',
            data: 'embedded',
            authority: 'approval-gated',
            persistence: 'ephemeral',
          },
        },
        surfaceDocumentArtifact({
          html: [
            '<article class="refund">',
            '<h1>Refund review</h1>',
            '<button id="request-refund">Request refund</button>',
            '<p id="waiting" style="display:none">Waiting for host approval</p>',
            '<p id="approved" style="display:none">Approved</p>',
            '<p id="denied" style="display:none">Denied</p>',
            '<p id="failed" style="display:none"></p>',
            '<p id="refunded" style="display:none">Refunded <span id="refund-amount"></span></p>',
            '</article>',
          ].join(''),
          css: '.refund { padding: 24px; font-family: system-ui; }',
          js: [
            "const s = state({ waiting: false, approved: false, denied: false, failed: '', refunded: false, amount: '' });",
            "document.getElementById('waiting').setAttribute('style', () => s.waiting ? '' : 'display:none');",
            "document.getElementById('approved').setAttribute('style', () => s.approved ? '' : 'display:none');",
            "document.getElementById('denied').setAttribute('style', () => s.denied ? '' : 'display:none');",
            "document.getElementById('failed').setAttribute('style', () => s.failed ? '' : 'display:none');",
            "document.getElementById('failed').textContent = () => s.failed;",
            "document.getElementById('refunded').setAttribute('style', () => s.refunded ? '' : 'display:none');",
            "document.getElementById('refund-amount').textContent = () => s.amount;",
            "document.getElementById('request-refund').onclick = async () => {",
            "  s.waiting = true; s.approved = false; s.denied = false; s.failed = ''; s.refunded = false; s.amount = '';",
            "  const result = await callTool('issue_refund', { title: 'Approval smoke', amount: '$842.15' });",
            "  const next = result.state || {};",
            "  s.waiting = false;",
            "  s.approved = Boolean(next.refundApprovalApproved);",
            "  s.denied = Boolean(next.refundApprovalDenied);",
            "  s.refunded = Boolean(next.refundIssued);",
            "  s.amount = String(next.refundAmount || '');",
            "  if (!result.ok && !s.denied) s.failed = result.error || 'Refund failed';",
            "};",
          ].join('\n'),
        }),
        {
          op: 'meta',
          path: '/stream-graph-summary',
          value: {
            health: {
              complete: true,
              blockedCount: 0,
              warningCount: 0,
            },
            artifacts: [{ revision: 1, runtime: 'surface-document', bytes: 1 }],
          },
        },
      ]),
    });
  });

  await page.goto('/');
  await page.locator('[data-preset-id="approval-refund"]').click();
  await page.locator('#run').click();
  await expect(page.locator('#status')).toContainText('done');

  expect(captured.surfacePolicy).toEqual({
    tier: 'approval',
    purpose: 'operate',
    grants: ['issue_refund'],
  });

  const surface = page.locator('#sandbox .summon-surface-document-host');
  const requestRefund = async () => {
    await surface.getByRole('button', { name: 'Request refund' }).evaluate((button) => {
      (button as HTMLButtonElement).click();
    });
  };
  await requestRefund();
  await expect(page.locator('[data-approval-card]')).toContainText('Issue refund: Approval smoke');
  await expect(page.locator('[data-approval-card]')).toContainText('card-presentment');
  await expect(surface.locator('#waiting')).toBeVisible();
  await expect(page.locator('#state-preview')).toContainText('issue_refund');

  await page.locator('[data-approval-card]').getByRole('button', { name: 'Approve' }).click();
  await expect(page.locator('[data-approval-card]')).toHaveCount(0);
  await expect(surface.locator('#approved')).toBeVisible();
  await expect(surface.locator('#refunded')).toContainText('$842.15');

  await page.locator('#run').click();
  await expect(page.locator('#status')).toContainText('done');
  await requestRefund();
  await expect(page.locator('[data-approval-card]')).toContainText('Issue refund: Approval smoke');
  await page.locator('[data-approval-card]').getByRole('button', { name: 'Deny' }).click();
  await expect(page.locator('[data-approval-card]')).toHaveCount(0);
  await expect(surface.locator('#denied')).toBeVisible();
  await expect(surface.locator('#refunded')).toBeHidden();
});

test('Arrow fidelity preset renders generated visuals without component grants', async ({ page }) => {
  const requests: any[] = [];

  await page.route('**/api/generate', async (route) => {
    const captured = route.request().postDataJSON();
    requests.push(captured);

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
            runtime: 'arrow',
            data: 'embedded',
            authority: 'host-action',
            persistence: 'replayable',
          },
        },
        surfaceDocumentArtifact({
          html: [
            '<section class="readiness">',
            '<h1>Launch readiness</h1>',
            '<article id="launch-score"><strong>Launch score</strong><p>84</p><small>+6 pts</small></article>',
            '<article id="quality-trend"><strong>Quality trend</strong><p>62 -> 67 -> 71 -> 76 -> 82 -> 84</p><small>Six-week readiness climb</small></article>',
            '</section>',
          ].join(''),
          css: '.readiness { padding: 24px; display: grid; gap: 16px; font-family: system-ui; }',
        }),
        {
          op: 'meta',
          path: '/stream-graph-summary',
          value: {
            health: {
              complete: true,
              blockedCount: 0,
              warningCount: 0,
            },
            artifacts: [{ revision: 1, runtime: 'surface-document', bytes: 1 }],
          },
        },
      ]),
    });
  });

  await page.goto('/');
  await page.locator('[data-preset-id="arrow-fidelity"]').click();
  await page.locator('#run').click();
  const surface = page.locator('#sandbox .summon-surface-document-host');
  await expect(surface.locator('#launch-score')).toContainText('Launch score');
  await expect(surface.locator('#quality-trend')).toContainText('Quality trend');
  expect(requests[0].components).toBeUndefined();
  expect(requests[0].fingerprint).toEqual({
    id: 'editorial-mono',
    targetPath: '.',
  });
  expect(requests[0].directionId).toBeUndefined();
  await expect(page.locator('#event-log')).toContainText('rendered');
});

test('gallery loads Ghost root preset and sends Ghost generation payload', async ({ page }) => {
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
      body: JSON.stringify([{
        id: 'checkout',
        defaultTargetPath: '.',
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
            product: 'checkout',
            surface: 'core',
            gatheredNodes: ['core'],
            styleSource: 'ghost-config',
          },
        },
        {
          op: 'meta',
          path: '/ghost-token-source',
          value: {
            kind: 'ghost-config',
            source: 'fingerprint:core',
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
            runtime: 'arrow',
            data: 'embedded',
            authority: 'host-action',
            persistence: 'replayable',
          },
        },
        surfaceDocumentArtifact({ html: '<section><h1>Checkout Review</h1></section>' }),
        {
          op: 'meta',
          path: '/ghost-receipt',
          value: {
            schema: 'summon.ghost-receipt/v1',
            fingerprint: {
              source: 'root',
              id: 'checkout',
              product: 'checkout',
              surface: 'core',
              cascade: ['core'],
              gatheredNodes: [{ id: 'core', provenance: 'own' }],
              tokenSource: { kind: 'ghost-config', source: 'fingerprint:core', definedTokenCount: 0, warnings: [] },
              routedChecks: [{ name: 'token-contrast', severity: 'medium' }],
            },
            capability: { mode: 'static', grantedTools: [], layoutId: null },
            generation: {
              runtime: 'surface-document',
              artifactRuntime: 'surface-document',
              artifactFiles: ['main.css', 'main.html'],
              repairs: 0,
              blocked: false,
              validation: { blocked: 0, warnings: 0, codes: {} },
              safetyViolations: [],
            },
            conformance: {
              evaluated: true,
              summary: { pass: 1, fail: 0, inconclusive: 0, failedHigh: 0, failedMedium: 0, failedLow: 0 },
              checks: [{ name: 'token-contrast', severity: 'medium', verdict: 'pass', reason: 'ok' }],
            },
          },
        },
        {
          op: 'meta',
          path: '/stream-graph-summary',
          value: {
            health: {
              complete: true,
              blockedCount: 0,
              warningCount: 0,
            },
            artifacts: [{ revision: 1, runtime: 'surface-document', bytes: 1 }],
          },
        },
      ]),
    });
  });

  await page.goto('/');
  await expect(page.locator('[data-preset-id="ghost-checkout"]')).toContainText('Ghost steer: checkout');
  await page.locator('[data-preset-id="ghost-checkout"]').click();
  await page.locator('#run').click();
  await expect(page.locator('#sandbox .summon-surface-document-host h1')).toContainText('Checkout Review');

  expect(captured.ghost).toEqual({
    rootId: 'checkout',
    targetPath: '.',
  });
  expect(captured.surfacePolicy).toEqual({
    tier: 'declarative',
    purpose: 'review',
    grants: ['choose'],
  });

  // Node-graph provenance + conformance readout from /ghost-receipt.
  const eventLog = page.locator('#event-log');
  await expect(eventLog).toContainText('ghost cascade core');
  await expect(eventLog).toContainText('ghost nodes core(own)');
  await expect(eventLog).toContainText('ghost tokens ghost-config · fingerprint:core');
  await expect(eventLog).toContainText('ghost conformance pass=1 fail=0 inconclusive=0');
  await expect(eventLog).toContainText('conformance token-contrast [medium] pass');
});
