import type { ArrowSurfaceArtifact } from '@anarchitecture/summon/engine';

const adversarialMain = `
import { html } from "@arrow-js/core";
import { callTool } from "host-bridge:summon";

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
      throw new Error(name + " unavailable inside Arrow VM");
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
    "document",
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
    "HTMLElement",
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
  await expectBlocked("emit-unknown-tool", () => rejectedTool("emit-unknown-tool", "exfiltrate", { data: "secret" }));
  await expectBlocked("emit-declared-but-not-granted", () => rejectedTool("emit-declared-but-not-granted", "escalate", { test: "emit-declared-but-not-granted" }));
  await expectBlocked("empty-tool-name", () => rejectedTool("empty-tool-name", "", {}));
  await report("__DONE__", "info", "");
}

void runAll();

export default html\`
  <div style="padding:var(--space-4);font-family:var(--font-mono);font-size:var(--text-xs)">
    <div style="font-weight:600;margin-bottom:var(--space-2)">Adversarial sandbox</div>
    <div>Running Arrow VM boundary checks and reporting back through callTool().</div>
    <div id="marker" style="margin-top:var(--space-3);color:var(--color-text-muted)">Tests started</div>
  </div>
\`;
`;

export const ADVERSARIAL_ARTIFACT: ArrowSurfaceArtifact = {
  runtime: 'arrow',
  source: {
    'main.ts': adversarialMain,
  },
};
