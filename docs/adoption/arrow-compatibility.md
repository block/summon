# Arrow Compatibility Notes

Summon renders generated UI as Arrow sandbox bundles. This page separates
Arrow syntax and runtime compatibility from Summon's host policy and sandbox
subset so diagnostics do not blame the wrong layer.

## Failure layers

| Layer | Example | Summon behavior |
| --- | --- | --- |
| JavaScript/TypeScript syntax | Unterminated string literal in `main.ts` | Block before sandbox mount with `invalid-arrow-source-syntax`; repair when configured. |
| Arrow/runtime syntax | Invalid Arrow template shape that the sandbox compiler cannot execute | Validate or reproduce against `@arrow-js/sandbox` before adding a Summon-specific rule. |
| Summon sandbox subset | Patterns not yet verified in Summon's hardened Arrow sandbox, such as bare dynamic opening-tag expressions | Block with a clear unsupported-subset diagnostic and keep instructions/examples narrow. |
| Summon host policy | `fetch()`, storage, ambient browser globals, unknown host tools | Block because generated UI lacks host-granted authority, even if the JavaScript would be valid elsewhere. |

## Syntax errors are not Arrow semantics

If the sandbox reports TypeScript parser diagnostics such as:

```txt
',' expected
Identifier expected
Unterminated string literal
':' expected
```

then the generated entry file is not valid JavaScript/TypeScript. Arrow cannot
interpret the file because the module cannot be parsed. Summon validates this on
the server with the TypeScript compiler API before emitting an accepted
artifact. The issue code is `invalid-arrow-source-syntax`, and diagnostics
include the source file, line, column, and a small excerpt.

In enforced generation, this issue is repairable. In playground generation,
Summon still observes policy/subset blockers, but it allows a syntax-only repair
attempt because a syntax-broken artifact is guaranteed to fail at runtime and is
not useful to mount.

## Current compatibility matrix

| Pattern | Arrow docs/general expectation | `@arrow-js/sandbox` / Summon status | Notes |
| --- | --- | --- | --- |
| `html\`<p>${() => state.text}</p>\`` | Arrow reactive template pattern | Allowed | Preferred for reactive text. |
| Quoted event/attribute binding, e.g. `@click="${handler}"` or `disabled="${() => state.loading}"` | Arrow template pattern to verify per sandbox release | Allowed | Summon prompts models toward this shape. |
| Bare dynamic expression in an opening tag, e.g. `<button ${() => "disabled"}>` | Needs direct Arrow sandbox verification before broad support | Blocked by Summon as `unsupported-arrow-open-tag-expression` | Use named quoted attributes instead. |
| IDL/property binding, e.g. `.value=` or `.checked=` | Needs direct Arrow sandbox verification before broad support | Blocked by Summon as `unsupported-arrow-idl-binding` | Use normal attributes and event target snapshots. |
| Ambient `window`, `document`, storage, timers, direct DOM refs | Valid browser JS in normal contexts | Blocked by Summon policy | Generated UI runs in a hardened sandbox. |
| `fetch()` | Valid browser JS in normal contexts | Allowed only with a generated-network grant | Prefer host tools/resources for product data. |
| Host tool calls through `host-bridge:summon` | Summon integration, not Arrow core | Allowed only for granted tools | Host owns handlers, credentials, state, and authority. |

## Before adding new validators

1. Reproduce the generated source as a minimal `@arrow-js/sandbox` example when
   the source is syntactically valid.
2. If Arrow/sandbox supports the pattern but Summon blocks it for safety, name
   and document it as a Summon policy/subset rule.
3. If Arrow/sandbox rejects the pattern, keep an `unsupported-arrow-*`
   diagnostic with a concrete rewrite hint.
4. If TypeScript cannot parse the entry file, use `invalid-arrow-source-syntax`
   and do not mount the artifact.
