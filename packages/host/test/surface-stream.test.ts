import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProtocolLine } from '@summon-internal/engine';
import { StreamGraph } from '@summon-internal/engine';
import {
  consumeSurfaceStream,
  type SurfaceStreamContext,
} from '../src/index.ts';

const encoder = new TextEncoder();

function artifactLine(source = 'import { html } from "@arrow-js/core";\nexport default html`<p>Arrow</p>`'): string {
  return `${JSON.stringify({
    op: 'artifact',
    path: '/artifact',
    value: {
      runtime: 'arrow',
      source: {
        'main.ts': source,
      },
    },
  })}\n`;
}

function htmlArtifactLine(body = '<section id="hero"><h1>HTML</h1></section>'): string {
  return `${JSON.stringify({
    op: 'artifact',
    path: '/artifact',
    value: {
      runtime: 'html',
      source: {
        'body.html': body,
        'main.css': '#hero { color: var(--color-text); }',
      },
    },
  })}\n`;
}

function htmlPatchLine(html = '<section id="hero"><h2>Updated</h2></section>'): string {
  return `${JSON.stringify({
    op: 'patch',
    path: '/artifact/html-patch',
    value: {
      runtime: 'html',
      action: 'replace',
      target: 'hero',
      html,
    },
  })}\n`;
}

function htmlScriptArtifactLine(js: string): string {
  return `${JSON.stringify({
    op: 'artifact',
    path: '/artifact',
    value: {
      runtime: 'html',
      source: {
        'body.html': '<section id="hero"><button id="probe">Probe</button></section>',
        'main.js': js,
      },
    },
  })}\n`;
}

test('consumeSurfaceStream parses split chunks and delivers Arrow artifacts', async () => {
  const artifacts: string[] = [];
  const graphSnapshots: number[] = [];
  const lines: ProtocolLine[] = [];
  const line = artifactLine();
  const result = await consumeSurfaceStream([
    line.slice(0, 35),
    line.slice(35),
  ], {
    mode: 'interactive',
    onLine: (accepted) => lines.push(accepted),
    onGraph: (snapshot) => graphSnapshots.push(snapshot.health.blockedCount),
    onArtifact: (artifact) => artifacts.push(artifact.source['main.ts'] ?? ''),
  });

  assert.equal(result.protocolLines.length, 1);
  assert.deepEqual(lines.map((accepted) => accepted.op), ['artifact']);
  assert.equal(artifacts.length, 1);
  assert.match(artifacts[0]!, /Arrow/);
  assert.equal(result.streamGraph.health.complete, true);
  assert.ok(graphSnapshots.length >= 1);
});

test('consumeSurfaceStream delivers valid semantic preview events before artifacts', async () => {
  const events: string[] = [];
  const result = await consumeSurfaceStream([
    `${JSON.stringify({
      op: 'event',
      path: '/surface',
      value: { type: 'surface.status', status: 'drafting', text: 'Drafting layout' },
    })}\n`,
    artifactLine(),
  ], {
    mode: 'interactive',
    onSurfaceEvent: (event) => events.push(event.type),
  });

  assert.deepEqual(events, ['surface.status']);
  assert.equal(result.surfaceEvents.length, 1);
  assert.equal(result.streamGraph.preview.events.count, 1);
  assert.equal(result.streamGraph.preview.lastStatus, 'drafting');
  assert.equal(result.protocolLines.map((line) => line.op).join(','), 'event,artifact');
});

test('consumeSurfaceStream delivers validated HTML artifacts and patch fragments', async () => {
  const artifacts: string[] = [];
  const patches: string[] = [];
  const result = await consumeSurfaceStream([
    htmlArtifactLine(),
    htmlPatchLine(),
  ], {
    mode: 'static',
    onArtifact: (artifact) => {
      if (artifact.runtime === 'html') artifacts.push(artifact.source['body.html']);
    },
    onHtmlPatch: (patch) => patches.push(patch.html ?? ''),
  });

  assert.deepEqual(artifacts, ['<section id="hero"><h1>HTML</h1></section>']);
  assert.deepEqual(patches, ['<section id="hero"><h2>Updated</h2></section>']);
  assert.equal(result.htmlPatches.length, 1);
  assert.equal(result.streamGraph.artifacts.at(-1)?.runtime, 'html');
});

test('consumeSurfaceStream gates scripted HTML artifacts on experimentalHtmlScript', async () => {
  const withoutScriptTrust: string[] = [];
  const blocked = await consumeSurfaceStream([
    htmlScriptArtifactLine('document.getElementById("probe")?.setAttribute("data-ready", "true");'),
  ], {
    mode: 'static',
    onArtifact: (artifact) => {
      if (artifact.runtime === 'html') withoutScriptTrust.push(artifact.source['main.js'] ?? '');
    },
  });

  assert.deepEqual(withoutScriptTrust, []);
  assert.deepEqual(blocked.validationIssues.map((issue) => issue.code), ['html-script-not-enabled']);

  const withScriptTrust: string[] = [];
  const accepted = await consumeSurfaceStream([
    htmlScriptArtifactLine('document.getElementById("probe")?.setAttribute("data-ready", "true");'),
  ], {
    mode: 'static',
    validationContext: {
      mode: 'static',
      allowedTools: [],
      tools: [],
      experimentalHtmlScript: true,
    },
    onArtifact: (artifact) => {
      if (artifact.runtime === 'html') withScriptTrust.push(artifact.source['main.js'] ?? '');
    },
  });

  assert.deepEqual(accepted.validationIssues.map((issue) => issue.code), []);
  assert.deepEqual(withScriptTrust, ['document.getElementById("probe")?.setAttribute("data-ready", "true");']);
});

test('consumeSurfaceStream blocks invalid HTML patches before callback delivery', async () => {
  const patches: string[] = [];
  const result = await consumeSurfaceStream([
    htmlPatchLine('<img src="https://example.test/a.png" alt="x">'),
  ], {
    mode: 'static',
    onHtmlPatch: (patch) => patches.push(patch.html ?? ''),
  });

  assert.deepEqual(patches, []);
  assert.deepEqual(result.validationIssues.map((issue) => issue.code), ['external-url']);
  assert.equal(result.protocolLines.length, 0);
});

test('consumeSurfaceStream accepts host-owned contract and rendering phases', async () => {
  const result = await consumeSurfaceStream([
    `${JSON.stringify({
      op: 'event',
      path: '/surface',
      value: { type: 'surface.status', status: 'contract', text: 'Compiling host contract' },
    })}\n`,
    `${JSON.stringify({
      op: 'event',
      path: '/surface',
      value: { type: 'surface.status', status: 'rendering', text: 'Rendering accepted artifact' },
    })}\n`,
  ], {
    mode: 'interactive',
  });

  assert.equal(result.surfaceEvents.length, 2);
  assert.equal(result.streamGraph.preview.events.count, 2);
  assert.equal(result.streamGraph.preview.lastStatus, 'rendering');
  assert.equal(result.streamGraph.preview.lastStatusText, 'Rendering accepted artifact');
});

test('consumeSurfaceStream skips invalid preview events without delivering executable UI', async () => {
  const events: string[] = [];
  const result = await consumeSurfaceStream([
    `${JSON.stringify({
      op: 'event',
      path: '/surface',
      value: { type: 'node.add', id: 'missing-parent', kind: 'text' },
    })}\n`,
    artifactLine(),
  ], {
    mode: 'interactive',
    onSurfaceEvent: (event) => events.push(event.type),
  });

  assert.deepEqual(events, []);
  assert.equal(result.surfaceEvents.length, 0);
  assert.deepEqual(result.validationIssues.map((issue) => issue.code), ['invalid-surface-event']);
  assert.equal(result.streamGraph.health.blockedCount, 1);
  assert.deepEqual(result.protocolLines.map((line) => line.op), ['artifact']);
});

test('consumeSurfaceStream accepts Uint8Array and ReadableStream sources', async () => {
  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(artifactLine()));
      controller.close();
    },
  });

  const bytesResult = await consumeSurfaceStream([
    encoder.encode(artifactLine()),
  ], {
    mode: 'static',
  });
  const streamResult = await consumeSurfaceStream(readable, {
    mode: 'static',
  });

  assert.equal(bytesResult.protocolLines.length, 1);
  assert.equal(streamResult.protocolLines.length, 1);
});

test('consumeSurfaceStream blocks Arrow artifacts that use ungranted network access before callback delivery', async () => {
  const artifacts: string[] = [];
  const result = await consumeSurfaceStream([
    artifactLine('import { html } from "@arrow-js/core";\nvoid fetch("https://example.test/track");\nexport default html`<div>Weather</div>`'),
  ], {
    mode: 'interactive',
    onArtifact: (artifact) => artifacts.push(artifact.source['main.ts'] ?? ''),
  });

  assert.deepEqual(artifacts, []);
  assert.equal(result.protocolLines.length, 0);
  assert.deepEqual(result.validationIssues.map((issue) => issue.code), [
    'arrow-network-not-granted',
  ]);
  assert.equal(result.streamGraph.health.blockedCount, 1);
});

test('consumeSurfaceStream accepts idiomatic Arrow IDL and open-tag bindings (subset restriction removed)', async () => {
  // Experiment 2026-06-25: `.value=` IDL bindings and open-tag template
  // expressions are valid @arrow-js/core and are no longer blocked.
  const idlArtifacts: string[] = [];
  const idlResult = await consumeSurfaceStream([
    artifactLine('import { html } from "@arrow-js/core";\nexport default html`<input .value=${state.title}>`'),
  ], {
    mode: 'interactive',
    onArtifact: (artifact) => idlArtifacts.push(artifact.source['main.ts'] ?? ''),
  });
  assert.equal(idlArtifacts.length, 1);
  assert.match(idlArtifacts[0]!, /\.value=/);
  assert.deepEqual(idlResult.validationIssues.map((issue) => issue.code), []);
  assert.equal(idlResult.streamGraph.health.blockedCount, 0);

  const openTagArtifacts: string[] = [];
  const openTagResult = await consumeSurfaceStream([
    artifactLine('import { html } from "@arrow-js/core";\nexport default html`<button ${() => "disabled"}>Save</button>`'),
  ], {
    mode: 'interactive',
    onArtifact: (artifact) => openTagArtifacts.push(artifact.source['main.ts'] ?? ''),
  });
  assert.equal(openTagArtifacts.length, 1);
  assert.match(openTagArtifacts[0]!, /disabled/);
  assert.deepEqual(openTagResult.validationIssues.map((issue) => issue.code), []);
  assert.equal(openTagResult.streamGraph.health.blockedCount, 0);
});

test('consumeSurfaceStream rejects legacy section protocol at parse boundary', async () => {
  const result = await consumeSurfaceStream([
    '{"op":"set","path":"/screen","value":{"sections":["hero"]}}\n',
    '{"op":"add","path":"/section/hero","html":"<p>Legacy</p>"}\n',
  ], {
    mode: 'interactive',
    validationContext: {
      mode: 'interactive',
      surfacePlan: {
        purpose: 'inform',
        runtime: 'arrow',
        data: 'embedded',
        authority: 'none',
        persistence: 'replayable',
        network: 'none',
      },
    },
  });

  assert.equal(result.protocolLines.length, 0);
  assert.deepEqual(result.validationIssues.map((issue) => issue.code), []);
  assert.equal(result.parseErrors.length, 2);
  assert.equal(result.streamGraph.health.blockedCount, 0);
});

test('consumeSurfaceStream records malformed lines and calls parse-error callback', async () => {
  const parseErrors: string[] = [];
  const result = await consumeSurfaceStream([
    'not jsonl\n',
    artifactLine(),
  ], {
    mode: 'static',
    onParseError: (raw) => parseErrors.push(raw),
  });

  assert.deepEqual(parseErrors, ['not jsonl']);
  assert.equal(result.parseErrors.length, 1);
  assert.equal(result.protocolLines.length, 1);
});

test('consumeSurfaceStream delivers meta lines and collects validation-blocked issues', async () => {
  const metas: string[] = [];
  const result = await consumeSurfaceStream([
    `${JSON.stringify({
      op: 'meta',
      path: '/validation-blocked',
      value: {
        source: 'protocol',
        severity: 'block',
        code: 'arrow-only-protocol',
        message: 'old protocol',
      },
    })}\n`,
  ], {
    mode: 'interactive',
    onMeta: (line) => metas.push(line.path),
  });

  assert.deepEqual(metas, ['/validation-blocked']);
  assert.equal(result.validationIssues.length, 1);
  assert.equal(result.validationIssues[0]?.code, 'arrow-only-protocol');
  assert.equal(result.streamGraph.health.blockedCount, 1);
});

test('consumeSurfaceStream collects validation-summary examples without duplicating blocked issues', async () => {
  const blocked = {
    source: 'protocol',
    severity: 'block',
    code: 'arrow-only-protocol',
    message: 'old protocol',
  } as const;
  const warning = {
    source: 'token',
    severity: 'warn',
    code: 'unknown-token',
    message: 'token drift',
  } as const;

  const result = await consumeSurfaceStream([
    `${JSON.stringify({ op: 'meta', path: '/validation-blocked', value: blocked })}\n`,
    `${JSON.stringify({
      op: 'meta',
      path: '/validation-summary',
      value: {
        blocked: 1,
        warnings: 1,
        codes: { 'arrow-only-protocol': 1, 'unknown-token': 1 },
        examples: [blocked, warning],
      },
    })}\n`,
  ], {
    mode: 'interactive',
  });

  assert.deepEqual(result.validationIssues.map((issue) => issue.code), [
    'arrow-only-protocol',
    'unknown-token',
  ]);
});

test('consumeSurfaceStream can discard or stop before applying a line', async () => {
  const contexts: SurfaceStreamContext[] = [];
  let decisions = 0;
  const discardResult = await consumeSurfaceStream([
    artifactLine(),
    artifactLine('import { html } from "@arrow-js/core";\nexport default html`<p>Keep</p>`'),
  ], {
    mode: 'static',
    shouldApplyLine: () => decisions++ === 0 ? 'discard' : 'apply',
    onLine: (_line, context) => contexts.push(context),
  });

  assert.equal(discardResult.discarded, true);
  assert.equal(discardResult.stopped, false);
  assert.equal(discardResult.protocolLines.length, 1);

  const stopResult = await consumeSurfaceStream([
    artifactLine(),
  ], {
    mode: 'static',
    shouldApplyLine: () => 'stop',
  });

  assert.equal(stopResult.stopped, true);
  assert.equal(stopResult.discarded, true);
  assert.equal(stopResult.protocolLines.length, 0);
});

test('consumeSurfaceStream can use a supplied graph instance', async () => {
  const streamGraph = new StreamGraph();
  const result = await consumeSurfaceStream([
    artifactLine(),
  ], {
    mode: () => 'interactive',
    streamGraph,
  });

  assert.deepEqual(result.streamGraph, streamGraph.snapshot());
});
