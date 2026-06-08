# Mobile WebView Requirements

Summon is web-first. Native iOS or Android wrappers are not part of V1, but any
WebView host must keep the same security shape as browser/Tauri hosts.

- Generated content must never receive a native bridge object.
- Generated content must run inside a sandboxed inner frame when the WebView
  supports iframe sandboxing.
- The outer native WebView owns credentials, network, durable state, and native
  APIs. It may pass safe state into Summon, but Summon artifacts cannot call
  native APIs directly.
- If the host cannot prove an opaque/sandboxed inner boundary, degrade to
  static or declarative rendering with no scripts and no executable grants.
- Treat WebKit safety tests as the feasible V1 proxy for WebView behavior, then
  add native wrapper tests before enabling privileged mobile bridges.
