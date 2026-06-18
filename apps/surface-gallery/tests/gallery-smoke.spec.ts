import { createServer, type Server, type ServerResponse } from 'node:http';
import { expect, test } from '@playwright/test';

const galleryApiPort = Number(process.env.SUMMON_GALLERY_API_PORT ?? 3015);

function streamBody(lines: unknown[]): string {
  return `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`;
}

function arrowArtifact(source: string): object {
  return {
    op: 'artifact',
    path: '/artifact',
    value: {
      runtime: 'arrow',
      source: {
        'main.ts': source,
      },
    },
  };
}

function arrowHtmlArtifact(html: string): object {
  const source = html.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  return arrowArtifact(`import { html } from "@arrow-js/core";\nexport default html\`${source}\`;`);
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
      writeProtocolLine(res, { op: 'event', path: '/surface', value: { type: 'surface.start', id: 'preview', kind: 'dashboard', title: 'Drafting surface' } });
      writeProtocolLine(res, { op: 'event', path: '/surface', value: { type: 'surface.status', status: 'drafting', text: 'Gathering the shape.' } });
      writeProtocolLine(res, { op: 'event', path: '/surface', value: { type: 'region.add', id: 'summary', parent: 'preview', role: 'summary', label: 'Drafting surface' } });
      writeProtocolLine(res, { op: 'event', path: '/surface', value: { type: 'node.add', id: 'shape', parent: 'summary', kind: 'text', props: { text: 'Gathering the shape.' } } });
      writeProtocolLine(res, { op: 'event', path: '/surface', value: { type: 'surface.finalize', artifactExpected: true } });
      await delay(900);
      writeProtocolLine(res, arrowHtmlArtifact(
        '<article style="padding:24px;font-family:system-ui;"><h1>Final answer</h1><p>Ready to inspect.</p></article>',
      ));
      writeProtocolLine(res, {
        op: 'meta',
        path: '/stream-graph-summary',
        value: {
          health: {
            complete: true,
            blockedCount: 0,
            warningCount: 0,
          },
          artifacts: [{ revision: 1, runtime: 'arrow', bytes: 1 }],
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
});

test('gallery shows progressive placeholder before final stream replacement', async ({ page }) => {
  const server = await startProgressiveApiServer();
  try {
    await page.goto('/');
    await page.locator('#run').click();

    await expect(page.locator('#welcome-kicker')).toHaveText(/Streaming|Writing/);
    await expect(page.locator('#welcome-detail')).toContainText('Waiting for validated surface lines');

    const preview = page.locator('#sandbox [data-summon-preview-root]');
    await expect(preview).toContainText('Drafting surface');
    await expect(preview).toContainText('Gathering the shape.');
    await expect(page.locator('#accepted-count')).toContainText('5');
    const surface = page.locator('#sandbox arrow-sandbox');
    await expect(surface.locator('h1')).toContainText('Final answer');
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
        arrowArtifact(`import { html, reactive } from "@arrow-js/core";
import { callTool } from "host-bridge:summon";

const state = reactive({ saving: false, saved: false, error: "", lastChoice: "" });

async function saveChoice() {
  state.saving = true;
  state.saved = false;
  state.error = "";
  const result = await callTool("choose", { option: "Balanced path" });
  state.saving = false;
  if (result.ok) {
    const next = result.state || {};
    state.saved = true;
    state.lastChoice = String(next.lastChoice || "Balanced path");
  } else {
    state.error = result.error || "Save failed";
  }
}

export default html\`
  <article style="padding:24px;font-family:system-ui;">
    <h1>Pick a launch path</h1>
    <button @click="\${saveChoice}">Save Balanced path</button>
    <p id="saving" style="\${() => state.saving ? "" : "display:none"}">Saving...</p>
    <p id="save-error" style="\${() => state.error ? "" : "display:none"}">\${() => state.error}</p>
    <p id="saved" style="\${() => state.saved ? "" : "display:none"}">Saved.</p>
    <p style="\${() => state.lastChoice ? "" : "display:none"}">Saved <span>\${() => state.lastChoice}</span></p>
  </article>
\`;`),
        {
          op: 'meta',
          path: '/stream-graph-summary',
          value: {
            health: {
              complete: true,
              blockedCount: 0,
              warningCount: 0,
            },
            artifacts: [{ revision: 1, runtime: 'arrow', bytes: 1 }],
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
  expect(captured.tools.tools.map((tool: any) => tool.name)).toEqual([
    'search',
    'choose',
    'publish_summary',
    'issue_refund',
    'analysis',
    'compute_score',
  ]);
  expect(captured.components).toBeUndefined();

  const surface = page.locator('#sandbox arrow-sandbox');
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
        arrowArtifact(`import { html, reactive } from "@arrow-js/core";
import { callTool } from "host-bridge:summon";

const state = reactive({ loading: false, empty: false, error: "" });

async function submitSearch() {
  state.loading = true;
  state.empty = false;
  state.error = "";
  const result = await callTool("search", { query: "zzzzzz" });
  state.loading = false;
  if (result.ok) {
    const next = result.state || {};
    state.empty = Boolean(next.noResults);
  } else {
    state.error = result.error || "Search failed";
  }
}

export default html\`
  <section style="padding:24px;font-family:system-ui;">
    <h1>Recipe search</h1>
    <form @submit="\${submitSearch}">
      <input name="query" value="zzzzzz">
      <button>Search</button>
    </form>
    <p id="loading" style="\${() => state.loading ? "" : "display:none"}">Searching...</p>
    <p id="error" style="\${() => state.error ? "" : "display:none"}">\${() => state.error}</p>
    <p id="empty" style="\${() => state.empty ? "" : "display:none"}">No recipes found.</p>
  </section>
\`;`),
        {
          op: 'meta',
          path: '/stream-graph-summary',
          value: {
            health: {
              complete: true,
              blockedCount: 0,
              warningCount: 0,
            },
            artifacts: [{ revision: 1, runtime: 'arrow', bytes: 1 }],
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

  const surface = page.locator('#sandbox arrow-sandbox');
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
        arrowArtifact(`import { html, reactive } from "@arrow-js/core";
import { callTool } from "host-bridge:summon";

const state = reactive({
  waiting: false,
  approved: false,
  denied: false,
  failed: "",
  refunded: false,
  amount: "",
});

async function requestRefund() {
  state.waiting = true;
  state.approved = false;
  state.denied = false;
  state.failed = "";
  state.refunded = false;
  state.amount = "";
  const result = await callTool("issue_refund", { title: "Approval smoke", amount: "$842.15" });
  const next = result.state || {};
  state.waiting = false;
  state.approved = Boolean(next.refundApprovalApproved);
  state.denied = Boolean(next.refundApprovalDenied);
  state.refunded = Boolean(next.refundIssued);
  state.amount = String(next.refundAmount || "");
  if (!result.ok && !state.denied) state.failed = result.error || "Refund failed";
}

export default html\`
  <article style="padding:24px;font-family:system-ui;">
    <h1>Refund review</h1>
    <button @click="\${requestRefund}">Request refund</button>
    <p id="waiting" style="\${() => state.waiting ? "" : "display:none"}">Waiting for host approval</p>
    <p id="approved" style="\${() => state.approved ? "" : "display:none"}">Approved</p>
    <p id="denied" style="\${() => state.denied ? "" : "display:none"}">Denied</p>
    <p id="failed" style="\${() => state.failed ? "" : "display:none"}">\${() => state.failed}</p>
    <p id="refunded" style="\${() => state.refunded ? "" : "display:none"}">Refunded <span>\${() => state.amount}</span></p>
  </article>
\`;`),
        {
          op: 'meta',
          path: '/stream-graph-summary',
          value: {
            health: {
              complete: true,
              blockedCount: 0,
              warningCount: 0,
            },
            artifacts: [{ revision: 1, runtime: 'arrow', bytes: 1 }],
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

  const surface = page.locator('#sandbox arrow-sandbox');
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
        arrowHtmlArtifact(`<section style="padding:24px;display:grid;gap:16px;font-family:system-ui;">
          <h1>Launch readiness</h1>
          <article id="launch-score"><strong>Launch score</strong><p>84</p><small>+6 pts</small></article>
          <article id="quality-trend"><strong>Quality trend</strong><p>62 -> 67 -> 71 -> 76 -> 82 -> 84</p><small>Six-week readiness climb</small></article>
        </section>`),
        {
          op: 'meta',
          path: '/stream-graph-summary',
          value: {
            health: {
              complete: true,
              blockedCount: 0,
              warningCount: 0,
            },
            artifacts: [{ revision: 1, runtime: 'arrow', bytes: 1 }],
          },
        },
      ]),
    });
  });

  await page.goto('/');
  await page.locator('[data-preset-id="arrow-fidelity"]').click();
  await page.locator('#run').click();
  const surface = page.locator('#sandbox arrow-sandbox');
  await expect(surface.locator('#launch-score')).toContainText('Launch score');
  await expect(surface.locator('#quality-trend')).toContainText('Quality trend');
  expect(requests[0].components).toBeUndefined();
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
            runtime: 'arrow',
            data: 'embedded',
            authority: 'host-action',
            persistence: 'replayable',
          },
        },
        arrowHtmlArtifact('<section><h1>Checkout Review</h1></section>'),
        {
          op: 'meta',
          path: '/ghost-review-packet',
          value: {
            source: 'root',
            product: 'Checkout',
            artifactRuntime: 'arrow',
            artifactFiles: ['main.ts'],
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
            artifacts: [{ revision: 1, runtime: 'arrow', bytes: 1 }],
          },
        },
      ]),
    });
  });

  await page.goto('/');
  await expect(page.locator('[data-preset-id="ghost-checkout"]')).toContainText('Ghost steer: checkout');
  await page.locator('[data-preset-id="ghost-checkout"]').click();
  await page.locator('#run').click();
  await expect(page.locator('#sandbox arrow-sandbox').locator('h1')).toContainText('Checkout Review');

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
