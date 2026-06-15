/**
 * Strict-tier demo artifact. The outer (LLM-style) sandbox renders the form
 * shell — labels, layout, copy, submit button — but the actual card-number
 * input is rendered by the host as an overlay. Outer never sees the digits.
 *
 * Outer's role:
 *   - Reserve a placeholder div sized for the input.
 *   - Emit `mount_strict_input` with bounds and kind:'card'.
 *   - Watch state for filled/tokenized signals; gate submit on them.
 *   - Emit `submit_strict_input` when the user clicks Pay.
 *
 * Host's role (in the React StrictPage):
 *   - Position a host-trusted card input over the placeholder.
 *   - Tokenize on submit; push back a state patch with last4 + token.
 */
export const STRICT_DEMO_BODY_HTML = /* html */ `
<div class="wrap">
  <header>
    <h1>Subscribe</h1>
    <p>The form is generated. The card field is not.</p>
  </header>

  <div class="explainer">
    Outer sandbox is null-origin and could be LLM-authored. It draws the
    layout, labels, and submit button. The host overlays a trusted card
    input on the placeholder below — the outer never sees keystrokes.
  </div>

  <form id="form">
    <label>
      <span>Email</span>
      <input id="email" type="email" autocomplete="email" placeholder="you@example.com">
    </label>

    <label>
      <span>Card number</span>
      <!-- The host overlays its trusted input on this div. We never read its value. -->
      <div id="card-slot" class="strict-slot">
        <span class="strict-pending">waiting for host overlay…</span>
      </div>
      <small id="card-status" class="hint">Mount status: pending</small>
    </label>

    <button id="pay" type="submit" disabled>Pay</button>
    <div id="result" class="result" hidden></div>
  </form>
</div>

<style>
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

  /* Placeholder for the host-overlaid input. Host fills its own DOM here. */
  .strict-slot {
    height: 44px;
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-md);
    background: repeating-linear-gradient(
      45deg,
      var(--color-surface-muted),
      var(--color-surface-muted) 4px,
      transparent 4px,
      transparent 8px
    );
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
  button:disabled { opacity: 0.4; cursor: not-allowed; }

  .result {
    padding: var(--space-3);
    background: var(--color-surface-muted);
    border-radius: var(--radius-md);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-text);
  }
  .result strong { color: var(--color-success); }
</style>

<script>
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  const slotEl = document.getElementById('card-slot');
  const cardStatus = document.getElementById('card-status');
  const payBtn = document.getElementById('pay');
  const resultEl = document.getElementById('result');
  const form = document.getElementById('form');

  // Report the placeholder's bounds (in our own viewport coords). Host adds its
  // own iframe offset to land the overlay in the right screen pixels.
  function emitMount() {
    const rect = slotEl.getBoundingClientRect();
    sandbox.emit('mount_strict_input', {
      slot: 'card_number',
      kind: 'card',
      bounds: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
    });
  }

  // Defer to next frame so layout has settled and getBoundingClientRect is final.
  requestAnimationFrame(emitMount);

  // If the artifact is resized (e.g. host rerenders, font loads), re-emit so the
  // overlay tracks. ResizeObserver would be more robust; this covers the basics.
  window.addEventListener('resize', emitMount);

  sandbox.onState(state => {
    cardStatus.textContent = 'Mount status: ' + (state.cardMounted ? 'mounted' : 'pending');
    if (state.cardFilled !== undefined) {
      cardStatus.textContent += state.cardFilled ? ' · filled' : ' · empty';
    }
    payBtn.disabled = !(state.cardFilled && !state.tokenizing);
    if (state.tokenizing) {
      payBtn.textContent = 'Tokenizing…';
    } else {
      payBtn.textContent = 'Pay';
    }
    if (state.token) {
      resultEl.hidden = false;
      resultEl.innerHTML =
        '<strong>Tokenized.</strong> last4=' + esc(state.token.last4) +
        ' · token=' + esc(state.token.id);
    }
    if (state.error) {
      resultEl.hidden = false;
      resultEl.textContent = 'Error: ' + state.error;
    }
  });

  function submitCard(e) {
    e.preventDefault();
    sandbox.emit('submit_strict_input', { slot: 'card_number' });
  }

  payBtn.addEventListener('click', submitCard);
  form.addEventListener('submit', submitCard);
</script>
`;
