import { useEffect, useMemo, useRef, useState } from 'react';
import bootstrapSource from '@anarchitecture/summon/bootstrap.js?raw';
import tokensSource from '@anarchitecture/summon/tokens.css?raw';
import { AppNav, PageHeader, Pane } from '../components/chrome.js';
import { cn } from '../lib/cn.js';
import { logToneClass, pageWidthClass } from '../components/ui.js';

function cspForNonce(nonce: string): string {
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
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
}

function escapeHtml(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function escapeScript(s: string): string {
  return s.replace(/<\/script/gi, '<\\/script');
}

function buildSrcdoc(sandboxId: string, nonce: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Security-Policy" content="${escapeHtml(cspForNonce(nonce))}">
<meta charset="utf-8">
<script nonce="${nonce}">window.__SUMMON_SANDBOX_ID__=${JSON.stringify(sandboxId)};window.__SUMMON_RESOURCES__={};</script>
<script nonce="${nonce}">${escapeScript(bootstrapSource)}</script>
<style>${tokensSource}</style>
</head>
<body><div id="summon-root"></div><script nonce="${nonce}">window.__SUMMON_SIGNAL_READY__?.();</script></body>
</html>`;
}

function FatalCase({
  id,
  title,
  description,
  sandbox,
  expect,
}: {
  id: 'case-a' | 'case-b';
  title: string;
  description: string;
  sandbox: string;
  expect: 'ready' | 'fatal';
}) {
  const sandboxId = useMemo(randomId, []);
  const nonce = useMemo(randomId, []);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [result, setResult] = useState<{ kind: 'pass' | 'fail' | 'info'; text: string }>({
    kind: 'info',
    text: '...',
  });

  useEffect(() => {
    let settled = false;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; sandbox_id?: string; reason?: string } | undefined;
      if (!data || typeof data !== 'object') return;
      if (data.sandbox_id !== sandboxId) return;
      if (data.type !== 'SUMMON_READY' && data.type !== 'SUMMON_FATAL') return;
      settled = true;
      const got = data.type === 'SUMMON_READY' ? 'ready' : 'fatal';
      if (got === expect) {
        const detail = got === 'fatal' && data.reason ? ` - reason: ${data.reason}` : '';
        setResult({ kind: 'pass', text: `✓ got ${data.type}${detail}` });
      } else {
        setResult({ kind: 'fail', text: `✗ expected ${expect.toUpperCase()}, got ${data.type}` });
      }
    };
    window.addEventListener('message', onMessage);
    const timer = window.setTimeout(() => {
      if (settled) return;
      setResult({
        kind: 'fail',
        text: `✗ no message received within 2s (expected ${expect.toUpperCase()})`,
      });
    }, 2000);
    if (iframeRef.current) {
      iframeRef.current.srcdoc = buildSrcdoc(sandboxId, nonce);
    }
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      if (iframeRef.current) iframeRef.current.srcdoc = '';
    };
  }, [expect, nonce, sandboxId]);

  return (
    <section className={cn(pageWidthClass, 'mb-8 rounded-card p-5')}>
      <h2 className="m-0 mb-1 text-[clamp(18px,1.6vw,22px)] font-semibold leading-[1.15] tracking-normal text-ink">{title}</h2>
      <p className="m-0 mb-3.5 max-w-[72ch] text-[13px] text-ink-soft">{description}</p>
      <div className="grid grid-cols-2 gap-5 max-[820px]:grid-cols-1">
        <Pane title="Sandbox iframe">
          <iframe
            ref={iframeRef}
            id={`${id}-frame`}
            className="h-[200px]"
            title={id === 'case-a' ? 'control' : 'misconfigured'}
            sandbox={sandbox}
          />
        </Pane>
        <Pane title="Result">
          <div id={`${id}-result`} className="px-[18px] py-3.5 font-mono text-xs leading-[1.7]">
            <div className={logToneClass(result.kind)}>{result.text}</div>
          </div>
        </Pane>
      </div>
    </section>
  );
}

export function FatalPage() {
  return (
    <>
      <AppNav />
      <PageHeader
        title="Bootstrap self-test"
        lede="Drives bootstrap into a deliberately misconfigured sandbox. Bootstrap's startup self-test should detect the regression and post SUMMON_FATAL instead of SUMMON_READY."
      />

      <FatalCase
        id="case-a"
        title="Case A - correctly configured (control)"
        description='sandbox="allow-scripts" - null-origin. Self-test should pass and bootstrap should post SUMMON_READY.'
        sandbox="allow-scripts"
        expect="ready"
      />
      <FatalCase
        id="case-b"
        title="Case B - misconfigured (allow-same-origin)"
        description='sandbox="allow-scripts allow-same-origin" - same-origin with parent. Self-test should detect and post SUMMON_FATAL.'
        sandbox="allow-scripts allow-same-origin"
        expect="fatal"
      />
    </>
  );
}
