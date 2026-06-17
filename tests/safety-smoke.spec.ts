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
  runtime: 'arrow',
  data: 'host-resource',
  authority: 'read',
  persistence: 'replayable',
};

const componentIslandsPlan = {
  purpose: 'review',
  runtime: 'arrow',
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

function arrowHtmlArtifact(html: string): any {
  const source = html.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  return {
    op: 'artifact',
    path: '/artifact',
    value: {
      runtime: 'arrow',
      source: {
        'main.ts': `import { html } from "@arrow-js/core";\nexport default html\`${source}\``,
      },
    },
  };
}

test('adversarial sandbox boundary holds', async ({ page }) => {
  await page.goto('/adversarial');

  const summary = page.locator('#summary');
  await expect(summary).toContainText('Sandbox boundary holding.', { timeout: 30_000 });
  await expect(summary).toContainText(/All \d+ tests passed/);
  const passedCount = Number((await summary.textContent())?.match(/All (\d+) tests passed/)?.[1] ?? 0);
  expect(passedCount).toBeGreaterThanOrEqual(25);
  await expect(page.locator('#results .fail')).toHaveCount(0);

  const results = page.locator('#results');
  await expect(results).toContainText('intent="exfiltrate"');
  await expect(results).toContainText('intent="escalate"');
});

test('bootstrap self-test fails closed on unsafe sandbox config', async ({ page }) => {
  await page.goto('/fatal');

  await expect(page.locator('#case-a-result')).toContainText('SUMMON_READY');
  await expect(page.locator('#case-a-result .fail')).toHaveCount(0);

  const fatalResult = page.locator('#case-b-result');
  await expect(fatalResult).toContainText('SUMMON_FATAL');
  await expect(fatalResult).toContainText(/null-origin|top\.location readable|window\.top\.location readable/);
  await expect(fatalResult.locator('.fail')).toHaveCount(0);
});

test('strict input keeps sensitive entry in host overlay', async ({ page }) => {
  await page.goto('/strict');

  const hostInput = page.locator('[data-strict-slot="card_number"] input');
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

  await page.goto('/generate');

  await expect(page.locator('#sandbox')).toHaveAttribute('sandbox', 'allow-scripts');
  await expect(page.locator('#go')).toBeEnabled();
  await expect(page.locator('#welcome')).toBeVisible();
  await expect(page.locator('#welcome')).toContainText('Describe a surface to generate.');
  await expect(page.locator('#scenario')).toContainText('Host Data Search');
  await expect(page.locator('#scenario')).toHaveValue('host-resource-search');
  await page.getByRole('button', { name: 'Options' }).click();
  await expect(page.locator('#contract-summary [data-contract-row="requested"]')).toContainText(
    'Requested surface config',
  );
  await expect(page.locator('#custom-contract-panel')).toBeHidden();
  await page.locator('#custom-contract-enabled').check();
  await expect(page.locator('#custom-contract-panel')).toBeVisible();

  expect(pageErrors.map((error) => error.message)).toEqual([]);
});

test('sandbox ignores legacy HTML render and node patch messages', async ({ page }) => {
  const sandboxId = 'legacy-message-test';
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
        <script>window.__SUMMON_SANDBOX_ID__=${JSON.stringify(sandboxId)};</script>
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

  await page.locator('#sandbox').evaluate((iframe, payload) => {
    const win = (iframe as HTMLIFrameElement).contentWindow;
    win?.postMessage({
      type: 'SUMMON_RENDER',
      sandbox_id: payload.sandboxId,
      html: '<h1 id="legacy-html">Legacy HTML</h1><script>parent.postMessage({type:"EXECUTED"}, "*")</script>',
    }, '*');
    win?.postMessage({
      type: 'SUMMON_NODE_PATCH',
      sandbox_id: payload.sandboxId,
      patch: {
        sectionId: 'main',
        nodeId: 'root',
        html: '<div data-summon-node="root">Legacy patch</div>',
      },
    }, '*');
  }, { sandboxId });

  const sandbox = page.frameLocator('#sandbox');
  await expect(sandbox.locator('#legacy-html')).toHaveCount(0);
  await expect(sandbox.locator('[data-summon-node="root"]')).toHaveCount(0);
  const executed = await page.evaluate(() => {
    const messages = (window as any).__summonMessages as any[];
    return messages.some((message) => message?.type === 'EXECUTED');
  });
  expect(executed).toBe(false);
});

test('sandbox Arrow onState bridge syncs host pushes without legacy attributes', async ({ page }) => {
  const sandboxId = 'arrow-on-state-test';
  await page.setContent(`
    <script>
      window.__summonMessages = [];
      window.addEventListener('message', (event) => window.__summonMessages.push(event.data));
    </script>
    <iframe id="sandbox" sandbox="allow-scripts"></iframe>
  `);
  const nonce = 'summonlocalnonce';
  const srcdoc = `<!doctype html>
    <html>
      <head>
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-src 'none'; child-src 'none'; media-src 'none'; object-src 'none'; worker-src 'none'">
        <meta charset="utf-8">
        <script nonce="${nonce}">window.__SUMMON_SANDBOX_ID__=${JSON.stringify(sandboxId)};</script>
        <script nonce="${nonce}">
          window.__SUMMON_ARROW_SANDBOX__ = {
            sandbox(options, adapter, imports) {
              return function mount(root) {
                const bridge = imports["host-bridge:summon"];
                const state = { count: 0, label: "Waiting" };
                root.innerHTML = '<main><p id="label"></p><output id="count"></output><button id="increment">Increment</button></main>';
                const label = root.querySelector("#label");
                const count = root.querySelector("#count");
                function render() {
                  label.textContent = state.label;
                  count.textContent = String(state.count);
                }
                const unsubscribe = bridge.onState((hostState) => {
                  state.count = Number(hostState.count ?? state.count);
                  state.label = String(hostState.label ?? state.label);
                  render();
                });
                root.querySelector("#increment").addEventListener("click", async () => {
                  const result = await bridge.invoke("counter", { delta: 1 });
                  if (result.ok) {
                    state.count = Number(result.state.count ?? state.count);
                    state.label = String(result.state.label ?? state.label);
                    render();
                  }
                });
                render();
                return function teardown() { unsubscribe(); root.replaceChildren(); };
              };
            },
          };
        </script>
        <script nonce="${nonce}">${bootstrapSource}</script>
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

  await page.locator('#sandbox').evaluate((iframe, payload) => {
    (iframe as HTMLIFrameElement).contentWindow?.postMessage({
      type: 'SUMMON_RENDER',
      sandbox_id: payload.sandboxId,
      artifact: {
        runtime: 'arrow',
        source: {
          'main.ts': [
            'import { html, reactive } from "@arrow-js/core";',
            'import { invoke, onState } from "host-bridge:summon";',
            'const state = reactive({ count: 0, label: "" });',
            'onState((hostState) => { state.count = Number(hostState.count ?? state.count); state.label = String(hostState.label ?? state.label); });',
            'async function increment() { await invoke("counter", { delta: 1 }); }',
            'export default html`<main><p id="label">${() => state.label}</p><output id="count">${() => state.count}</output><button id="increment" @click="${increment}">Increment</button></main>`;',
          ].join('\\n'),
        },
      },
    }, '*');
  }, { sandboxId });

  const sandbox = page.frameLocator('#sandbox');
  await expect(sandbox.locator('#label')).toHaveText('Waiting');
  await expect(sandbox.locator('#count')).toHaveText('0');
  await expect(sandbox.locator('[data-summon-bind],[data-summon-show],[data-summon-on-click],[data-summon-local]')).toHaveCount(0);

  await page.locator('#sandbox').evaluate((iframe, payload) => {
    (iframe as HTMLIFrameElement).contentWindow?.postMessage({
      type: 'SUMMON_STATE',
      sandbox_id: payload.sandboxId,
      state: { count: 7, label: 'Host pushed' },
    }, '*');
  }, { sandboxId });

  await expect(sandbox.locator('#label')).toHaveText('Host pushed');
  await expect(sandbox.locator('#count')).toHaveText('7');

  await sandbox.locator('#increment').click();
  await expect.poll(async () => page.evaluate(() => {
    const messages = (window as any).__summonMessages as any[];
    return messages.find((message) => message?.type === 'SUMMON_INTENT' && message.intent === 'counter')?.args;
  })).toEqual({ delta: 1 });
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
          intentSource: 'deterministic',
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
      {
        op: 'artifact',
        path: '/artifact',
        value: {
          runtime: 'arrow',
          source: {
            'main.ts': 'export default html`<section><h1>Dinner Finder</h1><button>Search</button></section>`',
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
            skippedCount: 0,
          },
          artifacts: [{ revision: 1, runtime: 'arrow', bytes: 1 }],
        },
      },
    ]);
    await route.fulfill({ status: 200, contentType: 'text/plain', body });
  });

  await page.goto('/generate');
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

test('generate showcase renders Arrow artifacts in the sandbox', async ({ page }) => {
  await page.route('**/api/generate', async (route) => {
    const body = jsonl([
      { op: 'meta', path: '/surface-plan', value: { ...hostSearchPlan, data: 'embedded', authority: 'none' } },
      {
        op: 'artifact',
        path: '/artifact',
        value: {
          runtime: 'arrow',
          source: {
            'main.ts': 'export default html`<section id="arrow-probe" style="color:black;padding:20px"><h1>Arrow rendered</h1><p>Inside sandbox.</p></section>`',
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
            skippedCount: 0,
          },
          artifacts: [{ revision: 1, runtime: 'arrow', bytes: 1 }],
        },
      },
    ]);
    await route.fulfill({ status: 200, contentType: 'text/plain', body });
  });

  await page.goto('/generate');
  await page.locator('#go').click();

  await expect(page.locator('#iframe-status')).toContainText('done');
  const sandbox = page.frameLocator('#sandbox');
  await expect(sandbox.locator('#arrow-probe')).toBeVisible({ timeout: 15_000 });
  await expect(sandbox.locator('#arrow-probe')).toContainText('Arrow rendered');
});

test('batch page brokers each generation request', async ({ page }) => {
  const captured: any[] = [];
  await page.route('**/api/generate', async (route) => {
    const request = route.request().postDataJSON();
    captured.push(request);
    const body = jsonl([
      { op: 'meta', path: '/agent-intent', value: { purpose: 'inform', interaction: 'none', dataNeed: 'embedded', sideEffect: 'none', requestedCapabilities: [], requestedComponents: [], confidence: 0.58 } },
      { op: 'meta', path: '/agent-policy-resolution', value: { source: 'default', intentSource: 'deterministic', surfacePolicy: { tier: 'static', purpose: 'inform', persistence: 'replayable' }, rejectedCapabilities: [], rejectedComponents: [], fallback: false } },
      arrowHtmlArtifact('<section><h1>Batch brokered</h1></section>'),
    ]);
    await route.fulfill({ status: 200, contentType: 'text/plain', body });
  });

  await page.goto('/batch');
  await page.locator('#count').fill('1');
  await page.locator('#run').click();

  await expect(page.locator('#summary')).toContainText('1 ok');
  expect(captured).toHaveLength(1);
  expect(captured[0].agent).toEqual({ enabled: true });
  expect(captured[0].surfacePolicy).toBeUndefined();
  expect(captured[0].surfacePlan).toBeUndefined();
  await expect(page.locator('#grid')).toContainText('agent policy');
});

test('unknown demo routes redirect to Arrow generate workbench', async ({ page }) => {
  await page.goto('/unknown-route');
  await expect(page).toHaveURL(/\/generate$/);
  await expect(page.locator('#scenario')).toContainText('Host Data Search');
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
      arrowHtmlArtifact('<section><form id="override-form"><label>Title <input name="title" /></label><button>Save</button></form></section>'),
      {
        op: 'meta',
        path: '/stream-graph-summary',
        value: {
          health: {
            complete: true,
            blockedCount: 0,
            skippedCount: 0,
          },
          artifacts: [{ revision: 1, runtime: 'arrow', bytes: 1 }],
        },
      },
    ]);
    await route.fulfill({ status: 200, contentType: 'text/plain', body });
  });

  await page.goto('/generate');
  await expect(page.locator('#scenario')).toContainText('Declarative form');
  await page.locator('#scenario').selectOption('declarative-form');
  await page.getByRole('button', { name: 'Options' }).click();
  await page.locator('#token-preset').selectOption('accent-blue');

  await expect(page.locator('#prompt')).toHaveValue(/team lunch order/);
  await expect(page.locator('#scenario')).toHaveValue('declarative-form');
  await expect(page.locator('#custom-contract-panel')).toBeHidden();
  await page.locator('#custom-contract-enabled').check();
  await expect(page.locator('#custom-contract-panel')).toBeVisible();
  await expect(page.locator('#surface-purpose')).toHaveValue('collect');
  await page.getByRole('button', { name: 'Close' }).click();

  await page.locator('#go').click();
  await expect(page.locator('#iframe-status')).toContainText('done');
  await expect(page.frameLocator('#sandbox').locator('#override-form')).toBeVisible();
  await page.getByRole('button', { name: 'Options' }).click();
  await expect(page.locator('#contract-summary [data-contract-row="effective"]')).toContainText(
    'collect · arrow',
  );

  expect(captured).toBeTruthy();
  expect(captured.mode).toBe('interactive');
  expect(captured.scriptPolicy).toBe('forbid');
  expect(captured.surfacePolicy).toBeUndefined();
  expect(captured.surfacePlan).toEqual({
    purpose: 'collect',
    runtime: 'arrow',
    data: 'embedded',
    authority: 'host-action',
    persistence: 'replayable',
    network: 'none',
  });
  expect(captured.capabilities.intents.map((intent: any) => intent.name)).toEqual(['submit']);
  expect(captured.capabilities.intents[0].surface).toEqual({ authority: 'host-action' });
  expect(captured.tokenOverrides).toEqual({
    'color-accent': '#0f8cff',
    'color-accent-fg': '#ffffff',
  });
  expect(captured.repair).toBeUndefined();
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
          intentSource: 'deterministic',
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
      {
        op: 'artifact',
        path: '/artifact',
        value: {
          runtime: 'arrow',
          source: {
            'main.ts': 'export default html`<section><h1>Checkout Review</h1><button>Accept</button></section>`',
          },
        },
      },
      {
        op: 'meta',
        path: '/ghost-review-packet',
        value: {
          baseDirectionId: 'ghost',
          styleSource: 'ghost-config-token-css',
          artifactRuntime: 'arrow',
          artifactFiles: ['main.ts'],
          validation: { blocked: 0, warnings: 0 },
        },
      },
      {
        op: 'meta',
        path: '/stream-graph-summary',
        value: {
          health: {
            complete: true,
            blockedCount: 0,
            skippedCount: 0,
          },
          artifacts: [{ revision: 1, runtime: 'arrow', bytes: 1 }],
        },
      },
    ]);
    await route.fulfill({ status: 200, contentType: 'text/plain', body });
  });

  await page.goto('/generate');
  await expect(page.locator('#scenario')).toContainText('Fingerprint: checkout');
  await page.locator('#scenario').selectOption('ghost-checkout');
  await page.locator('#go').click();

  await expect(page.locator('#iframe-status')).toContainText('done');
  await expect(page.locator('#log')).toContainText('fingerprint context');
  await expect(page.frameLocator('#sandbox').locator('h1')).toContainText('Checkout Review');
  await expect(page.locator('#log')).toContainText('fingerprint review packet');

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
          intentSource: 'deterministic',
          surfacePolicy: componentIslandsPolicy,
          rejectedCapabilities: [],
          rejectedComponents: [],
          fallback: false,
        },
      },
      { op: 'meta', path: '/surface-plan', value: componentIslandsPlan },
      arrowHtmlArtifact(html),
      {
        op: 'meta',
        path: '/stream-graph-summary',
        value: {
          health: {
            complete: true,
            blockedCount: 0,
            skippedCount: 0,
          },
          artifacts: [{ revision: 1, runtime: 'arrow', bytes: 1 }],
        },
      },
    ]);
    await route.fulfill({ status: 200, contentType: 'text/plain', body });
  });

  await page.goto('/generate');
  await page.locator('#scenario').selectOption('component-islands');
  await page.locator('#go').click();

  await expect(page.locator('#iframe-status')).toContainText('done');
  await page.locator('#sandbox').scrollIntoViewIfNeeded();
  const sandbox = page.frameLocator('#sandbox');
  await expect(sandbox.locator('#sandbox-proof')).toContainText('Sandbox placeholder only');
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

  await expect(sandbox.locator('[data-summon-component-id="launch-score"]')).not.toContainText('84');

  const iframe = await page.locator('#sandbox').elementHandle();
  const frame = await iframe?.contentFrame();
  expect(frame).toBeTruthy();
  const beforeScroll = await hostIsland.boundingBox();
  expect(beforeScroll).toBeTruthy();
  await frame!.evaluate(() => window.scrollTo(0, 80));
  await expect.poll(async () => (await hostIsland.boundingBox())?.y ?? 0).toBeLessThan(beforeScroll!.y - 40);

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
      arrowHtmlArtifact(html),
      {
        op: 'meta',
        path: '/stream-graph-summary',
        value: {
          health: {
            complete: true,
            blockedCount: 0,
            skippedCount: 0,
          },
          artifacts: [{ revision: 1, runtime: 'arrow', bytes: 1 }],
        },
      },
    ]);
    await route.fulfill({ status: 200, contentType: 'text/plain', body });
  });

  await page.goto('/generate');
  await page.locator('#scenario').selectOption('component-islands');
  await page.locator('#go').click();

  await page.locator('#sandbox').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-summon-component-id="bad-props"]')).toHaveCount(0);
  await expect(page.locator('#devtools-log')).toContainText('component-error');
  await expect(page.locator('#devtools-log')).toContainText('props-invalid');
});
