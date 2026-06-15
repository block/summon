import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type CSSProperties,
} from 'react';
import bootstrapSource from '@anarchitecture/summon/bootstrap.js?raw';
import tokensSource from '@anarchitecture/summon/tokens.css?raw';

export interface TrustedFixtureSurfaceHandle {
  iframe: HTMLIFrameElement | null;
  sandboxId: string | null;
  pushState(state: Record<string, unknown>): void;
}

export interface TrustedFixtureSurfaceProps {
  html: string;
  grantedIntents: string[];
  initialState?: Record<string, unknown>;
  onIntent?: (intent: string, args: Record<string, unknown>) => void;
  onIntentRejected?: (reason: string, raw: unknown) => void;
  onFatal?: (reason: string) => void;
  id?: string;
  title?: string;
  className?: string;
  style?: CSSProperties;
}

function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function escapeScript(s: string): string {
  return s.replace(/<\/script/gi, '<\\/script');
}

function escapeScriptJson(value: unknown): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

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

function nonceFixtureScripts(html: string, nonce: string): string {
  return html.replace(/<script\b(?![^>]*\bnonce=)/gi, `<script nonce="${nonce}"`);
}

function buildSrcdoc(params: {
  sandboxId: string;
  nonce: string;
  html: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Security-Policy" content="${escapeHtml(cspForNonce(params.nonce))}">
<meta charset="utf-8">
<script nonce="${params.nonce}">window.__SUMMON_SANDBOX_ID__=${escapeScriptJson(params.sandboxId)};window.__SUMMON_RESOURCES__={};</script>
<script nonce="${params.nonce}">${escapeScript(bootstrapSource)}</script>
<style>${tokensSource}</style>
</head>
<body><div id="summon-root">${nonceFixtureScripts(params.html, params.nonce)}</div><script nonce="${params.nonce}">window.__SUMMON_SIGNAL_READY__?.();</script></body>
</html>`;
}

/**
 * Demo-only escape hatch for trusted adversarial fixtures. It keeps the sandbox
 * and host intent bridge under test without letting generated artifacts regain
 * public script execution.
 */
export const TrustedFixtureSurface = forwardRef<TrustedFixtureSurfaceHandle, TrustedFixtureSurfaceProps>(
  function TrustedFixtureSurface(props, ref) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const sandboxId = useMemo(randomId, []);
    const nonce = useMemo(randomId, []);
    const readyRef = useRef(false);
    const pendingStatesRef = useRef<Record<string, unknown>[]>([]);

    function postState(state: Record<string, unknown>) {
      const iframe = iframeRef.current;
      if (!readyRef.current || !iframe?.contentWindow) {
        pendingStatesRef.current.push(state);
        return;
      }
      iframe.contentWindow.postMessage({
        type: 'SUMMON_STATE',
        sandbox_id: sandboxId,
        state,
      }, '*');
    }

    useImperativeHandle(ref, () => ({
      get iframe() {
        return iframeRef.current;
      },
      get sandboxId() {
        return sandboxId;
      },
      pushState(state: Record<string, unknown>) {
        postState(state);
      },
    }), [sandboxId]);

    useEffect(() => {
      readyRef.current = false;
      pendingStatesRef.current = props.initialState ? [props.initialState] : [];
      const intentAllowlist = new Set(props.grantedIntents);

      function flushPending() {
        const iframe = iframeRef.current;
        if (!readyRef.current || !iframe?.contentWindow) return;
        while (pendingStatesRef.current.length > 0) {
          const state = pendingStatesRef.current.shift()!;
          iframe.contentWindow.postMessage({
            type: 'SUMMON_STATE',
            sandbox_id: sandboxId,
            state,
          }, '*');
        }
      }

      function handleMessage(event: MessageEvent) {
        const data = event.data as {
          type?: string;
          sandbox_id?: string;
          reason?: unknown;
          intent?: unknown;
          args?: unknown;
        } | undefined;
        if (!data || typeof data !== 'object') return;
        if (
          data.type !== 'SUMMON_READY' &&
          data.type !== 'SUMMON_FATAL' &&
          data.type !== 'SUMMON_INTENT'
        ) {
          return;
        }
        if (data.sandbox_id !== sandboxId) return;

        if (data.type === 'SUMMON_FATAL') {
          readyRef.current = false;
          props.onFatal?.(typeof data.reason === 'string' ? data.reason : 'unknown');
          return;
        }

        if (data.type === 'SUMMON_READY') {
          readyRef.current = true;
          flushPending();
          return;
        }

        const intent = data.intent;
        if (typeof intent !== 'string' || !intent) {
          props.onIntentRejected?.('intent not a non-empty string', data);
          return;
        }
        if (!intentAllowlist.has(intent)) {
          props.onIntentRejected?.(`intent "${intent}" not granted`, data);
          return;
        }
        const args = data.args && typeof data.args === 'object'
          ? data.args as Record<string, unknown>
          : {};
        props.onIntent?.(intent, args);
      }

      window.addEventListener('message', handleMessage);
      if (iframeRef.current) {
        iframeRef.current.setAttribute('sandbox', 'allow-scripts');
        iframeRef.current.srcdoc = buildSrcdoc({
          sandboxId,
          nonce,
          html: props.html,
        });
      }

      return () => {
        window.removeEventListener('message', handleMessage);
        readyRef.current = false;
        pendingStatesRef.current = [];
        if (iframeRef.current) iframeRef.current.srcdoc = '';
      };
    }, [
      nonce,
      props.grantedIntents,
      props.html,
      props.initialState,
      props.onFatal,
      props.onIntent,
      props.onIntentRejected,
      sandboxId,
    ]);

    return (
      <iframe
        ref={iframeRef}
        id={props.id}
        title={props.title ?? 'Trusted Summon fixture'}
        className={props.className}
        style={props.style}
      />
    );
  },
);
