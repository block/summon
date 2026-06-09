# Mobile WebView Requirements

Summon is web-first. Native iOS or Android wrappers are not part of V1, but any
WebView host must preserve the same shape: generated UI runs in a locked inner
surface, and native privileges stay with the host.

- Generated UI must never receive a native bridge object.
- Generated UI must run inside a sandboxed inner frame when the WebView supports
  iframe sandboxing.
- The outer native WebView owns credentials, network, durable state, and native
  APIs. It may pass safe state into Summon, but generated UI cannot call native
  APIs directly.
- If the host cannot prove an opaque/sandboxed inner boundary, degrade to
  read-only or declarative rendering with no scripts and no executable host
  tools.
- Treat WebKit safety tests as the feasible V1 proxy for WebView behavior, then
  add native wrapper tests before enabling privileged mobile bridges.
