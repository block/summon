/**
 * Strict-tier demo entry. The outer sandbox renders a subscribe form with a
 * placeholder div for the card field. The host overlays a trusted card input
 * on the placeholder. Outer never sees keystrokes; only a tokenized result.
 *
 * The card factory below is intentionally tiny — Luhn check + a fake "token"
 * synthesis. In a real app this is where Stripe Elements (or similar) plugs
 * in. The architectural property — outer describes, host renders — is the
 * same regardless of the tokenizer.
 */
import {
  PolicyEngine,
} from '@anarchitecture/summon';
import {
  spawnSandbox,
  createStrictInputRegistry,
  type SandboxHandle,
  type StrictInputController,
} from '@anarchitecture/summon/browser';
import bootstrapSource from '@anarchitecture/summon/bootstrap.js?raw';
import tokensSource from '@anarchitecture/summon/tokens.css?raw';
import { STRICT_DEMO_BODY_HTML } from './strict-demo-artifact.js';

const iframe = document.getElementById('sandbox') as HTMLIFrameElement;
const log = document.getElementById('log')!;

function line(cls: string, text: string) {
  const el = document.createElement('div');
  el.className = cls;
  el.textContent = text;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
}

/** Naive Luhn check. Card-form digits only — strip everything else first. */
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

/**
 * Factory for kind='card'. Returns a controller wrapping a host-trusted input.
 * Digits live in the closure; they never escape to the outer sandbox. Only
 * tokenize() exports a redacted, host-fabricated summary.
 */
function makeCardFactory() {
  return ({ onChange }: { slot: string; onChange: (filled: boolean) => void }): StrictInputController => {
    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.autocomplete = 'cc-number';
    input.placeholder = '4242 4242 4242 4242';
    input.style.cssText = `
      width: 100%; height: 100%; box-sizing: border-box;
      padding: 8px 12px; border: 2px solid #2563eb; border-radius: 8px;
      font: inherit; font-family: ui-monospace, Menlo, monospace;
      background: white; color: #111;
      letter-spacing: 0.05em;
    `;

    let lastFilled = false;
    function digits(): string {
      return input.value.replace(/\D/g, '');
    }
    function recompute() {
      const filled = luhnValid(digits());
      if (filled !== lastFilled) {
        lastFilled = filled;
        onChange(filled);
      }
      // Lightweight format-as-you-type: groups of 4.
      const d = digits().slice(0, 19);
      const formatted = d.replace(/(\d{4})/g, '$1 ').trim();
      if (input.value !== formatted) {
        const pos = input.selectionStart ?? formatted.length;
        input.value = formatted;
        const newPos = Math.min(pos + (formatted.length - d.length), formatted.length);
        try { input.setSelectionRange(newPos, newPos); } catch {}
      }
    }
    input.addEventListener('input', recompute);

    return {
      element: input,
      isFilled: () => lastFilled,
      tokenize: async () => {
        const d = digits();
        // Pretend network round-trip.
        await new Promise((r) => setTimeout(r, 400));
        const last4 = d.slice(-4);
        // Token is host-fabricated; outer never sees the digits.
        const id = 'tok_' + Math.random().toString(36).slice(2, 12);
        return { id, last4 };
      },
      destroy: () => {
        // Zero out the buffer before dropping the reference.
        input.value = '';
        input.removeEventListener('input', recompute);
        input.remove();
      },
    };
  };
}

let handle: SandboxHandle;
let policy: PolicyEngine;

// Registry produces and tracks the host-trusted overlay. Async callbacks
// (onChange / onSubmit / onError) push state directly because they fire
// outside any single intent's handler scope.
const strictRegistry = createStrictInputRegistry({
  outerIframe: iframe,
  hostContainer: document.body,
  kinds: { card: makeCardFactory() },
  onChange: (slot, { filled }) => {
    line('info', `· ${slot} filled=${filled}`);
    policy.pushState({ cardFilled: filled });
  },
  onSubmit: (slot, result) => {
    line('pass', `✓ ${slot} tokenized: last4=${(result as { last4?: string }).last4}`);
    policy.pushState({ tokenizing: false, token: result, error: null });
  },
  onError: (slot, reason) => {
    line('fail', `✗ ${slot}: ${reason}`);
    policy.pushState({ error: reason, tokenizing: false });
  },
});

policy = new PolicyEngine({
  initialState: {
    cardMounted: false,
    cardFilled: false,
    tokenizing: false,
    token: null,
    error: null,
  },
  handlers: {
    mount_strict_input: ({ args, push }) => {
      const { slot, kind, bounds } = args as {
        slot: string;
        kind: string;
        bounds: { x: number; y: number; width: number; height: number };
      };
      line('info', `→ mount_strict_input slot=${slot} kind=${kind}`);
      strictRegistry.mount({ slot, kind, bounds });
      push({ cardMounted: true });
    },
    submit_strict_input: async ({ args, push }) => {
      const { slot } = args as { slot: string };
      line('info', `→ submit_strict_input slot=${slot}`);
      push({ tokenizing: true, error: null });
      await strictRegistry.submit({ slot });
    },
    unmount_strict_input: ({ args, push }) => {
      const { slot } = args as { slot: string };
      strictRegistry.unmount({ slot });
      push({ cardMounted: false, cardFilled: false });
    },
  },
  onStateChange: (state) => {
    handle.pushState(state);
  },
  onHandlerError: (intent, err) => {
    line('fail', `✗ handler error (${intent}): ${err.message}`);
  },
});

handle = spawnSandbox({
  iframe,
  artifact: {
    intents: policy.intents,
    html: STRICT_DEMO_BODY_HTML,
    initialState: policy.getState(),
  },
  grantedIntents: policy.intents,
  bootstrapSource,
  tokensSource,
  onIntent: (intent, args) => {
    void policy.dispatch(intent, args);
  },
  onIntentRejected: (reason, raw) => {
    const intent = (raw as { intent?: string }).intent ?? '?';
    line('fail', `✗ bridge rejected intent "${intent}": ${reason}`);
  },
});

line(
  'info',
  `Sandbox spawned (${handle.sandboxId.slice(0, 8)}…). Granted: ${policy.intents.join(', ')}`,
);
