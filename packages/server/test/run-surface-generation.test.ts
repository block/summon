import assert from 'node:assert/strict';
import test from 'node:test';
import {
  runSurfaceGeneration,
  type ProtocolLine,
  type SurfaceModelProvider,
} from '../src/index.ts';

const validProvider: SurfaceModelProvider = {
  async generateArrowBundle() {
    return {
      schema: 'summon.arrow-bundle/v1',
      preview: {
        kind: 'inform',
        title: 'Hello',
        regions: [{ id: 'body', role: 'content', label: 'Body' }],
      },
      source: {
        'main.ts': 'import { html } from "@arrow-js/core";\nexport default html`<p>Hello</p>`;',
      },
    };
  },
};

function withoutTiming(lines: readonly ProtocolLine[]): ProtocolLine[] {
  return lines.filter((line) => !(line.op === 'meta' && line.path === '/timing'));
}

test('runSurfaceGeneration emits server-owned preview and artifact lines', async () => {
  const lines: ProtocolLine[] = [];
  const summary = await runSurfaceGeneration({
    prompt: 'hello',
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: validProvider,
  }, (line) => {
    lines.push(line);
  });

  assert.equal(summary.blocked, false);
  assert.ok(lines.some((line) => line.op === 'meta' && line.path === '/model-output-mode'));
  assert.ok(lines.some((line) => line.op === 'event' && line.path === '/surface'));
  assert.ok(lines.some((line) => line.op === 'artifact' && line.path === '/artifact'));
  assert.deepEqual(summary.acceptedLines.map((line) => line.op), ['event', 'event', 'event', 'event', 'event', 'artifact']);
  assert.deepEqual(withoutTiming(lines).slice(0, 5).map((line) => `${line.op} ${line.path}`), [
    'meta /surface-policy',
    'meta /surface-plan',
    'meta /surface-contract',
    'meta /model-output-mode',
    'event /surface',
  ]);
});

test('runSurfaceGeneration emits experimental HTML artifacts when requested', async () => {
  const lines: ProtocolLine[] = [];
  let capturedSystemText = '';
  let streamed = false;
  const provider: SurfaceModelProvider = {
    async generateArrowBundle() {
      throw new Error('Arrow provider should not be used for html-static');
    },
    async *streamHtmlSurface() {
      streamed = true;
      throw new Error('streamHtmlSurface should not be used for html-static');
    },
    async generateHtmlBundle(request) {
      assert.equal(request.runtime, 'html-static');
      assert.equal(request.schema.properties && typeof request.schema.properties === 'object', true);
      capturedSystemText = request.promptBlocks.map((block) => block.text).join('\n');
      return {
        schema: 'summon.html-bundle/v0',
        preview: {
          kind: 'inform',
          title: 'HTML',
          regions: [{ id: 'hero', role: 'summary', label: 'Hero' }],
        },
        source: {
          'body.html': '<section id="hero"><h1>HTML</h1></section>',
          'main.css': '#hero { color: var(--color-text); }',
        },
      };
    },
  };

  const summary = await runSurfaceGeneration({
    prompt: 'hello html',
    experimentalRuntime: 'html-static',
    surfacePolicy: { tier: 'declarative', purpose: 'explore', grants: ['search'] },
    tools: {
      tools: [
        {
          name: 'search',
          description: 'Search host-owned data.',
          argsSchema: '{query: string}',
          stateShape: '{loading: boolean, results: unknown[]}',
          kind: 'resource',
          triggers: ['submit'],
          stateKeys: { loading: 'loading', data: 'results', error: 'error' },
          surface: { data: 'host-resource', authority: 'read' },
        },
      ],
    },
    modelProvider: provider,
  }, (line) => lines.push(line));

  assert.equal(summary.blocked, false);
  assert.equal(streamed, false);
  assert.match(capturedSystemText, /create_summon_html_surface/);
  assert.match(capturedSystemText, /host-owned context for static HTML/);
  assert.match(capturedSystemText, /does not receive a host tool bridge/);
  assert.doesNotMatch(capturedSystemText, /create_summon_arrow_surface/);
  assert.doesNotMatch(capturedSystemText, /host-bridge:summon/);
  assert.doesNotMatch(capturedSystemText, /@arrow-js\/core/);
  assert.doesNotMatch(capturedSystemText, /Runtime is always `arrow`/);
  assert.doesNotMatch(capturedSystemText, /Arrow artifact/);
  assert.ok(lines.some((line) => line.op === 'meta' && line.path === '/model-output-mode' && (line.value as { runtime?: unknown }).runtime === 'html-static'));
  const artifact = lines.find((line) => line.op === 'artifact');
  assert.equal((artifact?.value as { runtime?: unknown } | undefined)?.runtime, 'html');
});

test('runSurfaceGeneration streams html-stream preview deltas before validated patch commits', async () => {
  const lines: ProtocolLine[] = [];
  let generatedHtmlBundle = false;
  let capturedSystemText = '';
  const provider: SurfaceModelProvider = {
    async generateArrowBundle() {
      throw new Error('Arrow provider should not be used for html-stream');
    },
    async generateHtmlBundle() {
      generatedHtmlBundle = true;
      throw new Error('generateHtmlBundle should not be used for html-stream');
    },
    async *streamHtmlSurface(request) {
      assert.equal(request.runtime, 'html-stream');
      capturedSystemText = request.promptBlocks.map((block) => block.text).join('\n');
      yield '@@summon-html-scaffold\n{"schema":"summon.html-bundle/v0","preview":{"kind":"inform","title":"Stream"},"source":{"body.html":"<main><section id=\\"hero\\"></section></main>","main.css":"#hero{color:var(--color-text)}"}}\n@@end-summon-html-scaffold\n';
      yield '@@summon-html-patch target="hero" action="replace"\n<section id="hero">';
      yield '<h2>Updated</h2></section>';
      yield '\n@@end-summon-html-patch\n';
    },
  };

  const summary = await runSurfaceGeneration({
    prompt: 'stream html',
    experimentalRuntime: 'html-stream',
    playground: true,
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: provider,
  }, (line) => lines.push(line));

  assert.equal(summary.blocked, false);
  assert.equal(generatedHtmlBundle, false);
  assert.match(capturedSystemText, /Experimental HTML stream protocol/);
  const artifactIndex = lines.findIndex((line) => line.op === 'artifact');
  const firstPreviewIndex = lines.findIndex((line) => line.op === 'meta' && line.path === '/html-stream-preview');
  const patchIndex = lines.findIndex((line) => line.op === 'patch' && line.path === '/artifact/html-patch');
  assert.ok(artifactIndex >= 0);
  assert.ok(firstPreviewIndex > artifactIndex);
  assert.ok(patchIndex > firstPreviewIndex);
  assert.deepEqual((lines[patchIndex]?.value as { target?: unknown; action?: unknown }), {
    runtime: 'html',
    action: 'replace',
    target: 'hero',
    html: '<section id="hero"><h2>Updated</h2></section>\n',
  });
  assert.ok(lines.some((line) => line.op === 'meta' && line.path === '/html-stream-summary' && (line.value as { committedPatchCount?: unknown }).committedPatchCount === 1));
});

test('runSurfaceGeneration keeps unsafe html-stream text preview-only and blocks the committed fragment', async () => {
  const lines: ProtocolLine[] = [];
  const provider: SurfaceModelProvider = {
    async generateArrowBundle() {
      throw new Error('Arrow provider should not be used for html-stream');
    },
    async *streamHtmlSurface() {
      yield '@@summon-html-scaffold\n{"schema":"summon.html-bundle/v0","source":{"body.html":"<main><section id=\\"hero\\"></section></main>"}}\n@@end-summon-html-scaffold\n';
      yield '@@summon-html-patch target="hero" action="replace"\n<img src="https://example.test/a.png" alt="x">';
      yield '\n@@end-summon-html-patch\n';
    },
  };

  const summary = await runSurfaceGeneration({
    prompt: 'unsafe stream html',
    experimentalRuntime: 'html-stream',
    playground: true,
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: provider,
  }, (line) => lines.push(line));

  assert.equal(summary.blocked, true);
  assert.ok(lines.some((line) => line.op === 'meta' && line.path === '/html-stream-preview'));
  assert.equal(lines.some((line) => line.op === 'patch' && line.path === '/artifact/html-patch'), false);
  assert.ok(summary.validationIssues.some((issue) => issue.code === 'external-url'));
  assert.ok(lines.some((line) => line.op === 'meta' && line.path === '/validation-blocked' && (line.value as { code?: unknown }).code === 'external-url'));
});

test('runSurfaceGeneration blocks html-stream output without a scaffold frame', async () => {
  const lines: ProtocolLine[] = [];
  const provider: SurfaceModelProvider = {
    async generateArrowBundle() {
      throw new Error('Arrow provider should not be used for html-stream');
    },
    async *streamHtmlSurface() {
      yield '@@summon-html-patch target="hero" action="replace"\n<p>Patch before scaffold</p>\n@@end-summon-html-patch\n';
    },
  };

  const summary = await runSurfaceGeneration({
    prompt: 'missing scaffold',
    experimentalRuntime: 'html-stream',
    playground: true,
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: provider,
  }, (line) => lines.push(line));

  assert.equal(summary.blocked, true);
  assert.ok(summary.validationIssues.some((issue) => issue.code === 'missing-html-stream-scaffold'));
  assert.equal(lines.some((line) => line.op === 'artifact'), false);
});

test('runSurfaceGeneration repairs invalid structured bundle', async () => {
  const lines: ProtocolLine[] = [];
  let repaired = false;
  const provider: SurfaceModelProvider = {
    async generateArrowBundle() {
      return {
        schema: 'summon.arrow-bundle/v1',
        source: {
          'main.ts': 'import { html } from "@arrow-js/core";\nexport default html`<button ${() => "disabled"}>Save</button>`;',
        },
      };
    },
    async repairArrowBundle(request) {
      repaired = true;
      assert.equal(request.issues[0]?.code, 'unsupported-arrow-open-tag-expression');
      assert.ok(request.hints.length > 0);
      return {
        schema: 'summon.arrow-bundle/v1',
        source: {
          'main.ts': 'import { html } from "@arrow-js/core";\nexport default html`<button class="save">Save</button>`;',
        },
      };
    },
  };

  const summary = await runSurfaceGeneration({
    prompt: 'repair',
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: provider,
  }, (line) => lines.push(line));

  assert.equal(repaired, true);
  assert.equal(summary.blocked, false);
  assert.ok(summary.validationIssues.some((issue) => issue.code === 'unsupported-arrow-open-tag-expression'));
  assert.ok(lines.some((line) => line.op === 'artifact'));
});

test('runSurfaceGeneration repairs Arrow source syntax errors before runtime', async () => {
  const lines: ProtocolLine[] = [];
  let repaired = false;
  const provider: SurfaceModelProvider = {
    async generateArrowBundle() {
      return {
        schema: 'summon.arrow-bundle/v1',
        source: {
          'main.ts': 'import { html } from "@arrow-js/core";\nexport default html`<p>${() => "broken}</p>`;',
        },
      };
    },
    async repairArrowBundle(request) {
      repaired = true;
      assert.equal(request.issues[0]?.code, 'invalid-arrow-source-syntax');
      assert.ok(request.hints.some((hint) => hint.includes('syntax error')));
      return {
        schema: 'summon.arrow-bundle/v1',
        source: {
          'main.ts': 'import { html } from "@arrow-js/core";\nexport default html`<p>${() => "Fixed"}</p>`;',
        },
      };
    },
  };

  const summary = await runSurfaceGeneration({
    prompt: 'repair syntax',
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: provider,
  }, (line) => lines.push(line));

  assert.equal(repaired, true);
  assert.equal(summary.blocked, false);
  assert.ok(summary.validationIssues.some((issue) => issue.code === 'invalid-arrow-source-syntax'));
  assert.ok(lines.some((line) => line.op === 'artifact'));
});

test('runSurfaceGeneration blocks Arrow source syntax errors in observe mode without repair', async () => {
  const lines: ProtocolLine[] = [];
  const provider: SurfaceModelProvider = {
    async generateArrowBundle() {
      return {
        schema: 'summon.arrow-bundle/v1',
        source: {
          'main.ts': 'import { html } from "@arrow-js/core";\nexport default html`<p>${() => "broken}</p>`;',
        },
      };
    },
  };

  const summary = await runSurfaceGeneration({
    prompt: 'observe syntax',
    playground: true,
    validationMode: 'observe',
    maxRepairAttempts: 0,
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: provider,
  }, (line) => lines.push(line));

  assert.equal(summary.blocked, true);
  const syntaxIssue = summary.validationIssues.find((issue) => issue.code === 'invalid-arrow-source-syntax');
  assert.ok(syntaxIssue);
  assert.match(syntaxIssue.message, /main\.ts:2:/);
  assert.match(syntaxIssue.message, /Source excerpt:/);
  assert.ok(lines.some((line) => line.op === 'meta' && line.path === '/validation-blocked'));
  assert.equal(lines.some((line) => line.op === 'artifact'), false);
});

test('runSurfaceGeneration can restrict repair attempts to selected issue codes', async () => {
  const lines: ProtocolLine[] = [];
  let repaired = false;
  const provider: SurfaceModelProvider = {
    async generateArrowBundle() {
      return {
        schema: 'summon.arrow-bundle/v1',
        source: {
          'main.ts': 'import { html } from "@arrow-js/core";\nexport default html`<button ${() => "disabled"}>Save</button>`;',
        },
      };
    },
    async repairArrowBundle() {
      repaired = true;
      return validProvider.generateArrowBundle({ prompt: '', promptBlocks: [], schema: {} });
    },
  };

  const summary = await runSurfaceGeneration({
    prompt: 'observe subset blocker',
    playground: true,
    validationMode: 'observe',
    maxRepairAttempts: 1,
    repairIssueCodes: ['invalid-arrow-source-syntax'],
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: provider,
  }, (line) => lines.push(line));

  assert.equal(repaired, false);
  assert.equal(summary.blocked, false);
  assert.ok(summary.validationIssues.some((issue) => issue.code === 'unsupported-arrow-open-tag-expression'));
  assert.ok(lines.some((line) => line.op === 'meta' && line.path === '/validation-observed'));
  assert.ok(lines.some((line) => line.op === 'artifact'));
});

test('runSurfaceGeneration repairs invalid entry-file bundles', async () => {
  const lines: ProtocolLine[] = [];
  let repaired = false;
  const provider: SurfaceModelProvider = {
    async generateArrowBundle() {
      return {
        schema: 'summon.arrow-bundle/v1',
        source: {
          'main.ts': 'export {}',
          'main.js': 'export {}',
        },
      };
    },
    async repairArrowBundle(request) {
      repaired = true;
      assert.equal(request.issues[0]?.code, 'invalid-arrow-bundle-entry');
      assert.ok(request.hints.some((hint) => hint.includes('exactly one Arrow entry file')));
      return {
        schema: 'summon.arrow-bundle/v1',
        source: {
          'main.ts': 'import { html } from "@arrow-js/core";\nexport default html`<p>Repaired</p>`;',
        },
      };
    },
  };

  const summary = await runSurfaceGeneration({
    prompt: 'repair entry files',
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: provider,
  }, (line) => lines.push(line));

  assert.equal(repaired, true);
  assert.equal(summary.blocked, false);
  assert.ok(lines.some((line) => line.op === 'artifact'));
  const diagnostics = lines.filter((line) => line.op === 'meta' && line.path === '/arrow-bundle-diagnostic');
  assert.equal(diagnostics.length, 2);
  assert.deepEqual((diagnostics[0]?.value as { entryKeys?: unknown }).entryKeys, ['main.js', 'main.ts']);
  assert.deepEqual((diagnostics[1]?.value as { entryKeys?: unknown }).entryKeys, ['main.ts']);
});

test('runSurfaceGeneration blocks invalid bundle when repair is unavailable', async () => {
  const lines: ProtocolLine[] = [];
  const provider: SurfaceModelProvider = {
    async generateArrowBundle() {
      return {
        schema: 'summon.arrow-bundle/v1',
        source: {
          'main.ts': 'export {}',
          'main.js': 'export {}',
        },
      };
    },
  };

  const summary = await runSurfaceGeneration({
    prompt: 'bad',
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: provider,
    maxRepairAttempts: 0,
  }, (line) => lines.push(line));

  assert.equal(summary.blocked, true);
  assert.ok(summary.validationIssues.some((issue) => issue.code === 'invalid-arrow-bundle-entry'));
  assert.ok(lines.some((line) => line.op === 'meta' && line.path === '/validation-blocked'));
  assert.equal(lines.some((line) => line.op === 'artifact'), false);
});

test('runSurfaceGeneration emits heartbeat while provider is slow', async () => {
  const lines: ProtocolLine[] = [];
  const provider: SurfaceModelProvider = {
    async generateArrowBundle() {
      await new Promise((resolve) => setTimeout(resolve, 35));
      return {
        schema: 'summon.arrow-bundle/v1',
        source: {
          'main.ts': 'import { html } from "@arrow-js/core";\nexport default html`<p>Slow</p>`;',
        },
      };
    },
  };

  const summary = await runSurfaceGeneration({
    prompt: 'slow',
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: provider,
    heartbeatIntervalMs: 10,
  }, (line) => lines.push(line));

  assert.equal(summary.blocked, false);
  assert.ok(lines.some((line) => line.op === 'event' && line.path === '/surface' && (line.value as { text?: unknown }).text === 'Still composing Arrow bundle'));
  assert.ok(lines.some((line) => line.op === 'meta' && line.path === '/timing' && (line.value as { phase?: unknown }).phase === 'bundle-received'));
});

test('runSurfaceGeneration emits fallback preview for artifact-only bundles', async () => {
  const lines: ProtocolLine[] = [];
  const summary = await runSurfaceGeneration({
    prompt: 'artifact only',
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: {
      async generateArrowBundle() {
        return {
          schema: 'summon.arrow-bundle/v1',
          source: {
            'main.ts': 'import { html } from "@arrow-js/core";\nexport default html`<p>Artifact only</p>`;',
          },
        };
      },
    },
  }, (line) => lines.push(line));

  assert.equal(summary.blocked, false);
  assert.ok(lines.some((line) => line.op === 'event' && line.path === '/surface' && (line.value as { text?: unknown }).text === 'Rendering accepted Arrow artifact'));
});

test('runSurfaceGeneration playground mode skips preview scaffold and preview bundle events', async () => {
  const lines: ProtocolLine[] = [];
  const summary = await runSurfaceGeneration({
    prompt: 'playground artifact only',
    playground: true,
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: validProvider,
  }, (line) => lines.push(line));

  assert.equal(summary.blocked, false);
  assert.deepEqual(summary.acceptedLines.map((line) => line.op), ['artifact']);
  assert.equal(lines.some((line) => line.op === 'event' && line.path === '/surface' && (line.value as { type?: unknown }).type === 'surface.start'), false);
  assert.equal(lines.some((line) => line.op === 'event' && line.path === '/surface' && (line.value as { type?: unknown }).type === 'region.add'), false);
  assert.ok(lines.some((line) => line.op === 'artifact' && line.path === '/artifact'));
});

test('runSurfaceGeneration observe mode accepts renderable artifacts with validation blockers', async () => {
  const lines: ProtocolLine[] = [];
  let repaired = false;
  const provider: SurfaceModelProvider = {
    async generateArrowBundle() {
      return {
        schema: 'summon.arrow-bundle/v1',
        source: {
          'main.ts': 'import { html } from "@arrow-js/core";\nexport default html`<button ${() => "disabled"}>Save</button>`;',
        },
      };
    },
    async repairArrowBundle() {
      repaired = true;
      return validProvider.generateArrowBundle({ prompt: '', promptBlocks: [], schema: {} });
    },
  };

  const summary = await runSurfaceGeneration({
    prompt: 'observe blocker',
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    validationMode: 'observe',
    maxRepairAttempts: 0,
    modelProvider: provider,
  }, (line) => lines.push(line));

  assert.equal(summary.blocked, false);
  assert.equal(repaired, false);
  assert.ok(summary.validationIssues.some((issue) => issue.code === 'unsupported-arrow-open-tag-expression'));
  assert.ok(lines.some((line) => line.op === 'meta' && line.path === '/validation-observed'));
  assert.ok(lines.some((line) => line.op === 'artifact' && line.path === '/artifact'));
});

test('runSurfaceGeneration observe mode does not preflight-block policy issues', async () => {
  const lines: ProtocolLine[] = [];
  const summary = await runSurfaceGeneration({
    prompt: 'unknown grant',
    surfacePolicy: { tier: 'declarative', purpose: 'explore', grants: ['missing'] },
    validationMode: 'observe',
    maxRepairAttempts: 0,
    modelProvider: validProvider,
  }, (line) => lines.push(line));

  assert.equal(summary.blocked, false);
  assert.ok(summary.validationIssues.some((issue) => issue.code === 'surface-policy-unknown-grant'));
  assert.ok(lines.some((line) => line.op === 'meta' && line.path === '/validation-observed'));
  assert.ok(lines.some((line) => line.op === 'artifact' && line.path === '/artifact'));
});
