# Security posture

Summon treats model output as untrusted input. Generated UI is accepted only after host-owned policy selection, protocol validation, runtime validation, and artifact checks.

## Boundary

Surface Document is the preferred governed artifact shape:

```txt
main.html  -> inert structure
main.css   -> Ghost fingerprint styling
main.js    -> optional governed behavior
```

Security invariants:

- `main.html` is parsed into a descriptor tree, not assigned to browser `innerHTML`.
- Optional `main.js` runs in Summon's owned VM/facade, not the real DOM.
- Generated behavior has no ambient `window`, network, storage, cookies, or dynamic code execution.
- Product authority flows through host-granted `callTool()` calls.
- The host owns credentials, side effects, state, and authorization.

See [`../spec/surface-document.md`](../spec/surface-document.md).

## Host policy

A `SurfacePolicy` declares what the run may do. Summon compiles it to a stricter `SurfacePlan` and a prompt-facing `SurfaceContractView`. Generated declarations are advisory; they never become authority.

## Validation

Validation blocks unsafe artifacts before render. For Surface Document, common blockers include inline handlers, forbidden tags, external CSS imports/URLs, ambient network calls, unsupported APIs, and syntax errors.

## Tool calls

Every tool call is both:

1. an authorization decision, and
2. an observability event.

That is the core safety = observability collapse. If a behavior needs product data or side effects, it must call a granted host tool.

## Safety harness

Run the safety harness before changing runtime, protocol, generated network policy, or tool dispatch:

```sh
pnpm test:safety
```

The harness should protect against ambient authority, malformed protocol input, unsafe artifacts, and ungranted host tool execution.
