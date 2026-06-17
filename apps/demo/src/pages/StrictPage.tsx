import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AppNav, LogView, PageHeader, Pane } from '../components/chrome.js';
import { TrustedFixtureSurface, type TrustedFixtureSurfaceHandle } from '../components/TrustedFixtureSurface.js';
import { cn } from '../lib/cn.js';
import { logToneClass, pageWidthClass } from '../components/ui.js';
import { STRICT_DEMO_BODY_HTML } from '../strict-demo-artifact.js';

interface StrictBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface StrictState {
  cardMounted: boolean;
  cardFilled: boolean;
  tokenizing: boolean;
  token: { id: string; last4: string } | null;
  error: string | null;
}

const initialStrictState: StrictState = {
  cardMounted: false,
  cardFilled: false,
  tokenizing: false,
  token: null,
  error: null,
};
const initialStrictSurfaceState = initialStrictState as unknown as Record<string, unknown>;
const strictIntents = ['mount_strict_input', 'submit_strict_input', 'unmount_strict_input'];

function luhnValid(digits: string): boolean {
  if (digits.length < 12) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (n < 0 || n > 9) return false;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function formatCard(value: string): string {
  return value.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})/g, '$1 ').trim();
}

export function StrictPage() {
  const surfaceRef = useRef<TrustedFixtureSurfaceHandle>(null);
  const stateRef = useRef<StrictState>(initialStrictState);
  const cardValueRef = useRef('');
  const [, setState] = useState<StrictState>(initialStrictState);
  const [logs, setLogs] = useState<Array<{ cls: string; text: string }>>([]);
  const [bounds, setBounds] = useState<StrictBounds | null>(null);
  const [cardValue, setCardValue] = useState('');
  const [overlayStyle, setOverlayStyle] = useState<CSSProperties | null>(null);

  const line = useCallback((cls: string, text: string) => {
    setLogs((items) => [...items, { cls, text }]);
  }, []);

  const pushStrictState = useCallback((patch: Partial<StrictState>) => {
    const next = { ...stateRef.current, ...patch };
    stateRef.current = next;
    setState(next);
    surfaceRef.current?.pushState(next);
  }, []);

  const syncOverlayPosition = useCallback(() => {
    const iframe = surfaceRef.current?.iframe;
    if (!iframe || !bounds) {
      setOverlayStyle(null);
      return;
    }
    const rect = iframe.getBoundingClientRect();
    setOverlayStyle({
      position: 'fixed',
      left: rect.left + bounds.x,
      top: rect.top + bounds.y,
      width: bounds.width,
      height: bounds.height,
      zIndex: 9999,
    });
  }, [bounds]);

  useEffect(() => {
    syncOverlayPosition();
    window.addEventListener('resize', syncOverlayPosition);
    window.addEventListener('scroll', syncOverlayPosition, { passive: true });
    return () => {
      window.removeEventListener('resize', syncOverlayPosition);
      window.removeEventListener('scroll', syncOverlayPosition);
    };
  }, [syncOverlayPosition]);

  const onIntent = useCallback(async (intent: string, args: Record<string, unknown>) => {
    if (intent === 'mount_strict_input') {
      const nextBounds = (args as { bounds?: StrictBounds }).bounds;
      if (!nextBounds) return;
      setBounds(nextBounds);
      line('info', `→ mount_strict_input slot=${String(args.slot)} kind=${String(args.kind)}`);
      pushStrictState({ cardMounted: true });
      return;
    }
    if (intent === 'submit_strict_input') {
      const slot = String((args as { slot?: unknown }).slot ?? 'card_number');
      line('info', `→ submit_strict_input slot=${slot}`);
      pushStrictState({ tokenizing: true, error: null });
      await new Promise((resolve) => window.setTimeout(resolve, 400));
      const digits = cardValueRef.current.replace(/\D/g, '');
      if (!luhnValid(digits)) {
        line('fail', `✗ ${slot}: invalid card number`);
        pushStrictState({ tokenizing: false, error: 'invalid card number' });
        return;
      }
      const token = {
        id: `tok_${Math.random().toString(36).slice(2, 12)}`,
        last4: digits.slice(-4),
      };
      line('pass', `✓ ${slot} tokenized: last4=${token.last4}`);
      pushStrictState({ tokenizing: false, token, error: null });
      return;
    }
    if (intent === 'unmount_strict_input') {
      setBounds(null);
      setCardValue('');
      pushStrictState({ cardMounted: false, cardFilled: false });
    }
  }, [line, pushStrictState]);
  const onIntentRejected = useCallback((reason: string, raw: unknown) => {
    const intent = (raw as { intent?: string }).intent ?? '?';
    line('fail', `✗ request rejected "${intent}": ${reason}`);
  }, [line]);

  const formattedValue = useMemo(() => formatCard(cardValue), [cardValue]);

  useEffect(() => {
    cardValueRef.current = cardValue;
  }, [cardValue]);

  return (
    <>
      <AppNav />
      <PageHeader
        title="Strict tier - host-owned card input"
        lede={(
          <>
            Outer sandbox draws the form layout but does <em>not</em> render the card field. It reserves a placeholder,
            emits <code className="rounded-control bg-surface-muted px-1.5 py-px font-mono text-[0.92em]">mount_strict_input</code> with bounds,
            and the host overlays a trusted input on top. Outer never sees the digits - only a tokenized result.
          </>
        )}
      />
      <div className={cn(pageWidthClass, 'grid grid-cols-[1.4fr_1fr] gap-5 max-[820px]:grid-cols-1')}>
        <Pane title="Sandbox iframe (overlay sits on top)">
          <TrustedFixtureSurface
            ref={surfaceRef}
            id="sandbox"
            className="h-[540px]"
            title="Summon strict-tier demo"
            html={STRICT_DEMO_BODY_HTML}
            grantedIntents={strictIntents}
            initialState={initialStrictSurfaceState}
            onIntent={onIntent}
            onIntentRejected={onIntentRejected}
          />
        </Pane>
        <Pane title="Host bridge log">
          <LogView id="log" className="max-h-[540px]">
            {logs.map((log, index) => <div key={index} className={logToneClass(log.cls)}>{log.text}</div>)}
          </LogView>
        </Pane>
      </div>

      {overlayStyle ? (
        <div data-strict-slot="card_number" style={overlayStyle}>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="4242 4242 4242 4242"
            value={formattedValue}
            onChange={(event) => {
              const next = event.target.value;
              setCardValue(next);
              const filled = luhnValid(next.replace(/\D/g, ''));
              if (filled !== stateRef.current.cardFilled) {
                line('info', `· card_number filled=${filled}`);
                pushStrictState({ cardFilled: filled });
              }
            }}
            style={{
              width: '100%',
              height: '100%',
              boxSizing: 'border-box',
              padding: '8px 12px',
              border: '2px solid #2563eb',
              borderRadius: 8,
              font: 'inherit',
              fontFamily: 'ui-monospace, Menlo, monospace',
              background: 'white',
              color: '#111',
              letterSpacing: '0.05em',
            }}
          />
        </div>
      ) : null}
    </>
  );
}
