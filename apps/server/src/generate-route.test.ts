import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { createServer, type IncomingMessage } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import type {
  CapabilityPack,
  ProtocolLine,
  SurfaceCeiling,
  SurfacePlan,
} from '@anarchitecture/summon/engine';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, '..');
const workspaceRoot = resolve(packageRoot, '..', '..');

const searchCapability: CapabilityPack = {
  intents: [{
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
  runtime: 'declarative',
  data: 'host-resource',
  authority: 'read',
  persistence: 'replayable',
};

const surfaceCeiling: SurfaceCeiling = {
  runtimes: ['static', 'declarative'],
  data: ['embedded', 'host-resource'],
  authorities: ['none', 'read'],
  persistences: ['replayable'],
};

test('api generate sends narrowed contract and stream meta shape through package runner', async (t) => {
  const anthropicRequests: unknown[] = [];
  const anthropic = createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/v1/messages') {
      res.writeHead(404);
      res.end();
      return;
    }
    anthropicRequests.push(JSON.parse(await readBody(req)));
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
          model: 'claude-sonnet-4-6',
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
          text: '{"op":"set","path":"/screen","value":{"sections":["hero"]}}\n',
        },
      }),
      sse('content_block_delta', {
        type: 'content_block_delta',
        index: 0,
        delta: {
          type: 'text_delta',
          text: '{"op":"add","path":"/section/hero","html":"<section><h1>Dinner finder</h1><p>Ready.</p></section>"}\n',
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
      ANTHROPIC_API_KEY: 'test-key',
      ANTHROPIC_BASE_URL: `http://127.0.0.1:${anthropicPort}`,
      SUMMON_INFER_CAPABILITIES: '0',
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
      mode: 'interactive',
      capabilities: searchCapability,
      surfacePlan,
      surfaceCeiling,
      scriptPolicy: 'forbid',
    }),
  });
  const body = await response.text();
  assert.equal(response.status, 200, body);

  assert.equal(anthropicRequests.length, 1);
  const request = anthropicRequests[0] as { system?: Array<{ text?: string }>; stream?: boolean };
  assert.equal(request.stream, true);
  const systemText = request.system?.map((block) => block.text ?? '').join('\n') ?? '';
  assert.match(systemText, /Search host-owned dinner data/);
  assert.match(systemText, /host-resource/);
  assert.match(systemText, /Declarative-only interactivity/);
  assert.doesNotMatch(systemText, /Rules for scripts/);
  assert.doesNotMatch(systemText, /\bchoose\b/);

  const lines = body
    .trim()
    .split(/\n/)
    .filter(Boolean)
    .map((raw) => JSON.parse(raw) as ProtocolLine);
  assert.deepEqual(lines.slice(0, 4).map((line) => `${line.op} ${line.path}`), [
    'meta /surface-plan',
    'meta /status',
    'set /screen',
    'add /section/hero',
  ]);
  assert.equal(lines[0]?.op, 'meta');
  assert.deepEqual((lines[0] as Extract<ProtocolLine, { op: 'meta' }>).value, surfacePlan);
  assert.equal(lines[1]?.op, 'meta');
  assert.equal((lines[1] as Extract<ProtocolLine, { op: 'meta' }>).value, 'writing');
  assert.equal(lines.at(-1)?.path, '/stream-graph-summary');
  assert.equal(lines.some((line) => line.path === '/error'), false);

  const policyResponse = await fetch(`http://127.0.0.1:${appPort}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: 'build a dinner finder where i can search',
      mode: 'static',
      scriptPolicy: 'allow',
      surfacePolicy: {
        tier: 'declarative',
        purpose: 'explore',
        grants: ['search'],
      },
      capabilities: searchCapability,
    }),
  });
  const policyBody = await policyResponse.text();
  assert.equal(policyResponse.status, 200, policyBody);

  assert.equal(anthropicRequests.length, 2);
  const policyRequest = anthropicRequests[1] as { system?: Array<{ text?: string }>; stream?: boolean };
  assert.equal(policyRequest.stream, true);
  const policySystemText = policyRequest.system?.map((block) => block.text ?? '').join('\n') ?? '';
  assert.match(policySystemText, /Search host-owned dinner data/);
  assert.match(policySystemText, /Surface plan/);
  assert.match(policySystemText, /Runtime: `declarative`/);
  assert.match(policySystemText, /Data: `host-resource`/);
  assert.doesNotMatch(policySystemText, /Rules for scripts/);

  const policyLines = policyBody
    .trim()
    .split(/\n/)
    .filter(Boolean)
    .map((raw) => JSON.parse(raw) as ProtocolLine);
  assert.deepEqual(policyLines.slice(0, 4).map((line) => `${line.op} ${line.path}`), [
    'meta /surface-policy',
    'meta /surface-plan',
    'meta /status',
    'set /screen',
  ]);
  assert.equal(policyLines.some((line) => line.path === '/mode-upgraded'), false);
  assert.deepEqual((policyLines[0] as Extract<ProtocolLine, { op: 'meta' }>).value, {
    tier: 'declarative',
    purpose: 'explore',
    grants: ['search'],
    components: [],
    persistence: 'replayable',
  });
  assert.deepEqual((policyLines[1] as Extract<ProtocolLine, { op: 'meta' }>).value, surfacePlan);

  const ghostResponse = await fetch(`http://127.0.0.1:${appPort}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: 'build checkout status',
      mode: 'static',
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
  assert.equal(ghostResponse.status, 200, ghostBody);

  assert.equal(anthropicRequests.length, 3);
  const ghostRequest = anthropicRequests[2] as { system?: Array<{ text?: string }>; stream?: boolean };
  const ghostSystemText = ghostRequest.system?.map((block) => block.text ?? '').join('\n') ?? '';
  assert.match(ghostSystemText, /Checkout product experience/);

  const ghostLines = ghostBody
    .trim()
    .split(/\n/)
    .filter(Boolean)
    .map((raw) => JSON.parse(raw) as ProtocolLine);
  assert.deepEqual(ghostLines.slice(0, 4).map((line) => `${line.op} ${line.path}`), [
    'meta /ghost-context',
    'meta /ghost-token-source',
    'meta /surface-plan',
    'meta /status',
  ]);
  const ghostContext = ghostLines.find((line) => line.path === '/ghost-context') as Extract<ProtocolLine, { op: 'meta' }>;
  assert.equal((ghostContext.value as { source?: unknown }).source, 'resolved-context');
  assert.equal((ghostContext.value as { product?: unknown }).product, 'Checkout');
  const ghostTokenSource = ghostLines.find((line) => line.path === '/ghost-token-source') as Extract<ProtocolLine, { op: 'meta' }>;
  assert.equal((ghostTokenSource.value as { kind?: unknown }).kind, 'base-direction');
  const ghostReviewPacket = ghostLines.find((line) => line.path === '/ghost-review-packet') as Extract<ProtocolLine, { op: 'meta' }>;
  assert.equal((ghostReviewPacket.value as { source?: unknown }).source, 'resolved-context');

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
  assert.match(ghostOverrideBody, /tokenOverrides are not supported with Ghost product memory/);
  assert.equal(anthropicRequests.length, 3);
});

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
