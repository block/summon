# Mobile WebView Requirements

Summon is web-first. Native iOS or Android wrappers are not part of the current
supported runtime, but any WebView host must preserve the same shape: generated
logic runs inside the Arrow VM boundary, and native privileges stay with the
host.

- Generated UI must never receive a native bridge object.
- Generated Arrow logic must not receive `window`, `document`, storage, native
  bridges, or ambient WebView APIs.
- The outer native WebView owns credentials, network, durable state, and native
  APIs. It may pass safe state into Summon, but generated UI cannot call native
  APIs directly.
- If the host cannot prove the Arrow VM boundary holds in its WebView, degrade
  to read-only surfaces with no executable host tools.
- Treat WebKit safety tests as the feasible browser proxy for WebView behavior,
  then add native wrapper tests before enabling privileged mobile bridges.
