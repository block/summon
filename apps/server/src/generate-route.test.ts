import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer, type IncomingMessage } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import type {
  ToolPack,
  ProtocolLine,
  SurfacePlan,
} from '@anarchitecture/summon/engine';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, '..');
const workspaceRoot = resolve(packageRoot, '..', '..');

const searchTools: ToolPack = {
  tools: [{
    name: 'search',
    description: 'Search host-owned dinner data.',
    argsSchema: '{"query":"string"}',
    stateShape: '{"results":"array"}',
    kind: 'resource',
    triggers: ['submit', 'mount'],
    stateKeys: { loading: 'loading', data: 'results', error: 'error' },
    surface: { data: 'host-resource', authority: 'read' },
  }],
};

const surfacePlan: SurfacePlan = {
  purpose: 'explore',
  runtime: 'arrow',
  data: 'host-resource',
  authority: 'read',
  persistence: 'replayable',
  network: 'none',
};

function arrowBundle(html: string) {
  const source = html.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  return {
    schema: 'summon.arrow-bundle/v1',
    source: {
      'main.ts': `import { html } from "@arrow-js/core";\nexport default html\`<main class="surface test-fingerprint-shell">${source}</main>\`;`,
      'main.css': `.surface.test-fingerprint-shell { min-height: 100%; padding: var(--space-6); color: var(--color-text); background: var(--color-bg); font-family: var(--font-sans); display: grid; gap: var(--space-4); border: 1px solid var(--color-border); } .surface.test-fingerprint-shell h1 { margin: 0; font-size: var(--text-xl); letter-spacing: var(--tracking-tight); line-height: var(--leading-section); } .surface.test-fingerprint-shell p { margin: 0; color: var(--color-text-muted); } /* Ghost fixture vocabulary: compact editorial brief dominant newspaper claim short evidence bands clear next action comparison layouts tradeoffs visible shared criteria compact editorial spread columns rows aligned criteria strong horizontal vertical rules recommended option border weight ink block editorial label square panels ruled evidence folio broadsheet ledger shell compact metadata comparison row status current state compact exacting workflows quiet density queue var(--color-surface) var(--color-accent) var(--space-5) var(--space-8) var(--radius-lg). */`,
    },
  };
}

function anthropicBundleMessage(id: string, html: string, model = 'claude-opus-4-8') {
  return {
    id,
    type: 'message',
    role: 'assistant',
    model,
    content: [{
      type: 'tool_use',
      id: `${id}_tool`,
      name: 'create_summon_arrow_surface',
      input: arrowBundle(html),
    }],
    stop_reason: 'tool_use',
    stop_sequence: null,
    usage: { input_tokens: 12, output_tokens: 24 },
  };
}

function htmlBundle(html: string) {
  return {
    schema: 'summon.html-bundle/v0',
    preview: {
      kind: 'inform',
      title: 'HTML dinner finder',
      regions: [{ id: 'hero', role: 'summary', label: 'Hero' }],
    },
    source: {
      'body.html': html,
      'main.css': '#hero { color: var(--color-text); background: var(--color-bg); }',
    },
  };
}

function anthropicHtmlBundleMessage(id: string, html: string, model = 'claude-opus-4-8') {
  return {
    id,
    type: 'message',
    role: 'assistant',
    model,
    content: [{
      type: 'tool_use',
      id: `${id}_tool`,
      name: 'create_summon_html_surface',
      input: htmlBundle(html),
    }],
    stop_reason: 'tool_use',
    stop_sequence: null,
    usage: { input_tokens: 12, output_tokens: 24 },
  };
}

function openAIResponseBundle(html: string) {
  return {
    output: [{
      type: 'function_call',
      name: 'create_summon_arrow_surface',
      arguments: JSON.stringify(arrowBundle(html)),
    }],
    usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
  };
}

function geminiResponseBundle(html: string) {
  return {
    candidates: [{
      content: {
        parts: [{
          functionCall: {
            name: 'create_summon_arrow_surface',
            args: arrowBundle(html),
          },
        }],
      },
    }],
    usageMetadata: {
      promptTokenCount: 11,
      candidatesTokenCount: 21,
      totalTokenCount: 32,
    },
  };
}

function lineRefs(lines: ProtocolLine[]): string[] {
  return lines.map((line) => `${line.op} ${line.path}`);
}

function withoutTiming(lines: readonly ProtocolLine[]): ProtocolLine[] {
  return lines.filter((line) => !(line.op === 'meta' && line.path === '/timing'));
}

function timingValues(lines: readonly ProtocolLine[]): Array<Record<string, unknown>> {
  return lines.flatMap((line) => (
    line.op === 'meta' && line.path === '/timing' && line.value && typeof line.value === 'object'
      ? [line.value as Record<string, unknown>]
      : []
  ));
}

function phaseStatuses(lines: ProtocolLine[]): string[] {
  return lines.flatMap((line) => {
    if (line.op !== 'event' || line.path !== '/surface') return [];
    const value = line.value as { type?: unknown; status?: unknown } | undefined;
    return value?.type === 'surface.status' && typeof value.status === 'string'
      ? [value.status]
      : [];
  });
}

function firstMetaLine(lines: ProtocolLine[], path: string): Extract<ProtocolLine, { op: 'meta' }> {
  const line = lines.find((candidate): candidate is Extract<ProtocolLine, { op: 'meta' }> => (
    candidate.op === 'meta' && candidate.path === path
  ));
  assert.ok(line, `missing meta line ${path}`);
  return line;
}

test('api generate rejects the removed unsafe raw runtime as an unknown runtime value', async (t) => {
  const port = await reservePort();
  const app = spawn(resolveTsxBin(), ['src/main.ts'], {
    cwd: packageRoot,
    env: {
      ...process.env,
      PORT: String(port),
      SUMMON_MODEL_PROVIDER: 'anthropic',
      ANTHROPIC_API_KEY: 'test-key',
      OPENAI_API_KEY: '',
      GEMINI_API_KEY: '',
      GOOGLE_API_KEY: '',
      SUMMON_AGENT_GOAL_MODEL: '0',
      SUMMON_INFER_SHAPE: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output = captureOutput(app);
  t.after(async () => {
    await stopChild(app);
  });
  await waitForHealth(port, app, output);

  for (const runtime of ['unsafe-html-raw-stream', 'html-script']) {
    const response = await fetch(`http://127.0.0.1:${port}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: 'removed runtime',
        fingerprint: { id: 'editorial-mono' },
        experimentalRuntime: runtime,
      }),
    });
    assert.equal(response.status, 400, `runtime ${runtime} should be rejected`);
    assert.match(await response.text(), /experimentalRuntime must be one of/);
  }
});

test('api generate sends narrowed contract and stream meta shape through package runner', async (t) => {
  const anthropicRequests: unknown[] = [];
  const anthropic = createServer(async (req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(404);
      res.end();
      return;
    }
    const request = JSON.parse(await readBody(req));
    anthropicRequests.push(request);
    if (Array.isArray(request.tools)) {
      const toolName = typeof request.tools[0]?.name === 'string'
        ? request.tools[0].name
        : 'create_summon_arrow_surface';
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(
        toolName === 'create_summon_html_surface'
          ? anthropicHtmlBundleMessage('msg_test_html', '<section id="hero"><h1>Dinner finder</h1><p>Ready.</p></section>', request.model)
          : anthropicBundleMessage('msg_test', '<section><h1>Dinner finder</h1><p>Ready.</p></section>', request.model),
      ));
      return;
    }
    const generatedText = [JSON.stringify(arrowBundle('<section><h1>Dinner finder</h1><p>Ready.</p></section>'))];
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    res.end([
      sse('message_start', {
        type: 'message_start',
        message: {
          id: 'msg_test',
          type: 'message',
          role: 'assistant',
          model: 'claude-opus-4-8',
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 12, output_tokens: 0 },
        },
      }),
      sse('content_block_start', {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' },
      }),
      sse('content_block_delta', {
        type: 'content_block_delta',
        index: 0,
        delta: {
          type: 'text_delta',
          text: generatedText[0],
        },
      }),
      sse('content_block_delta', {
        type: 'content_block_delta',
        index: 0,
        delta: {
          type: 'text_delta',
          text: generatedText.slice(1).join(''),
        },
      }),
      sse('content_block_stop', {
        type: 'content_block_stop',
        index: 0,
      }),
      sse('message_delta', {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: { input_tokens: 12, output_tokens: 24 },
      }),
      sse('message_stop', {
        type: 'message_stop',
      }),
    ].join(''));
  });
  await listen(anthropic);
  t.after(async () => {
    await closeServer(anthropic);
  });

  const anthropicPort = addressPort(anthropic);
  const appPort = await reservePort();
  const app = spawn(resolveTsxBin(), ['src/main.ts'], {
    cwd: packageRoot,
    env: {
      ...process.env,
      PORT: String(appPort),
      SUMMON_MODEL_PROVIDER: 'anthropic',
      ANTHROPIC_API_KEY: 'test-key',
      ANTHROPIC_BASE_URL: `http://127.0.0.1:${anthropicPort}`,
      OPENAI_API_KEY: '',
      GEMINI_API_KEY: '',
      GOOGLE_API_KEY: '',
      SUMMON_AGENT_GOAL_MODEL: '0',
      SUMMON_INFER_SHAPE: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output = captureOutput(app);
  t.after(async () => {
    await stopChild(app);
  });
  await waitForHealth(appPort, app, output);

  const response = await fetch(`http://127.0.0.1:${appPort}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: 'build a dinner finder',
      fingerprint: { id: 'editorial-mono' },
      tools: searchTools,
      surfacePolicy: {
        tier: 'declarative',
        purpose: 'explore',
        grants: ['search'],
      },
    }),
  });
  const body = await response.text();
  assert.equal(response.status, 200, body);

  assert.equal(anthropicRequests.length, 1);
  const request = anthropicRequests[0] as {
    model?: string;
    system?: Array<{ text?: string; cache_control?: unknown }>;
    stream?: boolean; tools?: unknown[]; tool_choice?: unknown;
  };
  assert.ok(Array.isArray(request.tools));
  assert.equal(request.model, 'claude-opus-4-8');
  assert.ok(
    (request.system ?? []).filter((block) => block.cache_control !== undefined).length <= 4,
    'Anthropic accepts at most four system blocks with cache_control',
  );
  const systemText = request.system?.map((block) => block.text ?? '').join('\n') ?? '';
  assert.match(systemText, /Search host-owned dinner data/);
  assert.match(systemText, /host-resource/);
  assert.match(systemText, /Arrow-native interactivity/);
  assert.match(systemText, /host-bridge:summon/);
  assert.match(systemText, /onState/);
  assert.match(systemText, /Structured Arrow sandbox bundle/);
  assert.match(systemText, /create_summon_arrow_surface/);
  assert.doesNotMatch(systemText, /Rules for scripts/);
  assert.doesNotMatch(systemText, /\bchoose\b/);

  const lines = body
    .trim()
    .split(/\n/)
    .filter(Boolean)
    .map((raw) => JSON.parse(raw) as ProtocolLine);
  assert.deepEqual(lineRefs(withoutTiming(lines)).slice(0, 12), [
    'event /surface',
    'meta /status',
    'event /surface',
    'meta /status',
    'event /surface',
    'meta /status',
    'meta /ghost-context',
    'meta /ghost-token-source',
    'meta /surface-policy',
    'meta /surface-plan',
    'meta /surface-contract',
    'meta /model-output-mode',
  ]);
  assert.deepEqual(phaseStatuses(lines), ['planning', 'contract', 'contract', 'drafting', 'validating', 'rendering', 'rendering', 'finalizing']);
  assert.equal(lines[1]?.op, 'meta');
  assert.equal((lines[1] as Extract<ProtocolLine, { op: 'meta' }>).value, 'planning');
  assert.deepEqual(firstMetaLine(lines, '/surface-plan').value, surfacePlan);
  assert.ok(lines.some((line) => line.op === 'artifact' && line.path === '/artifact'));
  assert.ok(withoutTiming(lines).some((line) => line.path === '/stream-graph-summary'));
  assert.equal(lines.some((line) => line.path === '/error'), false);

  const policyResponse = await fetch(`http://127.0.0.1:${appPort}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: 'build a dinner finder where i can search',
      fingerprint: { id: 'editorial-mono' },
      surfacePolicy: {
        tier: 'declarative',
        purpose: 'explore',
        grants: ['search'],
      },
      tools: searchTools,
    }),
  });
  const policyBody = await policyResponse.text();
  assert.equal(policyResponse.status, 200, policyBody);

  assert.equal(anthropicRequests.length, 2);
  const policyRequest = anthropicRequests[1] as { system?: Array<{ text?: string }>; tools?: unknown[] };
  assert.ok(Array.isArray(policyRequest.tools));
  const policySystemText = policyRequest.system?.map((block) => block.text ?? '').join('\n') ?? '';
  assert.match(policySystemText, /Search host-owned dinner data/);
  assert.match(policySystemText, /Surface contract/);
  assert.match(policySystemText, /runtime=`arrow`/);
  assert.match(policySystemText, /data=`host-resource`/);
  assert.doesNotMatch(policySystemText, /Rules for scripts/);

  const policyLines = policyBody
    .trim()
    .split(/\n/)
    .filter(Boolean)
    .map((raw) => JSON.parse(raw) as ProtocolLine);
  assert.deepEqual(lineRefs(withoutTiming(policyLines)).slice(0, 12), [
    'event /surface',
    'meta /status',
    'event /surface',
    'meta /status',
    'event /surface',
    'meta /status',
    'meta /ghost-context',
    'meta /ghost-token-source',
    'meta /surface-policy',
    'meta /surface-plan',
    'meta /surface-contract',
    'meta /model-output-mode',
  ]);
  assert.deepEqual(phaseStatuses(policyLines), ['planning', 'contract', 'contract', 'drafting', 'validating', 'rendering', 'rendering', 'finalizing']);
  assert.equal(policyLines.some((line) => line.path === '/mode-upgraded'), false);
  assert.deepEqual(firstMetaLine(policyLines, '/surface-policy').value, {
    tier: 'declarative',
    purpose: 'explore',
    grants: ['search'],
    persistence: 'replayable',
  });
  assert.deepEqual(firstMetaLine(policyLines, '/surface-plan').value, surfacePlan);
  const policyContract = firstMetaLine(policyLines, '/surface-contract').value as {
    tools?: Array<{ name: string }>;
  };
  assert.deepEqual(policyContract.tools?.map((tool) => tool.name), ['search']);

  const agentResponse = await fetch(`http://127.0.0.1:${appPort}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: 'build a dinner finder where i can search recipes',
      fingerprint: { id: 'editorial-mono' },
      tools: searchTools,
      agent: { enabled: true, goalModel: 'off' },
    }),
  });
  const agentBody = await agentResponse.text();
  assert.equal(agentResponse.status, 200, agentBody);

  assert.equal(anthropicRequests.length, 3);
  const agentRequest = anthropicRequests[2] as { system?: Array<{ text?: string }>; tools?: unknown[] };
  assert.ok(Array.isArray(agentRequest.tools));
  const agentSystemText = agentRequest.system?.map((block) => block.text ?? '').join('\n') ?? '';
  assert.match(agentSystemText, /Search host-owned dinner data/);
  assert.match(agentSystemText, /Surface contract/);
  assert.match(agentSystemText, /runtime=`arrow`/);

  const agentLines = agentBody
    .trim()
    .split(/\n/)
    .filter(Boolean)
    .map((raw) => JSON.parse(raw) as ProtocolLine);
  assert.deepEqual(lineRefs(withoutTiming(agentLines)).slice(0, 14), [
    'event /surface',
    'meta /status',
    'event /surface',
    'meta /status',
    'event /surface',
    'meta /status',
    'meta /ghost-context',
    'meta /ghost-token-source',
    'meta /agent-goal',
    'meta /agent-policy-resolution',
    'meta /surface-policy',
    'meta /surface-plan',
    'meta /surface-contract',
    'meta /model-output-mode',
  ]);
  assert.deepEqual(phaseStatuses(agentLines), ['planning', 'contract', 'contract', 'drafting', 'validating', 'rendering', 'rendering', 'finalizing']);
  assert.equal(agentLines.some((line) => line.path === '/mode-upgraded'), false);
  const agentGoal = firstMetaLine(agentLines, '/agent-goal');
  assert.equal((agentGoal.value as { interaction?: unknown }).interaction, 'search');
  const agentResolution = firstMetaLine(agentLines, '/agent-policy-resolution');
  assert.equal((agentResolution.value as { goalSource?: unknown }).goalSource, 'deterministic');
  const agentPolicy = firstMetaLine(agentLines, '/surface-policy');
  assert.deepEqual(agentPolicy.value, {
    tier: 'declarative',
    purpose: 'explore',
    grants: ['search'],
    persistence: 'replayable',
  });

  const blockResponse = await fetch(`http://127.0.0.1:${appPort}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: 'build a dinner finder in blocks',
      fingerprint: { id: 'editorial-mono' },
      tools: searchTools,
      fragmentMode: 'block-v0',
    }),
  });
  const blockBody = await blockResponse.text();
  assert.equal(blockResponse.status, 400);
  assert.match(blockBody, /fragmentMode is not supported/);
  assert.equal(anthropicRequests.length, 3);

  const nodeResponse = await fetch(`http://127.0.0.1:${appPort}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: 'build a dinner finder in html nodes',
      fingerprint: { id: 'editorial-mono' },
      tools: searchTools,
      fragmentMode: 'html-node-v0',
    }),
  });
  const nodeBody = await nodeResponse.text();
  assert.equal(nodeResponse.status, 400);
  assert.match(nodeBody, /fragmentMode is not supported/);
  assert.equal(anthropicRequests.length, 3);

  const ghostResponse = await fetch(`http://127.0.0.1:${appPort}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: 'build checkout status',
      ghost: {
        source: 'resolved-context',
        id: 'checkout',
        product: 'Checkout',
        prompt: 'You are working inside the Checkout product experience.',
        provenance: { layers: ['portable-bundle'] },
      },
    }),
  });
  const ghostBody = await ghostResponse.text();
  assert.equal(ghostResponse.status, 400);
  assert.match(ghostBody, /resolved-context is no longer supported/);
  assert.equal(anthropicRequests.length, 3);

  const htmlResponse = await fetch(`http://127.0.0.1:${appPort}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: 'build a dinner finder as static html',
      fingerprint: { id: 'editorial-mono' },
      experimentalRuntime: 'html-static',
      surfacePolicy: {
        tier: 'declarative',
        purpose: 'explore',
        grants: ['search'],
      },
      tools: searchTools,
    }),
  });
  const htmlBody = await htmlResponse.text();
  assert.equal(htmlResponse.status, 200, htmlBody);

  assert.equal(anthropicRequests.length, 4);
  const htmlRequest = anthropicRequests[3] as {
    system?: Array<{ text?: string }>;
    tools?: Array<{ name?: string }>;
    tool_choice?: { name?: string };
  };
  assert.equal(htmlRequest.tools?.[0]?.name, 'create_summon_html_surface');
  assert.equal(htmlRequest.tool_choice?.name, 'create_summon_html_surface');
  const htmlSystemText = htmlRequest.system?.map((block) => block.text ?? '').join('\n') ?? '';
  assert.match(htmlSystemText, /Output runtime: html-static/);
  assert.match(htmlSystemText, /structured HTML\/CSS sandbox bundle/);
  assert.match(htmlSystemText, /create_summon_html_surface/);
  assert.match(htmlSystemText, /host-owned context for static HTML/);
  assert.match(htmlSystemText, /does not receive a host tool bridge/);
  assert.doesNotMatch(htmlSystemText, /structured Arrow sandbox bundle/);
  assert.doesNotMatch(htmlSystemText, /create_summon_arrow_surface/);
  assert.doesNotMatch(htmlSystemText, /host-bridge:summon/);
  assert.doesNotMatch(htmlSystemText, /@arrow-js\/core/);
  assert.doesNotMatch(htmlSystemText, /Runtime is always `arrow`/);
  assert.doesNotMatch(htmlSystemText, /Arrow artifact/);

  const htmlLines = htmlBody
    .trim()
    .split(/\n/)
    .filter(Boolean)
    .map((raw) => JSON.parse(raw) as ProtocolLine);
  assert.ok(htmlLines.some((line) => line.op === 'meta' && line.path === '/model-output-mode' && (line.value as { runtime?: unknown }).runtime === 'html-static'));
  const htmlArtifact = htmlLines.find((line) => line.op === 'artifact');
  assert.equal((htmlArtifact?.value as { runtime?: unknown } | undefined)?.runtime, 'html');
});

test('api generate playground repairs invalid entry-file bundles', async (t) => {
  const anthropicRequests: unknown[] = [];
  const anthropic = createServer(async (req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(404);
      res.end();
      return;
    }
    const request = JSON.parse(await readBody(req));
    anthropicRequests.push(request);
    if (Array.isArray(request.tools)) {
      const input = anthropicRequests.length === 1
        ? {
            schema: 'summon.arrow-bundle/v1',
            source: {
              'main.ts': 'export {};',
              'main.js': 'export {};',
            },
          }
        : arrowBundle('<section><h1>Repaired playground bundle</h1></section>');
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        id: `msg_playground_${anthropicRequests.length}`,
        type: 'message',
        role: 'assistant',
        model: request.model,
        content: [{
          type: 'tool_use',
          id: `msg_playground_${anthropicRequests.length}_tool`,
          name: 'create_summon_arrow_surface',
          input,
        }],
        stop_reason: 'tool_use',
        stop_sequence: null,
        usage: { input_tokens: 12, output_tokens: 24 },
      }));
      return;
    }
    res.writeHead(500);
    res.end('unexpected request');
  });
  await listen(anthropic);
  t.after(async () => {
    await closeServer(anthropic);
  });

  const anthropicPort = addressPort(anthropic);
  const appPort = await reservePort();
  const app = spawn(resolveTsxBin(), ['src/main.ts'], {
    cwd: packageRoot,
    env: {
      ...process.env,
      PORT: String(appPort),
      SUMMON_MODEL_PROVIDER: 'anthropic',
      ANTHROPIC_API_KEY: 'test-key',
      ANTHROPIC_BASE_URL: `http://127.0.0.1:${anthropicPort}`,
      OPENAI_API_KEY: '',
      GEMINI_API_KEY: '',
      GOOGLE_API_KEY: '',
      SUMMON_AGENT_GOAL_MODEL: '0',
      SUMMON_INFER_SHAPE: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output = captureOutput(app);
  t.after(async () => {
    await stopChild(app);
  });
  await waitForHealth(appPort, app, output);

  const response = await fetch(`http://127.0.0.1:${appPort}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: 'build a local playground surface',
      fingerprint: { id: 'editorial-mono' },
      playground: true,
    }),
  });
  const body = await response.text();
  assert.equal(response.status, 200, body);

  assert.equal(anthropicRequests.length, 2);
  const repairRequest = anthropicRequests[1] as { messages?: Array<{ content?: string }> };
  assert.match(repairRequest.messages?.[0]?.content ?? '', /invalid-arrow-bundle-entry/);

  const lines = body
    .trim()
    .split(/\n/)
    .filter(Boolean)
    .map((raw) => JSON.parse(raw) as ProtocolLine);
  const playgroundMeta = firstMetaLine(lines, '/playground-mode').value as { repairIssueCodes?: unknown };
  assert.ok(Array.isArray(playgroundMeta.repairIssueCodes));
  assert.ok(playgroundMeta.repairIssueCodes.includes('invalid-arrow-bundle-entry'));
  assert.ok(lines.some((line) => line.op === 'meta' && line.path === '/model-output-mode' && (line.value as { repairAttempts?: unknown }).repairAttempts === 1));
  assert.ok(lines.some((line) => line.op === 'artifact' && line.path === '/artifact'));
  assert.equal(lines.some((line) => line.op === 'meta' && line.path === '/validation-blocked'), false);
});

test('api generate emits Ghost fingerprint context for root contexts', async (t) => {
  const root = await makeRouteGhostFixture();
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const anthropicRequests: unknown[] = [];
  const anthropic = createServer(async (req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(404);
      res.end();
      return;
    }
    const request = JSON.parse(await readBody(req));
    anthropicRequests.push(request);
    if (Array.isArray(request.tools)) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(anthropicBundleMessage('msg_tool', '<section><h1>Checkout queue</h1></section>', request.model)));
      return;
    }
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    res.end([
      sse('message_start', {
        type: 'message_start',
        message: {
          id: 'msg_ghost',
          type: 'message',
          role: 'assistant',
          model: 'claude-opus-4-8',
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 12, output_tokens: 0 },
        },
      }),
      sse('content_block_start', {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' },
      }),
      sse('content_block_delta', {
        type: 'content_block_delta',
        index: 0,
        delta: {
          type: 'text_delta',
          text: JSON.stringify(arrowBundle('<section><h1>Checkout queue</h1></section>')),
        },
      }),
      sse('content_block_stop', { type: 'content_block_stop', index: 0 }),
      sse('message_delta', {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: { input_tokens: 12, output_tokens: 24 },
      }),
      sse('message_stop', { type: 'message_stop' }),
    ].join(''));
  });
  await listen(anthropic);
  t.after(async () => {
    await closeServer(anthropic);
  });

  const anthropicPort = addressPort(anthropic);
  const appPort = await reservePort();
  const app = spawn(resolveTsxBin(), ['src/main.ts'], {
    cwd: packageRoot,
    env: {
      ...process.env,
      PORT: String(appPort),
      SUMMON_MODEL_PROVIDER: 'anthropic',
      ANTHROPIC_API_KEY: 'test-key',
      ANTHROPIC_BASE_URL: `http://127.0.0.1:${anthropicPort}`,
      OPENAI_API_KEY: '',
      GEMINI_API_KEY: '',
      GOOGLE_API_KEY: '',
      SUMMON_GHOST_ROOTS: `checkout=${root}`,
      SUMMON_AGENT_GOAL_MODEL: '0',
      SUMMON_INFER_SHAPE: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output = captureOutput(app);
  t.after(async () => {
    await stopChild(app);
  });
  await waitForHealth(appPort, app, output);

  const response = await fetch(`http://127.0.0.1:${appPort}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: 'build checkout queue status',
      ghost: {
        rootId: 'checkout',
        targetPath: '.',
      },
    }),
  });
  const body = await response.text();
  assert.equal(response.status, 200, body);

  assert.equal(anthropicRequests.length, 1);
  const request = anthropicRequests[0] as { system?: Array<{ text?: string }>; stream?: boolean; tools?: unknown[] };
  assert.ok(Array.isArray(request.tools));
  const systemText = request.system?.map((block) => block.text ?? '').join('\n') ?? '';
  assert.match(systemText, /Ghost Fingerprint/);
  assert.match(systemText, /Summon Surface Brief/);
  assert.match(systemText, /product design direction package/);
  assert.match(systemText, /Status surfaces must foreground current state/);
  assert.match(systemText, /Surfaces are compact/);

  const lines = body
    .trim()
    .split(/\n/)
    .filter(Boolean)
    .map((raw) => JSON.parse(raw) as ProtocolLine);
  assert.deepEqual(lineRefs(withoutTiming(lines)).slice(0, 15), [
    'event /surface',
    'meta /status',
    'event /surface',
    'meta /status',
    'event /surface',
    'meta /status',
    'meta /ghost-context',
    'meta /ghost-token-source',
    'meta /agent-goal',
    'meta /agent-policy-resolution',
    'meta /surface-policy',
    'meta /surface-plan',
    'meta /surface-contract',
    'meta /model-output-mode',
    'event /surface',
  ]);
  assert.deepEqual(phaseStatuses(lines), ['planning', 'contract', 'contract', 'drafting', 'validating', 'rendering', 'rendering', 'finalizing']);
  const ghostAgentResolution = firstMetaLine(lines, '/agent-policy-resolution');
  assert.equal((ghostAgentResolution.value as { goalSource?: unknown }).goalSource, 'deterministic');

  const ghostContext = lines.find((line) => line.path === '/ghost-context') as Extract<ProtocolLine, { op: 'meta' }>;
  const contextMeta = ghostContext.value as {
    source?: unknown;
    product?: unknown;
    surface?: unknown;
    gatheredNodes?: unknown;
    styleSource?: unknown;
  };
  assert.equal(contextMeta.source, 'root');
  assert.equal(contextMeta.product, 'checkout');
  assert.equal(contextMeta.surface, 'core');
  assert.ok(Array.isArray(contextMeta.gatheredNodes));
  assert.ok((contextMeta.gatheredNodes as unknown[]).includes('core'));
  assert.equal(contextMeta.styleSource, 'ghost-config');

  const ghostReviewPacket = lines.find((line) => line.path === '/ghost-review-packet') as Extract<ProtocolLine, { op: 'meta' }>;
  const reviewPacket = ghostReviewPacket.value as {
    source?: unknown;
    surface?: unknown;
    gatheredNodes?: unknown;
    artifactRuntime?: unknown;
    artifactFiles?: unknown;
  };
  assert.equal(reviewPacket.source, 'root');
  assert.equal(reviewPacket.surface, 'core');
  assert.ok(Array.isArray(reviewPacket.gatheredNodes));
  assert.ok((reviewPacket.gatheredNodes as unknown[]).includes('core'));
  assert.equal(reviewPacket.artifactRuntime, 'arrow');
  assert.deepEqual(reviewPacket.artifactFiles, ['main.css', 'main.ts']);
});

test('api generate forwards Anthropic model overrides and speed options', async (t) => {
  const anthropicRequests: unknown[] = [];
  const anthropic = createServer(async (req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(404);
      res.end();
      return;
    }
    const request = JSON.parse(await readBody(req)) as { stream?: unknown; model?: string };
    anthropicRequests.push(request);
    if (Array.isArray((request as { tools?: unknown }).tools)) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(anthropicBundleMessage('msg_tool', '<section><h1>Fast model</h1></section>', request.model)));
      return;
    }
    if (request.stream !== true) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        id: 'msg_shape',
        type: 'message',
        role: 'assistant',
        model: request.model,
        content: [{ type: 'text', text: '{"shape":"card"}' }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 3, output_tokens: 2 },
      }));
      return;
    }
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    res.end([
      sse('message_start', {
        type: 'message_start',
        message: {
          id: 'msg_test',
          type: 'message',
          role: 'assistant',
          model: request.model,
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 12, output_tokens: 0 },
        },
      }),
      sse('content_block_start', {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' },
      }),
      sse('content_block_delta', {
        type: 'content_block_delta',
        index: 0,
        delta: {
          type: 'text_delta',
          text: JSON.stringify(arrowBundle('<section><h1>Fast model</h1></section>')),
        },
      }),
      sse('content_block_stop', { type: 'content_block_stop', index: 0 }),
      sse('message_delta', {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: { input_tokens: 12, output_tokens: 24 },
      }),
      sse('message_stop', { type: 'message_stop' }),
    ].join(''));
  });
  await listen(anthropic);
  t.after(async () => {
    await closeServer(anthropic);
  });

  const anthropicPort = addressPort(anthropic);
  const appPort = await reservePort();
  const app = spawn(resolveTsxBin(), ['src/main.ts'], {
    cwd: packageRoot,
    env: {
      ...process.env,
      PORT: String(appPort),
      SUMMON_MODEL_PROVIDER: 'anthropic',
      ANTHROPIC_API_KEY: 'test-key',
      ANTHROPIC_BASE_URL: `http://127.0.0.1:${anthropicPort}`,
      OPENAI_API_KEY: '',
      GEMINI_API_KEY: '',
      GOOGLE_API_KEY: '',
      SUMMON_AGENT_GOAL_MODEL: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output = captureOutput(app);
  t.after(async () => {
    await stopChild(app);
  });
  await waitForHealth(appPort, app, output);

  const response = await fetch(`http://127.0.0.1:${appPort}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: 'build a compact project status card',
      fingerprint: { id: 'editorial-mono' },
      modelProvider: 'anthropic',
      generationModel: 'claude-haiku-4-5',
      utilityModel: 'claude-haiku-4-5',
      modelOptions: {
        maxOutputTokens: 12000,
        anthropicThinking: 'adaptive',
        effort: 'low',
      },
      surfacePolicy: {
        tier: 'static',
        purpose: 'inform',
      },
    }),
  });
  const body = await response.text();
  assert.equal(response.status, 200, body);

  assert.equal(anthropicRequests.length, 1);
  const streamRequest = anthropicRequests[0] as {
    model?: string;
    max_tokens?: number;
    thinking?: unknown;
    output_config?: { effort?: string };
    stream?: boolean; tools?: unknown[];
  };
  assert.equal(streamRequest.model, 'claude-haiku-4-5');
  assert.equal(streamRequest.max_tokens, 12000);
  assert.deepEqual(streamRequest.thinking, { type: 'disabled' });
  assert.equal(streamRequest.output_config, undefined);
  assert.ok(Array.isArray(streamRequest.tools));

  const invalidResponse = await fetch(`http://127.0.0.1:${appPort}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: 'build anything',
      fingerprint: { id: 'editorial-mono' },
      modelProvider: 'anthropic',
      generationModel: 'claude-brand-new',
    }),
  });
  assert.equal(invalidResponse.status, 400);
  assert.match(await invalidResponse.text(), /not in the catalog/);
});

test('api generate can stream with OpenAI provider', async (t) => {
  const openAIRequests: unknown[] = [];
  const openai = createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/v1/responses') {
      res.writeHead(404);
      res.end();
      return;
    }
    const request = JSON.parse(await readBody(req));
    openAIRequests.push(request);
    if (Array.isArray(request.tools)) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(openAIResponseBundle('<section><h1>OpenAI surface</h1></section>')));
      return;
    }
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    res.end([
      sse('response.output_text.delta', {
        type: 'response.output_text.delta',
        delta: JSON.stringify(arrowBundle('<section><h1>OpenAI surface</h1></section>')),
      }),
      sse('response.completed', {
        type: 'response.completed',
        response: {
          usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
        },
      }),
    ].join(''));
  });
  await listen(openai);
  t.after(async () => {
    await closeServer(openai);
  });

  const openAIPort = addressPort(openai);
  const appPort = await reservePort();
  const app = spawn(resolveTsxBin(), ['src/main.ts'], {
    cwd: packageRoot,
    env: {
      ...process.env,
      PORT: String(appPort),
      SUMMON_MODEL_PROVIDER: 'openai',
      ANTHROPIC_API_KEY: '',
      OPENAI_API_KEY: 'test-openai-key',
      OPENAI_BASE_URL: `http://127.0.0.1:${openAIPort}/v1`,
      GEMINI_API_KEY: '',
      GOOGLE_API_KEY: '',
      SUMMON_AGENT_GOAL_MODEL: '0',
      SUMMON_INFER_SHAPE: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output = captureOutput(app);
  t.after(async () => {
    await stopChild(app);
  });
  await waitForHealth(appPort, app, output);

  const providersResponse = await fetch(`http://127.0.0.1:${appPort}/api/model-providers`);
  const providers = await providersResponse.json() as {
    defaultProvider?: unknown;
    providers?: Array<{
      id?: unknown;
      models?: Array<{ id?: unknown }>;
      controls?: { maxOutputTokens?: unknown };
    }>;
  };
  assert.equal(providers.defaultProvider, 'openai');
  const openAIProvider = providers.providers?.find((provider) => provider.id === 'openai');
  assert.ok(openAIProvider?.models?.some((model) => model.id === 'gpt-5.5'));
  assert.ok(openAIProvider?.models?.some((model) => model.id === 'gpt-5.4-mini'));
  assert.ok(openAIProvider?.controls?.maxOutputTokens);

  const response = await fetch(`http://127.0.0.1:${appPort}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: 'build a compact launch status card',
      fingerprint: { id: 'editorial-mono' },
      modelProvider: 'openai',
      generationModel: 'gpt-5.4-mini',
      utilityModel: 'gpt-5.4-nano',
      modelOptions: { maxOutputTokens: 12000 },
      surfacePolicy: {
        tier: 'static',
        purpose: 'inform',
      },
    }),
  });
  const body = await response.text();
  assert.equal(response.status, 200, body);

  assert.equal(openAIRequests.length, 1);
  const request = openAIRequests[0] as { model?: string; instructions?: string; stream?: boolean; max_output_tokens?: number; tools?: unknown[] };
  assert.equal(request.model, 'gpt-5.4-mini');
  assert.equal(request.stream, false);
  assert.ok(Array.isArray(request.tools));
  assert.equal(request.max_output_tokens, 12000);
  assert.match(request.instructions ?? '', /Surface plan/);

  const lines = body
    .trim()
    .split(/\n/)
    .filter(Boolean)
    .map((raw) => JSON.parse(raw) as ProtocolLine);
  assert.deepEqual(lineRefs(withoutTiming(lines)).slice(0, 12), [
    'event /surface',
    'meta /status',
    'event /surface',
    'meta /status',
    'event /surface',
    'meta /status',
    'meta /ghost-context',
    'meta /ghost-token-source',
    'meta /surface-policy',
    'meta /surface-plan',
    'meta /surface-contract',
    'meta /model-output-mode',
  ]);
  assert.deepEqual(phaseStatuses(lines), ['planning', 'contract', 'contract', 'drafting', 'validating', 'rendering', 'rendering', 'finalizing']);
  assert.equal(lines.some((line) => line.path === '/error'), false);
});

test('api generate can stream with Gemini provider', async (t) => {
  const geminiRequests: unknown[] = [];
  const gemini = createServer(async (req, res) => {
    if (
      req.method !== 'POST' ||
      !(req.url?.startsWith('/v1beta/models/gemini-3.5-flash:streamGenerateContent') || req.url?.startsWith('/v1beta/models/gemini-3.5-flash:generateContent'))
    ) {
      res.writeHead(404);
      res.end();
      return;
    }
    const request = JSON.parse(await readBody(req));
    geminiRequests.push(request);
    if (Array.isArray(request.tools)) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(geminiResponseBundle('<section><h1>Gemini surface</h1></section>')));
      return;
    }
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    res.end([
      sse('message', {
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify(arrowBundle('<section><h1>Gemini surface</h1></section>')),
            }],
          },
        }],
        usageMetadata: {
          promptTokenCount: 11,
          candidatesTokenCount: 21,
          totalTokenCount: 32,
        },
      }),
    ].join(''));
  });
  await listen(gemini);
  t.after(async () => {
    await closeServer(gemini);
  });

  const geminiPort = addressPort(gemini);
  const appPort = await reservePort();
  const app = spawn(resolveTsxBin(), ['src/main.ts'], {
    cwd: packageRoot,
    env: {
      ...process.env,
      PORT: String(appPort),
      SUMMON_MODEL_PROVIDER: 'gemini',
      ANTHROPIC_API_KEY: '',
      OPENAI_API_KEY: '',
      GEMINI_API_KEY: 'test-gemini-key',
      GOOGLE_API_KEY: '',
      GEMINI_BASE_URL: `http://127.0.0.1:${geminiPort}`,
      SUMMON_AGENT_GOAL_MODEL: '0',
      SUMMON_INFER_SHAPE: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output = captureOutput(app);
  t.after(async () => {
    await stopChild(app);
  });
  await waitForHealth(appPort, app, output);

  const response = await fetch(`http://127.0.0.1:${appPort}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: 'build a compact support triage card',
      fingerprint: { id: 'editorial-mono' },
      modelProvider: 'gemini',
      generationModel: 'gemini-3.5-flash',
      utilityModel: 'gemini-3.1-flash-lite',
      modelOptions: { maxOutputTokens: 12000 },
      surfacePolicy: {
        tier: 'static',
        purpose: 'inform',
      },
    }),
  });
  const body = await response.text();
  assert.equal(response.status, 200, body);

  assert.equal(geminiRequests.length, 1);
  const request = geminiRequests[0] as {
    systemInstruction?: { parts?: Array<{ text?: string }> };
    generationConfig?: { maxOutputTokens?: number };
  };
  assert.equal(request.generationConfig?.maxOutputTokens, 12000);
  assert.match(request.systemInstruction?.parts?.[0]?.text ?? '', /Surface plan/);

  const lines = body
    .trim()
    .split(/\n/)
    .filter(Boolean)
    .map((raw) => JSON.parse(raw) as ProtocolLine);
  assert.deepEqual(lineRefs(withoutTiming(lines)).slice(0, 12), [
    'event /surface',
    'meta /status',
    'event /surface',
    'meta /status',
    'event /surface',
    'meta /status',
    'meta /ghost-context',
    'meta /ghost-token-source',
    'meta /surface-policy',
    'meta /surface-plan',
    'meta /surface-contract',
    'meta /model-output-mode',
  ]);
  assert.deepEqual(phaseStatuses(lines), ['planning', 'contract', 'contract', 'drafting', 'validating', 'rendering', 'rendering', 'finalizing']);
  assert.equal(lines.some((line) => line.path === '/error'), false);
});

test('api generate streams planning preview before slow preflight finishes', async (t) => {
  const anthropicRequests: unknown[] = [];
  const anthropic = createServer(async (req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(404);
      res.end();
      return;
    }
    const request = JSON.parse(await readBody(req)) as { stream?: unknown; max_tokens?: number; model?: string };
    anthropicRequests.push(request);
    if (Array.isArray((request as { tools?: unknown }).tools)) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(anthropicBundleMessage('msg_tool', '<section><h1>Preflight streamed</h1></section>', request.model)));
      return;
    }
    if (request.stream !== true) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const text = request.max_tokens === 100
        ? '{"shape":"card"}'
        : JSON.stringify({
            purpose: 'explore',
            interaction: 'search',
            dataNeed: 'host-resource',
            sideEffect: 'none',
            requestedTools: ['search'],
            confidence: 0.82,
          });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        id: 'msg_preflight',
        type: 'message',
        role: 'assistant',
        model: request.model,
        content: [{ type: 'text', text }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 3, output_tokens: 2 },
      }));
      return;
    }

    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    res.end([
      sse('message_start', {
        type: 'message_start',
        message: {
          id: 'msg_test',
          type: 'message',
          role: 'assistant',
          model: request.model,
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 12, output_tokens: 0 },
        },
      }),
      sse('content_block_start', {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' },
      }),
      sse('content_block_delta', {
        type: 'content_block_delta',
        index: 0,
        delta: {
          type: 'text_delta',
          text: JSON.stringify(arrowBundle('<section><h1>Preflight streamed</h1></section>')),
        },
      }),
      sse('content_block_stop', { type: 'content_block_stop', index: 0 }),
      sse('message_delta', {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: { input_tokens: 12, output_tokens: 24 },
      }),
      sse('message_stop', { type: 'message_stop' }),
    ].join(''));
  });
  await listen(anthropic);
  t.after(async () => {
    await closeServer(anthropic);
  });

  const anthropicPort = addressPort(anthropic);
  const appPort = await reservePort();
  const app = spawn(resolveTsxBin(), ['src/main.ts'], {
    cwd: packageRoot,
    env: {
      ...process.env,
      PORT: String(appPort),
      SUMMON_MODEL_PROVIDER: 'anthropic',
      ANTHROPIC_API_KEY: 'test-key',
      ANTHROPIC_BASE_URL: `http://127.0.0.1:${anthropicPort}`,
      OPENAI_API_KEY: '',
      GEMINI_API_KEY: '',
      GOOGLE_API_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output = captureOutput(app);
  t.after(async () => {
    await stopChild(app);
  });
  await waitForHealth(appPort, app, output);

  const startedAt = Date.now();
  const response = await fetch(`http://127.0.0.1:${appPort}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: 'build a dinner finder where i can search',
      fingerprint: { id: 'editorial-mono' },
      tools: searchTools,
    }),
  });
  assert.equal(response.status, 200);
  assert.ok(response.body);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const first = await reader.read();
  const firstChunkElapsed = Date.now() - startedAt;
  assert.equal(first.done, false);
  assert.ok(first.value);
  const firstChunk = decoder.decode(first.value, { stream: true });
  assert.ok(
    firstChunkElapsed < 350,
    `first stream chunk took ${firstChunkElapsed}ms, expected it before slow utility preflight completed`,
  );
  assert.match(firstChunk, /"op":"event"/);
  assert.match(firstChunk, /"path":"\/surface"/);
  assert.match(firstChunk, /Preparing generation request/);

  let body = firstChunk;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    body += decoder.decode(next.value, { stream: true });
  }
  body += decoder.decode();
  const lines = body
    .trim()
    .split(/\n/)
    .filter(Boolean)
    .map((raw) => JSON.parse(raw) as ProtocolLine);
  assert.deepEqual(lineRefs(withoutTiming(lines)).slice(0, 12), [
    'event /surface',
    'meta /status',
    'event /surface',
    'meta /status',
    'event /surface',
    'meta /status',
    'meta /ghost-context',
    'meta /ghost-token-source',
    'meta /agent-goal',
    'meta /agent-policy-resolution',
    'meta /surface-policy',
    'meta /surface-plan',
  ]);
  assert.deepEqual(phaseStatuses(lines), ['planning', 'contract', 'contract', 'drafting', 'validating', 'rendering', 'rendering', 'finalizing']);
  const timings = timingValues(lines);
  for (const phase of ['policy']) {
    const timing = timings.find((entry) => entry.phase === phase);
    assert.ok(timing, `missing timing phase ${phase}`);
    assert.equal(timing.source, 'server');
    assert.equal(typeof timing.elapsedMs, 'number');
    assert.equal(typeof timing.durationMs, 'number');
    assert.ok(Number(timing.elapsedMs) >= 0);
    assert.ok(Number(timing.durationMs) >= 0);
  }
  assert.equal(anthropicRequests.length, 2);
});

async function makeRouteGhostFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'summon-ghost-route-'));
  const ghostDir = join(root, '.ghost');
  await mkdir(ghostDir, { recursive: true });
  await writeFile(
    join(ghostDir, 'manifest.yml'),
    `schema: ghost.fingerprint-package/v1
id: checkout
`,
  );
  const css = await readDefaultTokensCss();
  await writeFile(
    join(ghostDir, 'index.md'),
    `---
description: Checkout — quiet operational density for queue surfaces.
---

## Intent

Preserve quiet density and clear hierarchy. Keep operator status legible before
secondary detail. Status surfaces must foreground current state.
Surfaces are compact, rectangular, and information-first, built for exacting workflows.

## Inventory

The material is a calm token system for checkout queues.

\`\`\`css
${css.trim()}
\`\`\`
`,
  );
  return root;
}

async function readDefaultTokensCss(): Promise<string> {
  return readFile(
    resolve(workspaceRoot, 'packages', 'sandbox-runtime', 'src', 'tokens.css'),
    'utf-8',
  );
}

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function readBody(req: IncomingMessage): Promise<string> {
  let body = '';
  for await (const chunk of req) body += chunk;
  return body;
}

async function listen(server: ReturnType<typeof createServer>): Promise<void> {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
}

async function closeServer(server: ReturnType<typeof createServer>): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

function addressPort(server: ReturnType<typeof createServer>): number {
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return address.port;
}

async function reservePort(): Promise<number> {
  const server = createServer();
  await listen(server);
  const port = addressPort(server);
  await closeServer(server);
  return port;
}

function resolveTsxBin(): string {
  const local = resolve(packageRoot, 'node_modules', '.bin', 'tsx');
  if (existsSync(local)) return local;
  return resolve(workspaceRoot, 'node_modules', '.bin', 'tsx');
}

function captureOutput(child: ChildProcess): { stdout: string; stderr: string } {
  const output = { stdout: '', stderr: '' };
  child.stdout?.on('data', (chunk) => {
    output.stdout += String(chunk);
  });
  child.stderr?.on('data', (chunk) => {
    output.stderr += String(chunk);
  });
  return output;
}

async function waitForHealth(
  port: number,
  child: ChildProcess,
  output: { stdout: string; stderr: string },
): Promise<void> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      assert.fail(`server exited before health check\n${output.stdout}\n${output.stderr}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch {
      // keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(`server did not become healthy\n${output.stdout}\n${output.stderr}`);
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    once(child, 'exit'),
    new Promise((resolve) => setTimeout(resolve, 1000)),
  ]);
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
}
