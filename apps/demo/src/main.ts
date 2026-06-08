import { spawnSandbox } from '@summon/host';
import bootstrapSource from '@summon/sandbox-runtime/bootstrap.js?raw';
import tokensSource from '@summon/sandbox-runtime/tokens.css?raw';
import { ADVERSARIAL_BODY_HTML } from './adversarial-artifact.js';

const iframe = document.getElementById('sandbox') as HTMLIFrameElement;
const results = document.getElementById('results')!;
const summary = document.getElementById('summary')!;

type Report = { test: string; status: 'blocked' | 'allowed' | 'info'; detail: string };
type Rejection = { reason: string; raw: unknown };

const reports: Report[] = [];
const rejections: Rejection[] = [];

/** Tests that emit() fires a call but the host must reject the resulting message. */
const EXPECTED_HOST_REJECTION = new Set([
  'emit-unknown-intent',
  'emit-declared-but-not-granted',
]);

function rejectionMatches(test: string): boolean {
  return rejections.some((r) => {
    const raw = r.raw as { args?: { test?: string; status?: string }; intent?: string };
    if (test === 'emit-unknown-intent') {
      return raw?.intent === 'exfiltrate';
    }
    if (test === 'emit-declared-but-not-granted') {
      return raw?.intent === 'escalate' && r.reason.includes('not granted');
    }
    return false;
  });
}

function judge(r: Report): 'pass' | 'fail' | 'info' {
  if (r.status === 'info') return 'info';
  if (EXPECTED_HOST_REJECTION.has(r.test)) {
    return rejectionMatches(r.test) ? 'pass' : 'fail';
  }
  return r.status === 'blocked' ? 'pass' : 'fail';
}

function renderResults() {
  const lines: string[] = [];
  let pass = 0;
  let fail = 0;
  let done = false;

  for (const r of reports) {
    if (r.test === '__DONE__') { done = true; continue; }
    const verdict = judge(r);
    if (verdict === 'pass') pass++;
    else if (verdict === 'fail') fail++;
    const cls = verdict === 'pass' ? 'pass' : verdict === 'fail' ? 'fail' : 'info';
    const mark = verdict === 'pass' ? '✓' : verdict === 'fail' ? '✗' : '·';
    const extra = EXPECTED_HOST_REJECTION.has(r.test) ? ' (host-rejected)' : '';
    lines.push(`<div class="${cls}">${mark} ${r.test} — ${r.status}${extra}${r.detail ? ': ' + r.detail : ''}</div>`);
  }

  if (rejections.length > 0) {
    lines.push('<div class="info" style="margin-top: 8px; border-top: 1px dashed #ccc; padding-top: 8px;">Host-side rejections:</div>');
    for (const rej of rejections) {
      const raw = rej.raw as { intent?: string; args?: unknown };
      const extra = raw?.intent ? ` intent="${raw.intent}"` : '';
      lines.push(`<div class="info">· ${rej.reason}${extra}</div>`);
    }
  }

  results.innerHTML = lines.join('');
  if (done) {
    summary.innerHTML = fail === 0
      ? `<span class="pass">All ${pass} tests passed.</span> Sandbox boundary holding.`
      : `<span class="fail">${fail} failed</span>, ${pass} passed. Review failures above.`;
  } else {
    summary.textContent = `${pass + fail} results in, running…`;
  }
}

spawnSandbox({
  iframe,
  artifact: {
    // Artifact deliberately over-declares — the bridge must ignore this and
    // honor the host's grant below. If grantedIntents were absent, this
    // would (insecurely) become the allowlist.
    intents: ['report', 'escalate'],
    html: ADVERSARIAL_BODY_HTML,
  },
  // Host-controlled grant: only 'report' is actually allowed through.
  grantedIntents: ['report'],
  bootstrapSource,
  tokensSource,
  onIntent: (intent, args) => {
    if (intent === 'report') {
      reports.push({
        test: String((args as { test?: unknown }).test ?? 'unknown'),
        status: String((args as { status?: unknown }).status ?? 'info') as Report['status'],
        detail: String((args as { detail?: unknown }).detail ?? ''),
      });
      renderResults();
    }
  },
  onIntentRejected: (reason, raw) => {
    rejections.push({ reason, raw });
    renderResults();
  },
});
