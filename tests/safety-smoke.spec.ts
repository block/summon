import { expect, test, type Page } from '@playwright/test';

type ProtocolLine = Record<string, unknown>;

const hostSearchPlan = {
  purpose: 'explore',
  runtime: 'arrow',
  data: 'host-resource',
  authority: 'read',
  persistence: 'replayable',
  network: 'none',
};

const staticSummaryPlan = {
  purpose: 'compare',
  runtime: 'arrow',
  data: 'embedded',
  authority: 'none',
  persistence: 'replayable',
  network: 'none',
};

const modelProviderCatalog = {
  defaultProvider: 'anthropic',
  providers: [
    {
      id: 'anthropic',
      name: 'Anthropic',
      configured: true,
      model: 'claude-opus-4-8',
      utilityModel: 'claude-sonnet-4-6',
      models: [
        {
          id: 'claude-opus-4-8',
          label: 'Claude Opus 4.8',
          status: 'stable',
          tier: 'frontier',
          maxOutputTokens: 128000,
        },
        {
          id: 'claude-haiku-4-5',
          label: 'Claude Haiku 4.5',
          status: 'stable',
          tier: 'fast',
          maxOutputTokens: 64000,
        },
      ],
      utilityModels: [
        {
          id: 'claude-sonnet-4-6',
          label: 'Claude Sonnet 4.6',
          status: 'stable',
          tier: 'balanced',
          maxOutputTokens: 64000,
        },
        {
          id: 'claude-haiku-4-5',
          label: 'Claude Haiku 4.5',
          status: 'stable',
          tier: 'fast',
          maxOutputTokens: 64000,
        },
      ],
      defaults: {
        generationModel: 'claude-opus-4-8',
        utilityModel: 'claude-sonnet-4-6',
        modelOptions: {
          maxOutputTokens: 64000,
          anthropicThinking: 'adaptive',
          effort: 'medium',
        },
      },
      controls: {
        customModels: true,
        maxOutputTokens: {
          default: 64000,
          presets: [8000, 12000, 16000, 32000, 64000],
        },
        anthropicThinking: {
          default: 'adaptive',
          options: ['adaptive', 'off'],
        },
        effort: {
          default: 'medium',
          options: ['low', 'medium', 'high'],
        },
      },
    },
  ],
};

function jsonl(lines: ProtocolLine[]): string {
  return `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`;
}

function arrowHtmlArtifact(html: string): ProtocolLine {
  const source = html
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
  return {
    op: 'artifact',
    path: '/artifact',
    value: {
      runtime: 'arrow',
      source: {
        'main.ts': `import { html } from "@arrow-js/core";\nexport default html\`${source}\`;`,
      },
    },
  };
}

function streamGraphSummary(): ProtocolLine {
  return {
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
  };
}

async function stubCatalogRoutes(page: Page): Promise<void> {
  await page.route('**/api/model-providers', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(modelProviderCatalog),
    });
  });
  await page.route('**/api/directions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
  await page.route('**/api/ghost-roots', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

function collectPageErrors(page: Page): Error[] {
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  return errors;
}

test.beforeEach(async ({ page }) => {
  await stubCatalogRoutes(page);
});

test('generate page boots the inline Arrow workbench without server credentials', async ({ page }) => {
  const pageErrors = collectPageErrors(page);

  await page.goto('/generate');

  await expect(page.locator('#sandbox')).toHaveAttribute('data-summon-inline-surface', /.+/);
  await expect(page.locator('#sandbox iframe')).toHaveCount(0);
  await expect(page.locator('#sandbox [data-summon-preview-root]')).toBeAttached();
  await expect(page.locator('#go')).toBeEnabled();
  await expect(page.locator('#welcome')).toBeVisible();
  await expect(page.locator('#welcome')).toContainText('Describe a surface to generate.');
  await expect(page.locator('#scenario')).toHaveValue('host-resource-search');

  await page.getByRole('button', { name: 'Options' }).click();
  await expect(page.locator('#contract-summary [data-contract-row="requested"]')).toContainText(
    'brokered from prompt',
  );
  await expect(page.locator('#contract-summary [data-contract-row="grants"]')).toContainText('1: search');
  await expect(page.locator('#network-policy')).toHaveValue('none');
  await expect(page.locator('#runtime-policy')).toHaveValue('arrow');
  await expect(page.locator('#run-profile-fast')).toBeChecked();
  await expect(page.locator('#generation-model')).toHaveValue('claude-haiku-4-5');
  await expect(page.locator('#utility-model')).toHaveValue('claude-haiku-4-5');
  await expect(page.locator('#max-output-tokens')).toHaveValue('12000');
  await expect(page.locator('#anthropic-thinking')).toHaveValue('off');
  await expect(page.locator('#model-effort')).toHaveValue('low');

  expect(pageErrors.map((error) => error.message)).toEqual([]);
});

test('generate page run profiles restore quality defaults and mark manual changes custom', async ({ page }) => {
  await page.goto('/generate');

  await page.getByRole('button', { name: 'Options' }).click();
  await expect(page.locator('#run-profile-fast')).toBeChecked();
  await page.locator('label', { has: page.locator('#run-profile-quality') }).click();
  await expect(page.locator('#generation-model')).toHaveValue('claude-opus-4-8');
  await expect(page.locator('#utility-model')).toHaveValue('claude-sonnet-4-6');
  await expect(page.locator('#max-output-tokens')).toHaveValue('64000');
  await expect(page.locator('#anthropic-thinking')).toHaveValue('adaptive');
  await expect(page.locator('#model-effort')).toHaveValue('medium');

  await page.locator('#generation-model').selectOption('claude-haiku-4-5');
  await expect(page.locator('#run-profile-custom')).toBeChecked();
});

test('generate page renders a mocked Arrow artifact through the inline sandbox', async ({ page }) => {
  let captured: Record<string, unknown> | null = null;
  await page.route('**/api/generate', async (route) => {
    captured = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: jsonl([
        {
          op: 'meta',
          path: '/agent-goal',
          value: {
            purpose: 'explore',
            interaction: 'search',
            dataNeed: 'host-resource',
            sideEffect: 'none',
            requestedTools: ['search'],
            confidence: 0.72,
          },
        },
        {
          op: 'meta',
          path: '/agent-policy-resolution',
          value: {
            source: 'default',
            goalSource: 'deterministic',
            proposedSurfacePolicy: {
              tier: 'declarative',
              purpose: 'explore',
              grants: ['search'],
              persistence: 'replayable',
            },
            surfacePolicy: {
              tier: 'declarative',
              purpose: 'explore',
              grants: ['search'],
              persistence: 'replayable',
            },
            rejectedTools: [],
            fallback: false,
          },
        },
        { op: 'meta', path: '/surface-policy', value: { tier: 'declarative', purpose: 'explore', grants: ['search'] } },
        { op: 'meta', path: '/surface-plan', value: hostSearchPlan },
        {
          op: 'meta',
          path: '/timing',
          value: {
            phase: 'drafting',
            label: 'Drafting Arrow artifact',
            elapsedMs: 12,
            durationMs: 4,
            source: 'server',
          },
        },
        arrowHtmlArtifact('<section id="arrow-probe"><h1>Dinner Finder</h1><p>Rendered by Arrow.</p></section>'),
        streamGraphSummary(),
      ]),
    });
  });

  await page.goto('/generate');
  await page.locator('#go').click();

  await expect(page.locator('#surface-status')).toContainText('done', { timeout: 20_000 });
  await expect(page.locator('#welcome')).toBeHidden();
  await expect(page.locator('#sandbox arrow-sandbox #arrow-probe')).toBeVisible();
  await expect(page.locator('#sandbox arrow-sandbox #arrow-probe')).toContainText('Dinner Finder');
  await page.getByRole('button', { name: 'Options' }).click();
  await expect(page.locator('#contract-summary [data-contract-row="broker"]')).toContainText('default');
  await expect(page.locator('#contract-summary [data-contract-row="stream"]')).toContainText('complete');
  await page.getByRole('button', { name: 'Diagnostics' }).click();
  await page.locator('#tab-timing').click();
  await expect(page.locator('#diagnostics-timing')).toBeVisible();
  await expect(page.locator('#timing-rows')).toContainText('server');
  await expect(page.locator('#timing-rows')).toContainText('drafting');
  await expect(page.locator('#timing-rows')).toContainText('first-artifact');

  expect(captured).toBeTruthy();
  expect(captured?.validationMode).toBe('observe');
  expect(captured?.agent).toEqual({ enabled: true });
  expect(captured?.surfacePolicy).toBeUndefined();
  expect(captured?.surfacePlan).toBeUndefined();
});

test('generate page surfaces streamed errors instead of leaving a blank stage', async ({ page }) => {
  await page.route('**/api/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: jsonl([
        { op: 'meta', path: '/surface-plan', value: staticSummaryPlan },
        { op: 'meta', path: '/error', value: 'model provider could not produce a surface' },
        {
          op: 'meta',
          path: '/stream-graph-summary',
          value: {
            health: {
              complete: false,
              blockedCount: 0,
              skippedCount: 0,
            },
            artifacts: [],
          },
        },
      ]),
    });
  });

  await page.goto('/generate');
  await page.locator('#scenario').selectOption('static-summary');
  await page.locator('#go').click();

  await expect(page.locator('#stage-notice')).toBeVisible();
  await expect(page.locator('#stage-notice')).toContainText('Generation failed');
  await expect(page.locator('#stage-notice')).toContainText('model provider could not produce a surface');
  await page.locator('#open-diagnostics').click();
  await expect(page.locator('#diagnostics-stream')).toBeVisible();
  await expect(page.locator('#log')).toContainText('model provider could not produce a surface');
});

test('adversarial inline Arrow boundary rejects ambient browser globals and ungranted tools', async ({ page }) => {
  await page.goto('/adversarial');

  const summary = page.locator('#summary');
  await expect(summary).toContainText('Sandbox boundary holding.', { timeout: 30_000 });
  await expect(summary).toContainText(/All \d+ tests passed/);
  const passedCount = Number((await summary.textContent())?.match(/All (\d+) tests passed/)?.[1] ?? 0);
  expect(passedCount).toBeGreaterThanOrEqual(25);
  await expect(page.locator('#results .fail')).toHaveCount(0);

  const results = page.locator('#results');
  await expect(results).toContainText('global-window');
  await expect(results).toContainText('global-document');
  await expect(results).toContainText('tool="exfiltrate"');
  await expect(results).toContainText('tool="escalate"');
});

test('retired strict and fatal routes describe the current inline runtime', async ({ page }) => {
  await page.goto('/strict');
  await expect(page.getByRole('heading', { name: 'Retired overlay notes' })).toBeVisible();
  await expect(page.locator('body')).toContainText('inline Arrow sandbox');
  await expect(page.locator('[data-strict-slot], iframe#sandbox')).toHaveCount(0);

  await page.goto('/fatal');
  await expect(page.getByRole('heading', { name: 'Retired boot notes' })).toBeVisible();
  await expect(page.locator('body')).toContainText('Arrow VM isolation');
  await expect(page.locator('#case-a-result, #case-b-result, iframe#sandbox')).toHaveCount(0);
});

test('unknown demo routes redirect to the current generate workbench', async ({ page }) => {
  await page.goto('/unknown-route');

  await expect(page).toHaveURL(/\/generate$/);
  await expect(page.locator('#sandbox')).toHaveAttribute('data-summon-inline-surface', /.+/);
  await expect(page.locator('#scenario')).toHaveValue('host-resource-search');
});
