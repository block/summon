# Mobile WebViews

Summon is web-first. A WebView host may embed Summon only if it preserves the same governance boundary as the browser host.

## Requirements

- Generated behavior must run inside Summon's descriptor runtime, not directly in the page/native bridge.
- Native privileges stay with the host app.
- Product data and side effects flow through registered host tools.
- Surface Document HTML remains inert; optional behavior runs against the descriptor DOM.
- The WebView host must not expose ambient native APIs, storage, network, or privileged globals to generated code.

## Degrade safely

If the host cannot prove the runtime boundary holds in a WebView, render inert/static surfaces only or do not mount generated UI.

## Test before shipping

Run the adversarial/safety harness in the target WebView environment, not just desktop Chrome:

```sh
pnpm test:safety
```
