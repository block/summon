import { expect, test, type Page } from '@playwright/test';

function collectPageErrors(page: Page): Error[] {
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  return errors;
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

test('generate showcase sends narrowed scenario contract', async ({ page }) => {
  let captured: any = null;
  await page.route('**/api/generate', async (route) => {
    captured = route.request().postDataJSON();
    const surfacePlan = captured.surfacePlan;
    const body = [
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
    ].map((line) => JSON.stringify(line)).join('\n') + '\n';
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

test('component islands render in host overlay without widening the sandbox', async ({ page }) => {
  let captured: any = null;
  await page.route('**/api/generate', async (route) => {
    captured = route.request().postDataJSON();
    const surfacePlan = captured.surfacePlan;
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
    const body = [
      { op: 'meta', path: '/surface-plan', value: surfacePlan },
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
    ].map((line) => JSON.stringify(line)).join('\n') + '\n';
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
    const body = [
      { op: 'meta', path: '/surface-plan', value: captured.surfacePlan },
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
    ].map((line) => JSON.stringify(line)).join('\n') + '\n';
    await route.fulfill({ status: 200, contentType: 'text/plain', body });
  });

  await page.goto('/generate.html');
  await page.locator('#scenario').selectOption('component-islands');
  await page.locator('#go').click();

  await expect(page.locator('[data-summon-component-id="bad-props"]')).toHaveCount(0);
  await expect(page.locator('#devtools-log')).toContainText('component-error');
  await expect(page.locator('#devtools-log')).toContainText('props-invalid');
});
