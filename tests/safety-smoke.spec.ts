import { expect, test, type Page } from '@playwright/test';

type ProtocolLine = Record<string, unknown>;

const hostSearchPlan = {
  purpose: 'explore',
  runtime: 'surface-document',
  data: 'host-resource',
  authority: 'read',
  persistence: 'replayable',
  network: 'none',
};

const staticSummaryPlan = {
  purpose: 'compare',
  runtime: 'surface-document',
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

function surfaceDocumentArtifact(source: { html: string; css: string; js?: string }): ProtocolLine {
  return {
    op: 'artifact',
    path: '/artifact',
    value: {
      runtime: 'surface-document',
      source: {
        'main.html': source.html,
        'main.css': source.css,
        ...(source.js ? { 'main.js': source.js } : {}),
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
        warningCount: 0,
      },
      artifacts: [{ revision: 1, runtime: 'surface-document', bytes: 1 }],
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
  await page.route('**/api/fingerprints', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'editorial-mono',
          name: 'Editorial Mono',
          summary: 'editorial · monochrome · comparison',
          defaultTargetPath: '.',
        },
      ]),
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

test('generate page boots the inline workbench without server credentials', async ({ page }) => {
  const pageErrors = collectPageErrors(page);

  await page.goto('/generate');

  await expect(page.locator('#sandbox')).toHaveAttribute('data-summon-surface', /.+/);
  await expect(page.locator('#sandbox iframe')).toHaveCount(0);
  await expect(page.locator('#sandbox [data-summon-preview-root]')).toBeAttached();
  await expect(page.locator('#go')).toBeEnabled();
  await expect(page.locator('#welcome')).toBeVisible();
  await expect(page.locator('#welcome')).toContainText('just summon it.');
  await expect(page.getByRole('button', { name: 'Hike finder', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await page.getByRole('button', { name: 'Options' }).click();
  await expect(page.locator('#contract-summary [data-contract-row="requested"]')).toContainText(
    'warded from prompt',
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

test('generate page renders a mocked Surface Document artifact through the Summon sandbox', async ({ page }) => {
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
              ceiling: { data: 'host-resource', authority: 'read' },
              purpose: 'explore',
              grants: ['search'],
              persistence: 'replayable',
            },
            surfacePolicy: {
              ceiling: { data: 'host-resource', authority: 'read' },
              purpose: 'explore',
              grants: ['search'],
              persistence: 'replayable',
            },
            rejectedTools: [],
            fallback: false,
          },
        },
        { op: 'meta', path: '/surface-policy', value: { ceiling: { data: 'host-resource', authority: 'read' }, purpose: 'explore', grants: ['search'] } },
        { op: 'meta', path: '/surface-plan', value: hostSearchPlan },
        {
          op: 'meta',
          path: '/timing',
          value: {
            phase: 'drafting',
            label: 'Drafting Surface Document artifact',
            elapsedMs: 12,
            durationMs: 4,
            source: 'server',
          },
        },
        surfaceDocumentArtifact({
          html: '<section id="surface-document-probe"><h1>Dinner Finder</h1><p>Rendered by the Summon VM.</p></section>',
          css: '#surface-document-probe { color: var(--color-text, #111); }',
        }),
        streamGraphSummary(),
      ]),
    });
  });

  await page.goto('/generate');
  await page.locator('#go').click();

  await expect(page.locator('#surface-status')).toContainText(/Done/i, { timeout: 20_000 });
  await expect(page.locator('#welcome')).toBeHidden();
  const mountedSurface = page.locator('#sandbox .summon-surface-document-host');
  await expect(mountedSurface).toHaveCount(1);
  await expect.poll(async () => mountedSurface.evaluate((host) => host.shadowRoot?.querySelector('#surface-document-probe')?.textContent ?? '')).toContain('Dinner Finder');
  await page.getByRole('button', { name: 'Options' }).click();
  await expect(page.locator('#contract-summary [data-contract-row="ward"]')).toContainText('default');
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

test('generation shows the fingerprint-derived drafting surface until the artifact renders', async ({ page }) => {
  // Slow the stream so the drafting window is observable: status events flush
  // immediately, the artifact arrives after a delay.
  await page.route('**/api/generate', async (route) => {
    const statusLines = jsonl([
      { op: 'meta', path: '/ghost-token-source', value: { kind: 'css', source: 'test', css: ':root { --color-accent: #ff2244; --color-bg: #10131c; --color-text: #e8ecf4; }' } },
      { op: 'meta', path: '/surface-plan', value: hostSearchPlan },
      { op: 'event', path: '/surface', value: { type: 'surface.status', status: 'drafting', text: 'Composing Surface Document bundle' } },
    ]);
    const artifactLines = jsonl([
      { op: 'event', path: '/surface', value: { type: 'surface.status', status: 'rendering', text: 'Rendering accepted Surface Document artifact' } },
      surfaceDocumentArtifact({
        html: '<main id="drafting-probe"><h1>Done</h1></main>',
        css: '#drafting-probe { color: var(--color-text, #111); }',
      }),
      streamGraphSummary(),
    ]);
    // Playwright's route.fulfill cannot stream, so serve status lines and the
    // artifact in one body but assert drafting via the pre-navigation state:
    // the drafting surface must exist before #go is clicked (mount-time paint)
    // and depart once the artifact renders.
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.fulfill({ status: 200, contentType: 'text/plain', body: statusLines + artifactLines });
  });

  await page.goto('/generate');

  // Mount-time drafting surface, before any generation begins.
  const drafting = page.locator('#sandbox [data-summon-preview-root]');
  await expect(drafting).toBeAttached();
  await expect(drafting).toHaveClass(/summon-drafting/);
  await expect(drafting.locator('.summon-drafting__apparition')).toBeAttached();

  await page.locator('#go').click();

  // The sandbox frame is visible during generation (no app-level overlay
  // occludes it), and the drafting surface is still the live layer.
  await expect(page.locator('#welcome')).toBeHidden();
  await expect(page.locator('[data-summon-host-loader]')).toHaveCount(0);
  await expect(drafting).toBeAttached();

  // After the artifact renders, the drafting surface departs.
  const mountedSurface = page.locator('#sandbox .summon-surface-document-host');
  await expect(mountedSurface).toHaveCount(1, { timeout: 20_000 });
  await expect.poll(async () => mountedSurface.evaluate((host) => host.shadowRoot?.querySelector('#drafting-probe')?.textContent ?? '')).toContain('Done');
  await expect(drafting).toHaveCount(0);
});

test('generate page surfaces syntax validation blocks instead of mounting malformed source', async ({ page }) => {
  const malformedIssue = {
    source: 'protocol',
    severity: 'block',
    code: 'invalid-surface-document-source-syntax',
    path: '/artifact/main.js',
    message: 'Surface Document source syntax error in main.js:2:24: Unterminated string literal.\n\nSource excerpt:\n  1 | const s = state({});\n> 2 | s.title = "broken;',
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
            codes: { 'invalid-surface-document-source-syntax': 1 },
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
    'Generation blocked before a validated Surface Document artifact was accepted',
  );
  await expect(page.locator('#stage-notice')).toContainText('invalid-surface-document-source-syntax');
  await expect(page.locator('#stage-notice')).toContainText('Source excerpt');
  await expect(page.locator('#sandbox .summon-surface-document-host')).toHaveCount(0);
  await page.locator('#open-diagnostics').click();
  await expect(page.locator('#diagnostics-stream')).toBeVisible();
  await expect(page.locator('#log')).toContainText('invalid-surface-document-source-syntax');
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
  await page.getByRole('button', { name: '401k explainer', exact: true }).click();
  await page.locator('#go').click();

  await expect(page.locator('#stage-notice')).toBeVisible();
  await expect(page.locator('#stage-notice')).toContainText('Generation failed');
  await expect(page.locator('#stage-notice')).toContainText('model provider could not produce a surface');
  await page.locator('#open-diagnostics').click();
  await expect(page.locator('#diagnostics-stream')).toBeVisible();
  await expect(page.locator('#log')).toContainText('model provider could not produce a surface');
});

test('surface-document renders in shadow DOM and contains hostile host CSS', async ({ page }) => {
  await page.route('**/api/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: jsonl([
        { op: 'meta', path: '/surface-plan', value: { ...hostSearchPlan, runtime: 'surface-document' } },
        surfaceDocumentArtifact({
          html: '<main class="sd-card"><p id="sd-count">0</p><button id="sd-inc">Increment</button></main>',
          css: ':root { --sd-blue: rgb(0, 0, 255); } .sd-card { color: var(--sd-blue); } button { border-radius: 17px; }',
          js: `
            const s = state({ count: 0 });
            document.getElementById('sd-count').textContent = () => String(s.count);
            document.getElementById('sd-inc').onclick = () => { s.count += 1; };
          `,
        }),
        { op: 'meta', path: '/stream-graph-summary', value: { health: { complete: true, blockedCount: 0, warningCount: 0 }, artifacts: [{ revision: 1, runtime: 'surface-document', bytes: 1 }] } },
      ]),
    });
  });

  await page.goto('/generate');
  await page.addStyleTag({ content: '.sd-card { color: rgb(255, 0, 0) !important; } #sd-inc { border-radius: 0px !important; }' });
  await page.locator('#go').click();

  await expect(page.locator('#surface-status')).toContainText(/Done/i, { timeout: 20_000 });
  await expect(page.locator('#sandbox .summon-surface-document-host')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => document.getElementById('sandbox')?.querySelector('#sd-count') === null)).toBe(true);

  const shadowResult = await page.locator('#sandbox .summon-surface-document-host').evaluate(async (host) => {
    const shadow = (host as HTMLElement).shadowRoot;
    if (!shadow) throw new Error('missing shadow root');
    const card = shadow.querySelector('.sd-card') as HTMLElement | null;
    const count = shadow.querySelector('#sd-count') as HTMLElement | null;
    const button = shadow.querySelector('#sd-inc') as HTMLButtonElement | null;
    const artifactStyle = shadow.querySelector('style[data-summon-shadow-artifact-css]');
    if (!card || !count || !button || !artifactStyle) throw new Error('missing shadow content');
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 50));
    return {
      countText: count.textContent,
      cardColor: getComputedStyle(card).color,
      buttonRadius: getComputedStyle(button).borderRadius,
      styleText: artifactStyle.textContent ?? '',
    };
  });

  expect(shadowResult.countText).toBe('1');
  expect(shadowResult.cardColor).toBe('rgb(0, 0, 255)');
  expect(shadowResult.buttonRadius).toBe('17px');
  expect(shadowResult.styleText).not.toContain('data-summon-surface');
});

test('adversarial Summon sandbox boundary rejects ambient browser globals and ungranted tools', async ({ page }) => {
  await page.goto('/adversarial');

  const summary = page.locator('#summary');
  await expect(summary).toContainText('Sandbox boundary holding.', { timeout: 30_000 });
  await expect(summary).toContainText(/All \d+ tests passed/);
  const passedCount = Number((await summary.textContent())?.match(/All (\d+) tests passed/)?.[1] ?? 0);
  expect(passedCount).toBeGreaterThanOrEqual(25);
  await expect(page.locator('#results .fail')).toHaveCount(0);

  const results = page.locator('#results');
  await expect(results).toContainText('global-window');
  await expect(results).toContainText('document-body');
  await expect(results).toContainText('tool="exfiltrate"');
  await expect(results).toContainText('tool="escalate"');
});

test('unknown demo routes redirect to the current generate workbench', async ({ page }) => {
  await page.goto('/unknown-route');

  await expect(page).toHaveURL(/\/generate$/);
  await expect(page.locator('#sandbox')).toHaveAttribute('data-summon-surface', /.+/);
  await expect(page.getByRole('button', { name: 'Hike finder', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
