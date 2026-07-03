import type { SurfaceDocumentArtifact } from '@anarchitecture/summon/engine';

const adversarialMain = `
async function report(test, status, detail = "") {
  await callTool("report", { test, status, detail: String(detail) });
}

async function expectBlocked(name, fn) {
  try {
    const detail = await fn();
    await report(name, "allowed", detail);
  } catch (error) {
    await report(name, "blocked", error && error.message ? error.message : String(error));
  }
}

function missingGlobal(name) {
  return () => {
    if (typeof globalThis[name] === "undefined") {
      throw new Error(name + " unavailable inside the Summon VM");
    }
    return name + " was present";
  };
}

async function rejectedTool(name, tool, args) {
  const result = await callTool(tool, args);
  if (result && result.ok === false) {
    throw new Error(result.error || "tool rejected");
  }
  return "tool call resolved";
}

async function runAll() {
  const globals = [
    "window",
    "parent",
    "top",
    "location",
    "localStorage",
    "sessionStorage",
    "indexedDB",
    "navigator",
    "fetch",
    "XMLHttpRequest",
    "WebSocket",
    "EventSource",
    "Worker",
    "SharedWorker",
    "BroadcastChannel",
    "Image",
    "HTMLScriptElement",
    "HTMLIFrameElement",
    "MessageChannel",
    "Notification",
    "importScripts",
    "open",
    "postMessage",
    "cookieStore",
    "caches",
  ];
  for (const name of globals) {
    await expectBlocked("global-" + name, missingGlobal(name));
  }
  await expectBlocked("document-body", () => {
    if (typeof document.body === "undefined" || document.body === null) {
      throw new Error("document.body unavailable inside the Summon VM");
    }
    return "document.body was present";
  });
  await expectBlocked("emit-unknown-tool", () => rejectedTool("emit-unknown-tool", "exfiltrate", { data: "secret" }));
  await expectBlocked("emit-declared-but-not-granted", () => rejectedTool("emit-declared-but-not-granted", "escalate", { test: "emit-declared-but-not-granted" }));
  await expectBlocked("empty-tool-name", () => rejectedTool("empty-tool-name", "", {}));
  const marker = document.getElementById("marker");
  if (marker) marker.textContent = "Tests complete";
  await report("__DONE__", "info", "");
}

void runAll();
`;

export const ADVERSARIAL_ARTIFACT: SurfaceDocumentArtifact = {
  runtime: 'surface-document',
  source: {
    'main.html': [
      '<div class="adversarial">',
      '  <div class="adversarial-title">Adversarial sandbox</div>',
      '  <div>Running Summon VM boundary checks and reporting back through callTool().</div>',
      '  <div id="marker" class="adversarial-marker">Tests started</div>',
      '</div>',
    ].join('\n'),
    'main.css': [
      '.adversarial { padding: var(--space-4); font-family: var(--font-mono); font-size: var(--text-xs); }',
      '.adversarial-title { font-weight: 600; margin-bottom: var(--space-2); }',
      '.adversarial-marker { margin-top: var(--space-3); color: var(--color-text-muted); }',
    ].join('\n'),
    'main.js': adversarialMain,
  },
};
