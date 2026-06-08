import bootstrapSource from '@summon/sandbox-runtime/bootstrap.js?raw';
import tokensSource from '@summon/sandbox-runtime/tokens.css?raw';

/**
 * Self-test harness. We deliberately drive the bootstrap into two iframes:
 *   A — correctly configured (sandbox="allow-scripts"), expecting SUMMON_READY.
 *   B — misconfigured (sandbox="allow-scripts allow-same-origin"), expecting
 *       SUMMON_FATAL with a reason mentioning null-origin.
 *
 * srcdoc construction mirrors packages/host/src/sandbox-spawner.ts buildSrcdoc.
 * Kept intentionally separate from the production spawner so this test exercises
 * bootstrap independently — if buildSrcdoc and this template diverge, the test
 * will catch it on the next run.
 */

const CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data:",
  "font-src data:",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
  "frame-src 'none'",
  "child-src 'none'",
  "media-src 'none'",
  "object-src 'none'",
  "worker-src 'none'",
].join('; ');

function escapeHtml(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function buildSrcdoc(sandboxId: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Security-Policy" content="${escapeHtml(CSP)}">
<meta charset="utf-8">
<script>window.__SUMMON_SANDBOX_ID__=${JSON.stringify(sandboxId)};</script>
<script>${bootstrapSource}</script>
<style>${tokensSource}</style>
</head>
<body><div id="summon-root"></div></body>
</html>`;
}

interface CaseConfig {
  iframe: HTMLIFrameElement;
  result: HTMLElement;
  sandboxAttr: string;
  expect: 'ready' | 'fatal';
}

function runCase(cfg: CaseConfig) {
  const sandboxId = randomId();
  const verdict = (kind: 'pass' | 'fail' | 'info', text: string) => {
    cfg.result.innerHTML = `<div class="${kind}">${text}</div>`;
  };

  let settled = false;
  const onMessage = (event: MessageEvent) => {
    const data = event.data as { type?: string; sandbox_id?: string; reason?: string } | undefined;
    if (!data || typeof data !== 'object') return;
    if (data.sandbox_id !== sandboxId) return;
    if (data.type !== 'SUMMON_READY' && data.type !== 'SUMMON_FATAL') return;
    settled = true;
    window.removeEventListener('message', onMessage);
    const got = data.type === 'SUMMON_READY' ? 'ready' : 'fatal';
    if (got === cfg.expect) {
      const detail = got === 'fatal' && data.reason ? ` — reason: ${data.reason}` : '';
      verdict('pass', `✓ got ${data.type}${detail}`);
    } else {
      verdict('fail', `✗ expected ${cfg.expect.toUpperCase()}, got ${data.type}`);
    }
  };

  window.addEventListener('message', onMessage);
  cfg.iframe.setAttribute('sandbox', cfg.sandboxAttr);
  cfg.iframe.srcdoc = buildSrcdoc(sandboxId);

  setTimeout(() => {
    if (settled) return;
    window.removeEventListener('message', onMessage);
    verdict('fail', `✗ no message received within 2s (expected ${cfg.expect.toUpperCase()})`);
  }, 2000);
}

runCase({
  iframe: document.getElementById('case-a-frame') as HTMLIFrameElement,
  result: document.getElementById('case-a-result')!,
  sandboxAttr: 'allow-scripts',
  expect: 'ready',
});

runCase({
  iframe: document.getElementById('case-b-frame') as HTMLIFrameElement,
  result: document.getElementById('case-b-result')!,
  sandboxAttr: 'allow-scripts allow-same-origin',
  expect: 'fatal',
});
