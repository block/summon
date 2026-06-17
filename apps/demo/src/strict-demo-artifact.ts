import type { ArrowSurfaceArtifact } from '@anarchitecture/summon/engine';

const strictMain = `
import { html, reactive } from "@arrow-js/core";
import { callTool, onState } from "host-bridge:summon";

const state = reactive({
  cardMounted: false,
  cardFilled: false,
  tokenizing: false,
  token: null,
  error: null,
});

function applyHostState(hostState) {
  state.cardMounted = Boolean(hostState.cardMounted);
  state.cardFilled = Boolean(hostState.cardFilled);
  state.tokenizing = Boolean(hostState.tokenizing);
  state.token = hostState.token || null;
  state.error = typeof hostState.error === "string" ? hostState.error : null;
}

onState(applyHostState);

async function submitCard(event) {
  if (event && typeof event.preventDefault === "function") event.preventDefault();
  if (state.tokenizing) return;
  state.tokenizing = true;
  const result = await callTool("submit_strict_input", { slot: "card_number" });
  if (result && result.ok) {
    applyHostState(result.state || {});
  } else {
    state.tokenizing = false;
    state.error = result && result.error ? result.error : "tokenization failed";
  }
}

export default html\`
  <div class="wrap">
    <header>
      <h1>Subscribe</h1>
      <p>The form is generated. The card field is not.</p>
    </header>

    <div class="explainer">
      Outer sandbox is null-origin and could be LLM-authored. It draws the
      layout, labels, and submit button. The host overlays a trusted card
      input on the placeholder below. The outer never sees keystrokes.
    </div>

    <form id="form" @submit="\${submitCard}">
      <label>
        <span>Email</span>
        <input id="email" type="email" autocomplete="email" placeholder="you@example.com">
      </label>

      <label>
        <span>Card number</span>
        <div
          id="card-slot"
          class="strict-slot"
          data-summon-component="StrictCardInput"
          data-summon-component-id="card-number"
          data-summon-props='{"slot":"card_number"}'
        >
          <span class="strict-pending">\${() => state.cardMounted ? "host overlay mounted" : "waiting for host overlay"}</span>
        </div>
        <small id="card-status" class="hint">
          \${() => "Mount status: " + (state.cardMounted ? "mounted" : "pending") + (state.cardFilled ? " · filled" : " · empty")}
        </small>
      </label>

      <button id="pay" type="submit" class="\${() => state.cardFilled && !state.tokenizing ? "" : "disabled"}" @click="\${submitCard}">
        \${() => state.tokenizing ? "Tokenizing..." : "Pay"}
      </button>
      <div id="result" class="result">
        \${() => state.token ? "Tokenized. last4=" + state.token.last4 + " · token=" + state.token.id : state.error ? "Error: " + state.error : ""}
      </div>
    </form>
  </div>
\`;
`;

const strictCss = `
.wrap { padding: var(--space-5); max-width: 480px; }
header h1 { margin: 0 0 var(--space-1); font-size: var(--text-xl); }
header p { margin: 0 0 var(--space-4); color: var(--color-text-muted); font-size: var(--text-sm); }
.explainer {
  padding: var(--space-3);
  margin-bottom: var(--space-5);
  background: var(--color-surface-muted);
  border-left: 3px solid var(--color-accent);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  line-height: 1.5;
}
form { display: flex; flex-direction: column; gap: var(--space-4); }
label { display: flex; flex-direction: column; gap: var(--space-2); font-size: var(--text-sm); font-weight: 500; }
label span { color: var(--color-text); }
input {
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font: inherit;
  font-size: var(--text-base);
  background: var(--color-surface);
  color: var(--color-text);
}
input:focus { outline: 2px solid var(--color-accent); outline-offset: -1px; }
.strict-slot {
  height: 44px;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  display: flex;
  align-items: center;
  padding: 0 var(--space-3);
}
.strict-pending { color: var(--color-text-muted); font-size: var(--text-xs); font-family: var(--font-mono); }
.hint { color: var(--color-text-muted); font-size: var(--text-xs); font-weight: 400; }
button {
  padding: var(--space-3);
  background: var(--color-accent);
  color: var(--color-on-accent, white);
  border: 0;
  border-radius: var(--radius-md);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
button.disabled { opacity: 0.4; cursor: not-allowed; }
.result {
  min-height: 20px;
  padding: var(--space-3);
  background: var(--color-surface-muted);
  border-radius: var(--radius-md);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-text);
}
`;

export const STRICT_DEMO_ARTIFACT: ArrowSurfaceArtifact = {
  runtime: 'arrow',
  source: {
    'main.ts': strictMain,
    'main.css': strictCss,
  },
};
