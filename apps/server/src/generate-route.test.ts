import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
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
      'main.ts': `import { html } from "@arrow-js/core";\nexport default html\`${source}\`;`,
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
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(anthropicBundleMessage('msg_test', '<section><h1>Dinner finder</h1><p>Ready.</p></section>', request.model)));
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
  assert.doesNotMatch(systemText, /data-summon-on-click/);
  assert.doesNotMatch(systemText, /\bchoose\b/);

  const lines = body
    .trim()
    .split(/\n/)
    .filter(Boolean)
    .map((raw) => JSON.parse(raw) as ProtocolLine);
  assert.deepEqual(lineRefs(withoutTiming(lines)).slice(0, 10), [
    'event /surface',
    'meta /status',
    'event /surface',
    'meta /status',
    'meta /surface-policy',
    'meta /surface-plan',
    'meta /surface-contract',
    'meta /model-output-mode',
    'event /surface',
    'meta /status',
  ]);
  assert.deepEqual(phaseStatuses(lines), ['planning', 'contract', 'drafting', 'validating', 'rendering']);
  assert.equal(lines[1]?.op, 'meta');
  assert.equal((lines[1] as Extract<ProtocolLine, { op: 'meta' }>).value, 'planning');
  assert.deepEqual(firstMetaLine(lines, '/surface-plan').value, surfacePlan);
  assert.ok(lines.some((line) => line.op === 'artifact' && line.path === '/artifact'));
  assert.equal(withoutTiming(lines).at(-1)?.path, '/stream-graph-summary');
  assert.equal(lines.some((line) => line.path === '/error'), false);

  const policyResponse = await fetch(`http://127.0.0.1:${appPort}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: 'build a dinner finder where i can search',
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
  assert.deepEqual(lineRefs(withoutTiming(policyLines)).slice(0, 10), [
    'event /surface',
    'meta /status',
    'event /surface',
    'meta /status',
    'meta /surface-policy',
    'meta /surface-plan',
    'meta /surface-contract',
    'meta /model-output-mode',
    'event /surface',
    'meta /status',
  ]);
  assert.deepEqual(phaseStatuses(policyLines), ['planning', 'contract', 'drafting', 'validating', 'rendering']);
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
  assert.deepEqual(lineRefs(withoutTiming(agentLines)).slice(0, 11), [
    'event /surface',
    'meta /status',
    'event /surface',
    'meta /status',
    'meta /agent-goal',
    'meta /agent-policy-resolution',
    'meta /surface-policy',
    'meta /surface-plan',
    'meta /surface-contract',
    'meta /model-output-mode',
    'event /surface',
  ]);
  assert.deepEqual(phaseStatuses(agentLines), ['planning', 'contract', 'drafting', 'validating', 'rendering']);
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

  const ghostOverrideResponse = await fetch(`http://127.0.0.1:${appPort}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: 'build checkout status',
      ghost: {
        source: 'resolved-context',
        prompt: 'You are working inside the Checkout product experience.',
      },
      tokenOverrides: { 'color-accent': 'red' },
    }),
  });
  const ghostOverrideBody = await ghostOverrideResponse.text();
  assert.equal(ghostOverrideResponse.status, 400);
  assert.match(ghostOverrideBody, /resolved-context is no longer supported/);
  assert.equal(anthropicRequests.length, 3);
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
  assert.match(systemText, /Ghost Relay Brief/);
  assert.match(systemText, /Identity Capsule/);
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
  assert.deepEqual(phaseStatuses(lines), ['planning', 'contract', 'contract', 'drafting', 'validating', 'rendering']);
  const ghostAgentResolution = firstMetaLine(lines, '/agent-policy-resolution');
  assert.equal((ghostAgentResolution.value as { goalSource?: unknown }).goalSource, 'deterministic');

  const ghostContext = lines.find((line) => line.path === '/ghost-context') as Extract<ProtocolLine, { op: 'meta' }>;
  const contextMeta = ghostContext.value as {
    source?: unknown;
    product?: unknown;
    taskContract?: { preserve?: unknown; validate?: unknown };
    suggestedReads?: unknown;
    provenance?: { merge?: unknown; layers?: Array<{ relativeRoot?: unknown; memoryDir?: unknown; dir?: unknown }> };
  };
  assert.equal(contextMeta.source, 'root');
  assert.equal(contextMeta.product, 'Checkout');
  const contextPreserve = contextMeta.taskContract?.preserve;
  const contextValidate = contextMeta.taskContract?.validate;
  assert.ok(Array.isArray(contextPreserve));
  assert.ok(contextPreserve.some((entry) => typeof entry === 'string' && entry.includes('Keep operator status legible')));
  assert.ok(Array.isArray(contextValidate));
  assert.ok(Array.isArray(contextMeta.suggestedReads));
  assert.equal(contextMeta.provenance?.merge, 'child-wins-by-id');
  assert.deepEqual(contextMeta.provenance?.layers, [
    { relativeRoot: '.', memoryDir: '.ghost', dir: '.ghost' },
  ]);
  const ghostReviewPacket = lines.find((line) => line.path === '/ghost-review-packet') as Extract<ProtocolLine, { op: 'meta' }>;
  const reviewPacket = ghostReviewPacket.value as {
    source?: unknown;
    taskContract?: { preserve?: unknown };
    suggestedReads?: unknown;
    fingerprintProvenance?: { merge?: unknown; layers?: unknown };
    artifactRuntime?: unknown;
    artifactFiles?: unknown;
  };
  assert.equal(reviewPacket.source, 'root');
  const reviewPreserve = reviewPacket.taskContract?.preserve;
  assert.ok(Array.isArray(reviewPreserve));
  assert.ok(Array.isArray(reviewPacket.suggestedReads));
  assert.equal(reviewPacket.fingerprintProvenance?.merge, 'child-wins-by-id');
  assert.deepEqual(reviewPacket.fingerprintProvenance?.layers, [
    { relativeRoot: '.', memoryDir: '.ghost', dir: '.ghost' },
  ]);
  assert.equal(reviewPacket.artifactRuntime, 'arrow');
  assert.deepEqual(reviewPacket.artifactFiles, ['main.ts']);

  const overrideResponse = await fetch(`http://127.0.0.1:${appPort}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: 'build checkout queue status',
      ghost: {
        rootId: 'checkout',
        targetPath: '.',
      },
      tokenOverrides: { 'color-accent': 'red' },
    }),
  });
  const overrideBody = await overrideResponse.text();
  assert.equal(overrideResponse.status, 400);
  assert.match(overrideBody, /tokenOverrides are not supported with Ghost fingerprints/);
  assert.equal(anthropicRequests.length, 1);
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

  assert.equal(anthropicRequests.length, 2);
  const shapeRequest = anthropicRequests[0] as { model?: string; max_tokens?: number; stream?: boolean };
  assert.equal(shapeRequest.model, 'claude-haiku-4-5');
  assert.equal(shapeRequest.max_tokens, 100);
  assert.notEqual(shapeRequest.stream, true);

  const streamRequest = anthropicRequests[1] as {
    model?: string;
    max_tokens?: number;
    thinking?: unknown;
    output_config?: { effort?: string };
    stream?: boolean; tools?: unknown[];
  };
  assert.equal(streamRequest.model, 'claude-haiku-4-5');
  assert.equal(streamRequest.max_tokens, 12000);
  assert.equal(streamRequest.thinking, undefined);
  assert.equal(streamRequest.output_config, undefined);
  assert.ok(Array.isArray(streamRequest.tools));

  const invalidResponse = await fetch(`http://127.0.0.1:${appPort}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: 'build anything',
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
  assert.deepEqual(lineRefs(withoutTiming(lines)).slice(0, 10), [
    'event /surface',
    'meta /status',
    'event /surface',
    'meta /status',
    'meta /surface-policy',
    'meta /surface-plan',
    'meta /surface-contract',
    'meta /model-output-mode',
    'event /surface',
    'meta /status',
  ]);
  assert.deepEqual(phaseStatuses(lines), ['planning', 'contract', 'drafting', 'validating', 'rendering']);
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
  assert.deepEqual(lineRefs(withoutTiming(lines)).slice(0, 10), [
    'event /surface',
    'meta /status',
    'event /surface',
    'meta /status',
    'meta /surface-policy',
    'meta /surface-plan',
    'meta /surface-contract',
    'meta /model-output-mode',
    'event /surface',
    'meta /status',
  ]);
  assert.deepEqual(phaseStatuses(lines), ['planning', 'contract', 'drafting', 'validating', 'rendering']);
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
  assert.deepEqual(lineRefs(withoutTiming(lines)).slice(0, 8), [
    'event /surface',
    'meta /status',
    'event /surface',
    'meta /status',
    'event /surface',
    'meta /status',
    'meta /agent-goal',
    'meta /agent-policy-resolution',
  ]);
  assert.deepEqual(phaseStatuses(lines), ['planning', 'planning', 'contract', 'drafting', 'validating', 'rendering']);
  const timings = timingValues(lines);
  for (const phase of ['shape', 'policy']) {
    const timing = timings.find((entry) => entry.phase === phase);
    assert.ok(timing, `missing timing phase ${phase}`);
    assert.equal(timing.source, 'server');
    assert.equal(typeof timing.elapsedMs, 'number');
    assert.equal(typeof timing.durationMs, 'number');
    assert.ok(Number(timing.elapsedMs) >= 0);
    assert.ok(Number(timing.durationMs) >= 0);
  }
  assert.equal(anthropicRequests.length, 3);
});

async function makeRouteGhostFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'summon-ghost-route-'));
  await mkdir(join(root, '.ghost', 'fingerprint', 'enforcement'), { recursive: true });
  await mkdir(join(root, '.ghost', 'fingerprint', 'memory'), { recursive: true });
  await writeFile(
    join(root, '.ghost', 'fingerprint', 'manifest.yml'),
    `schema: ghost.fingerprint-package/v1
id: checkout
`,
  );
  await writeFile(
    join(root, '.ghost', 'fingerprint', 'prose.yml'),
    `summary:
  product: Checkout
  tone: [quiet, exacting workflows]
situations:
  - id: queue-status
    title: Queue status
    user_intent: Show the current checkout queue state.
    product_obligation: Keep operator status legible before secondary detail.
    surface_type: dashboard
    principles: [prose.principle:calm-density]
    experience_contracts: [prose.experience_contract:queue-trust]
    patterns: [composition.pattern:measured-surfaces]
principles:
  - id: calm-density
    principle: Preserve quiet density and clear hierarchy.
    applies_to:
      paths: [.]
      surface_types: [dashboard]
    guidance:
      - Favor compact hierarchy over decorative chrome.
    check_refs: [check:no-rainbow]
experience_contracts:
  - id: queue-trust
    contract: Status surfaces must foreground current state.
    obligations:
      - Show current queue state before secondary context.
    check_refs: [check:no-rainbow]
`,
  );
  await writeFile(
    join(root, '.ghost', 'fingerprint', 'inventory.yml'),
    `topology:
  scopes:
    - id: app
      paths: [.]
      surface_types: [dashboard]
building_blocks:
  tokens: [--color-bg, --color-text, --space-2]
  components: [QueueCard]
`,
  );
  await writeFile(
    join(root, '.ghost', 'fingerprint', 'composition.yml'),
    `patterns:
  - id: measured-surfaces
    kind: structure
    pattern: Surfaces are compact, rectangular, and information-first.
    guidance:
      - Use one clear status block before supporting details.
    anti_patterns:
      - Avoid marketing-style hero copy.
    check_refs: [check:no-rainbow]
`,
  );
  await writeFile(
    join(root, '.ghost', 'fingerprint', 'enforcement', 'checks.yml'),
    `schema: ghost.checks/v1
id: checkout
checks:
  - id: no-rainbow
    title: Avoid rainbow decorative color
    status: active
    severity: serious
    applies_to:
      paths: [.]
    detector:
      type: forbidden-regex
      pattern: rainbow
    evidence:
      support: 1
      observed_count: 1
      examples:
        - checkout fixture avoids rainbow decorative color
`,
  );
  await writeFile(
    join(root, '.ghost', 'config.yml'),
    `schema: ghost.config/v1
targets: []
libraries: []
`,
  );
  return root;
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
