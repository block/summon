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
          maxOutputTokens: 128000,
          anthropicThinking: 'adaptive',
          effort: 'max',
        },
      },
      controls: {
        customModels: true,
        maxOutputTokens: {
          default: 128000,
          presets: [8000, 12000, 16000, 32000, 64000, 128000],
        },
        anthropicThinking: {
          default: 'adaptive',
          options: ['adaptive', 'off'],
        },
        effort: {
          default: 'max',
          options: ['low', 'medium', 'high', 'max'],
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

function htmlArtifact(source: { body: string; css?: string; js?: string }): ProtocolLine {
  return {
    op: 'artifact',
    path: '/artifact',
    value: {
      runtime: 'html',
      source: {
        'body.html': source.body,
        ...(source.css ? { 'main.css': source.css } : {}),
        ...(source.js ? { 'main.js': source.js } : {}),
      },
    },
  };
}

function htmlPatch(html: string, target = 'hero'): ProtocolLine {
  return {
    op: 'patch',
    path: '/artifact/html-patch',
    value: {
      runtime: 'html',
      action: 'replace',
      target,
      html,
    },
  };
}

function htmlStreamPreview(delta: string, target = 'hero'): ProtocolLine {
  return {
    op: 'meta',
    path: '/html-stream-preview',
    value: {
      runtime: 'html',
      action: 'replace',
      target,
      delta,
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
        warningCount: 0,
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

async function selectRuntime(page: Page, label: string): Promise<void> {
  await page.locator('#stream-type-picker').click();
  await page.getByRole('option', { name: label }).click();
  await expect(page.locator('#stream-type-picker')).toContainText(label);
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
  await expect(page.locator('#welcome')).toContainText('just summon it.');
  await expect(page.getByRole('button', { name: 'Dinner finder', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await page.getByRole('button', { name: 'Options' }).click();
  await expect(page.locator('#contract-summary [data-contract-row="requested"]')).toContainText(
    'brokered from prompt',
  );
  await expect(page.locator('#contract-summary [data-contract-row="grants"]')).toContainText('1: search');
  await expect(page.locator('#network-policy')).toHaveValue('none');
  await expect(page.locator('#run-profile-quality')).toBeChecked();
  await expect(page.locator('#generation-model')).toHaveValue('claude-opus-4-8');
  await expect(page.locator('#utility-model')).toHaveValue('claude-sonnet-4-6');
  await expect(page.locator('#max-output-tokens')).toHaveValue('128000');
  await expect(page.locator('#anthropic-thinking')).toHaveValue('off');
  await expect(page.locator('#anthropic-thinking')).toBeDisabled();
  await expect(page.locator('#model-effort')).toHaveValue('max');

  expect(pageErrors.map((error) => error.message)).toEqual([]);
});

test('generate page run profiles restore quality defaults and mark manual changes custom', async ({ page }) => {
  await page.goto('/generate');

  await page.getByRole('button', { name: 'Options' }).click();
  await expect(page.locator('#run-profile-quality')).toBeChecked();
  await page.locator('label', { has: page.locator('#run-profile-fast') }).click();
  await expect(page.locator('#generation-model')).toHaveValue('claude-haiku-4-5');
  await expect(page.locator('#utility-model')).toHaveValue('claude-haiku-4-5');
  await expect(page.locator('#max-output-tokens')).toHaveValue('12000');
  await expect(page.locator('#anthropic-thinking')).toHaveValue('off');
  await expect(page.locator('#anthropic-thinking')).toBeDisabled();
  await expect(page.locator('#model-effort')).toHaveValue('low');

  await page.locator('label', { has: page.locator('#run-profile-quality') }).click();
  await expect(page.locator('#generation-model')).toHaveValue('claude-opus-4-8');
  await expect(page.locator('#utility-model')).toHaveValue('claude-sonnet-4-6');
  await expect(page.locator('#max-output-tokens')).toHaveValue('128000');
  await expect(page.locator('#anthropic-thinking')).toHaveValue('off');
  await expect(page.locator('#anthropic-thinking')).toBeDisabled();
  await expect(page.locator('#model-effort')).toHaveValue('max');

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

  await expect(page.locator('#surface-status')).toContainText(/Done/i, { timeout: 20_000 });
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
  expect(captured?.validationMode).toBe('enforce');
  expect(captured?.agent).toEqual({ enabled: true });
  expect(captured?.surfacePolicy).toBeUndefined();
  expect(captured?.surfacePlan).toBeUndefined();
});

test('generate page surfaces syntax validation blocks instead of mounting malformed Arrow source', async ({ page }) => {
  const malformedIssue = {
    source: 'protocol',
    severity: 'block',
    code: 'invalid-arrow-source-syntax',
    path: '/artifact/main.ts',
    message: 'Arrow source syntax error in main.ts:34:71: Unterminated string literal.\n\nSource excerpt:\n  31 | const title = "Draft";\n> 34 | export default html`<p>${() => "broken}</p>`;',
  };

  await page.route('**/api/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: jsonl([
        { op: 'meta', path: '/surface-plan', value: staticSummaryPlan },
        { op: 'meta', path: '/validation-blocked', value: malformedIssue },
        { op: 'meta', path: '/error', value: `generation blocked: ${malformedIssue.message}` },
        {
          op: 'meta',
          path: '/validation-summary',
          value: {
            blocked: 1,
            warnings: 0,
            codes: { 'invalid-arrow-source-syntax': 1 },
            examples: [malformedIssue],
          },
        },
        {
          op: 'meta',
          path: '/stream-graph-summary',
          value: {
            health: {
              complete: false,
              blockedCount: 1,
              warningCount: 0,
            },
            artifacts: [],
          },
        },
      ]),
    });
  });

  await page.goto('/generate');
  await page.locator('#go').click();

  await expect(page.locator('#stage-notice')).toBeVisible();
  await expect(page.locator('#stage-notice')).toContainText(
    'Generation blocked before a validated Arrow artifact was accepted',
  );
  await expect(page.locator('#stage-notice')).toContainText('invalid-arrow-source-syntax');
  await expect(page.locator('#stage-notice')).toContainText('Source excerpt');
  await expect(page.locator('#sandbox arrow-sandbox')).toHaveCount(0);
  await page.locator('#open-diagnostics').click();
  await expect(page.locator('#diagnostics-stream')).toBeVisible();
  await expect(page.locator('#log')).toContainText('invalid-arrow-source-syntax');
  await expect(page.locator('#log')).toContainText('Source excerpt');
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
              warningCount: 0,
            },
            artifacts: [],
          },
        },
      ]),
    });
  });

  await page.goto('/generate');
  await page.getByRole('button', { name: 'IRA explainer', exact: true }).click();
  await page.locator('#go').click();

  await expect(page.locator('#stage-notice')).toBeVisible();
  await expect(page.locator('#stage-notice')).toContainText('Generation failed');
  await expect(page.locator('#stage-notice')).toContainText('model provider could not produce a surface');
  await page.locator('#open-diagnostics').click();
  await expect(page.locator('#diagnostics-stream')).toBeVisible();
  await expect(page.locator('#log')).toContainText('model provider could not produce a surface');
});

test('html-static blocks unsafe HTML before mounting an iframe', async ({ page }) => {
  let captured: Record<string, unknown> | null = null;
  await page.route('**/api/generate', async (route) => {
    captured = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: jsonl([
        htmlArtifact({
          body: '<section id="hero"><script>window.__htmlStaticLeak = true</script><h1>Unsafe</h1></section>',
        }),
      ]),
    });
  });

  await page.goto('/generate');
  await selectRuntime(page, 'HTML static');
  await page.locator('#go').click();

  await expect(page.locator('#stage-notice')).toBeVisible();
  await expect(page.locator('#sandbox iframe.summon-html-surface-frame')).toHaveCount(0);
  await expect.poll(() => captured?.experimentalRuntime).toBe('html-static');
  await expect.poll(async () => page.evaluate(() => (window as typeof window & { __htmlStaticLeak?: boolean }).__htmlStaticLeak ?? false)).toBe(false);
});

test('html-stream preview remains inert until a validated patch commits', async ({ page }) => {
  await page.route('**/api/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: jsonl([
        htmlArtifact({
          body: '<main><section id="hero"></section></main>',
          css: '#hero { color: var(--color-text); }',
        }),
        htmlStreamPreview('<section id="hero" onclick="evil()"><script>window.__previewLeak = true</script><h1 id="preview-only">Preview only</h1></section>'),
        {
          op: 'meta',
          path: '/html-stream-summary',
          value: { previewDeltaCount: 1, committedPatchCount: 0, blockedPatchReasons: [] },
        },
        streamGraphSummary(),
      ]),
    });
  });

  await page.goto('/generate');
  await selectRuntime(page, 'HTML stream');
  await page.locator('#go').click();

  const previewFrame = page.frameLocator('#sandbox iframe.summon-html-stream-preview-frame');
  await expect(previewFrame.locator('#preview-only')).toContainText('Preview only');
  await expect(previewFrame.locator('script')).toHaveCount(0);
  await expect(previewFrame.locator('[onclick]')).toHaveCount(0);
  const committedFrame = page.frameLocator('#sandbox iframe.summon-html-surface-frame');
  await expect(committedFrame.locator('#preview-only')).toHaveCount(0);
  await expect.poll(async () => page.evaluate(() => (window as typeof window & { __previewLeak?: boolean }).__previewLeak ?? false)).toBe(false);

  await page.unroute('**/api/generate');
  await page.route('**/api/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: jsonl([
        htmlArtifact({
          body: '<main><section id="hero"></section></main>',
          css: '#hero { color: var(--color-text); }',
        }),
        htmlPatch('<section id="hero"><h1 id="committed">Committed patch</h1></section>'),
        {
          op: 'meta',
          path: '/html-stream-summary',
          value: { previewDeltaCount: 0, committedPatchCount: 1, blockedPatchReasons: [] },
        },
        streamGraphSummary(),
      ]),
    });
  });

  await page.locator('#go').click();
  await expect(committedFrame.locator('#committed')).toContainText('Committed patch');
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
  await expect(page.getByRole('button', { name: 'Dinner finder', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
