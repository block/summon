import { expect, test } from '@playwright/test';

function streamBody(lines: unknown[]): string {
  return `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`;
}

test('gallery boots and preset selection updates the contract panel', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('[data-preset-id]')).toHaveCount(6);
  await expect(page.locator('#preset-title')).toContainText('Static Brief');
  await expect(page.locator('[data-contract-row="policy"]')).toContainText('static');

  await page.locator('[data-preset-id="search-explorer"]').click();
  await expect(page.locator('#preset-title')).toContainText('Search Explorer');
  await expect(page.locator('#prompt')).toHaveValue(/weeknight dinner explorer/);
  await expect(page.locator('[data-contract-row="tier"]')).toContainText('declarative');
  await expect(page.locator('[data-contract-row="grants"]')).toContainText('search');
});

test('mocked generation renders and generated intents update host state', async ({ page }) => {
  let captured: any = null;
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
  await page.locator('[data-preset-id="decision-picker"]').click();
  await page.locator('#run').click();
  await expect(page.locator('#status')).toContainText('done');

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
  await expect(page.locator('#event-log')).toContainText('intent choose');
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
  await page.locator('[data-preset-id="component-island-dashboard"]').click();
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
