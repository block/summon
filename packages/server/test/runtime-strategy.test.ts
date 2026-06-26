import assert from 'node:assert/strict';
import test from 'node:test';
import { runSurfaceGeneration, type SurfaceModelProvider } from '../src/index.ts';
import { ArrowControlStrategy } from '../src/runtime/arrow-control.ts';
import { HtmlBundleStrategy } from '../src/runtime/html-bundle.ts';
import { HtmlStreamStrategy } from '../src/runtime/html-stream.ts';
import { createRuntimeStrategy } from '../src/runtime/strategy.ts';

const minimalProvider: SurfaceModelProvider = {
  async generateArrowBundle() {
    return {
      schema: 'summon.arrow-bundle/v1',
      source: {
        'main.ts': 'import { html } from "@arrow-js/core";\nexport default html`<p>Hello</p>`;',
      },
    };
  },
};

test('runtime strategy factory maps active runtimes', () => {
  assert.ok(createRuntimeStrategy('arrow-control') instanceof ArrowControlStrategy);
  assert.ok(createRuntimeStrategy('html-static') instanceof HtmlBundleStrategy);
  assert.ok(createRuntimeStrategy('html-stream') instanceof HtmlStreamStrategy);
});

test('HTML bundle strategy never enables generated scripts', () => {
  const htmlStatic = createRuntimeStrategy('html-static');
  assert.ok(htmlStatic instanceof HtmlBundleStrategy);
  assert.equal(htmlStatic.allowScript, false);
});

test('HTML bundle strategy blocks when provider lacks generateHtmlBundle', async () => {
  const lines = [];
  const summary = await runSurfaceGeneration({
    prompt: 'html without provider',
    experimentalRuntime: 'html-static',
    playground: true,
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: minimalProvider,
  }, (line) => {
    lines.push(line);
  });

  assert.equal(summary.blocked, true);
  assert.ok(summary.validationIssues.some((issue) => issue.code === 'missing-html-provider'));
  assert.equal(lines.some((line) => line.op === 'artifact'), false);
});

test('HTML stream strategy blocks when provider lacks streamHtmlSurface', async () => {
  const lines = [];
  const summary = await runSurfaceGeneration({
    prompt: 'html stream without provider',
    experimentalRuntime: 'html-stream',
    playground: true,
    surfacePolicy: { tier: 'static', purpose: 'inform' },
    modelProvider: minimalProvider,
  }, (line) => {
    lines.push(line);
  });

  assert.equal(summary.blocked, true);
  assert.ok(summary.validationIssues.some((issue) => issue.code === 'missing-html-stream-provider'));
  assert.equal(lines.some((line) => line.op === 'artifact'), false);
});


