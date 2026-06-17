import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { defineReactComponent, SummonSurface, type SummonSurfaceHandle } from '@anarchitecture/summon-react';
import { createComponentRegistry } from '@anarchitecture/summon';
import { z } from 'zod';
import { AppNav, LogView, PageHeader, Pane } from '../components/chrome.js';
import { cn } from '../lib/cn.js';
import { logToneClass, pageWidthClass } from '../components/ui.js';
import { STRICT_DEMO_ARTIFACT } from '../strict-demo-artifact.js';

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
const strictTools = ['submit_strict_input'];

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

interface StrictCardInputProps {
  slot: string;
  cardValueRef: MutableRefObject<string>;
  stateRef: MutableRefObject<StrictState>;
  line: (cls: string, text: string) => void;
  pushStrictState: (patch: Partial<StrictState>) => Record<string, unknown>;
}

function StrictCardInputOverlay({
  slot,
  cardValueRef,
  stateRef,
  line,
  pushStrictState,
}: StrictCardInputProps) {
  const [value, setValue] = useState(() => formatCard(cardValueRef.current));

  useEffect(() => {
    if (!stateRef.current.cardMounted) {
      line('info', `→ mount_strict_input slot=${slot} kind=card`);
      pushStrictState({ cardMounted: true });
    }
    return () => {
      cardValueRef.current = '';
      pushStrictState({ cardMounted: false, cardFilled: false });
    };
  }, [cardValueRef, line, pushStrictState, slot, stateRef]);

  return (
    <div data-strict-slot={slot} className="h-full w-full">
      <input
        type="text"
        inputMode="numeric"
        autoComplete="cc-number"
        placeholder="4242 4242 4242 4242"
        value={value}
        onChange={(event) => {
          const formatted = formatCard(event.target.value);
          cardValueRef.current = formatted;
          setValue(formatted);
          const filled = luhnValid(formatted.replace(/\D/g, ''));
          if (filled !== stateRef.current.cardFilled) {
            line('info', `· ${slot} filled=${filled}`);
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
  );
}

export function StrictPage() {
  const surfaceRef = useRef<SummonSurfaceHandle>(null);
  const stateRef = useRef<StrictState>(initialStrictState);
  const cardValueRef = useRef('');
  const [, setState] = useState<StrictState>(initialStrictState);
  const [logs, setLogs] = useState<Array<{ cls: string; text: string }>>([]);

  const line = useCallback((cls: string, text: string) => {
    setLogs((items) => [...items, { cls, text }]);
  }, []);

  const pushStrictState = useCallback((patch: Partial<StrictState>): Record<string, unknown> => {
    const next = { ...stateRef.current, ...patch };
    stateRef.current = next;
    setState(next);
    surfaceRef.current?.pushState(next);
    return next as unknown as Record<string, unknown>;
  }, []);

  const onToolCall = useCallback(async (tool: string, args: Record<string, unknown>) => {
    if (tool === 'submit_strict_input') {
      const slot = String((args as { slot?: unknown }).slot ?? 'card_number');
      line('info', `→ submit_strict_input slot=${slot}`);
      pushStrictState({ tokenizing: true, error: null });
      await new Promise((resolve) => window.setTimeout(resolve, 400));
      const digits = cardValueRef.current.replace(/\D/g, '');
      if (!luhnValid(digits)) {
        line('fail', `✗ ${slot}: invalid card number`);
        return pushStrictState({ tokenizing: false, error: 'invalid card number' });
      }
      const token = {
        id: `tok_${Math.random().toString(36).slice(2, 12)}`,
        last4: digits.slice(-4),
      };
      line('pass', `✓ ${slot} tokenized: last4=${token.last4}`);
      return pushStrictState({ tokenizing: false, token, error: null });
    }
    return stateRef.current as unknown as Record<string, unknown>;
  }, [line, pushStrictState]);
  const onToolRejected = useCallback((reason: string, raw: unknown) => {
    const tool = (raw as { tool?: string }).tool ?? '?';
    line('fail', `✗ request rejected "${tool}": ${reason}`);
  }, [line]);

  const componentRegistry = useMemo(() => createComponentRegistry([
    defineReactComponent<{ slot?: string }, StrictCardInputProps>({
      name: 'StrictCardInput',
      description: 'Host-owned card input rendered over a generated placeholder.',
      propsSchema: z.object({ slot: z.string().default('card_number') }),
      propsSchemaText: '{"slot":"card_number"}',
      surface: { data: 'embedded', authority: 'none' },
      component: StrictCardInputOverlay,
      mapProps: (props) => ({
        slot: props.slot ?? 'card_number',
        cardValueRef,
        stateRef,
        line,
        pushStrictState,
      }),
    }),
  ]), [line, pushStrictState]);

  return (
    <>
      <AppNav />
      <PageHeader
        title="Strict tier - host-owned card input"
        lede={(
          <>
            Outer sandbox draws the form layout but does <em>not</em> render the card field. It reserves a sanctioned
            component placeholder, and the host overlays a trusted input on top. Outer never sees the digits - only a
            tokenized result.
          </>
        )}
      />
      <div className={cn(pageWidthClass, 'grid grid-cols-[1.4fr_1fr] gap-5 max-[820px]:grid-cols-1')}>
        <Pane title="Sandbox iframe (overlay sits on top)">
          <SummonSurface
            ref={surfaceRef}
            id="sandbox"
            className="h-[540px]"
            title="Summon strict-tier demo"
            artifact={STRICT_DEMO_ARTIFACT}
            grantedTools={strictTools}
            componentRegistry={componentRegistry}
            initialState={initialStrictSurfaceState}
            onToolCall={onToolCall}
            onToolRejected={onToolRejected}
          />
        </Pane>
        <Pane title="Host bridge log">
          <LogView id="log" className="max-h-[540px]">
            {logs.map((log, index) => <div key={index} className={logToneClass(log.cls)}>{log.text}</div>)}
          </LogView>
        </Pane>
      </div>
    </>
  );
}
