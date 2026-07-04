# Debugging Summon generations

Summon diagnostics explain where a generated surface failed the contract: model output shape, artifact validation, runtime mounting, host tool dispatch, conformance, or receipt/accounting.

The preferred generated artifact is a **Surface Document** (`main.html`, `main.css`, optional `main.js`).

## Failure layers

| Layer | Common signal | What to inspect |
| --- | --- | --- |
| Bundle shape | `invalid-*-bundle`, missing required source file | Provider tool output and `/model-output-mode` |
| Artifact validation | `surface-document-*` issue code | `/validation-blocked`, validator hint, blocked source dump |
| Runtime mount | `surface-runtime-error` | Browser console + Devtools runtime events |
| Host authority | `tool-rejected`, unknown tool, invalid args | Surface contract, granted tools, handler registry |
| Design conformance | `/ghost-conformance` fail/inconclusive | Fingerprint checks, artifact source, rendered output |
| Receipt/accounting | missing or incomplete `/ghost-receipt` | Generation stream and receipt builder |

## Surface Document issue codes

Most Surface Document failures have direct repair directions:

- `missing-surface-document-bundle-html` — add `source["main.html"]`.
- `missing-surface-document-bundle-css` — add `source["main.css"]`.
- `surface-document-html-inline-handler` — move `onclick`/`oninput` behavior to `main.js`.
- `surface-document-html-forbidden-tag` — remove executable/embed tags from `main.html`.
- `surface-document-html-javascript-url` — remove `javascript:` URLs.
- `surface-document-css-import` / `surface-document-css-external-url` — keep CSS local.
- `surface-document-network-not-granted` — use granted host tools via `callTool()`.
- `surface-document-unsupported-api` — use scoped descriptor-DOM APIs only.
- `invalid-surface-document-source-syntax` — fix `main.js` syntax.

See [`../spec/surface-document.md`](../spec/surface-document.md) for the normative contract.

## Stream diagnostics to know

| Meta path | Meaning |
| --- | --- |
| `/model-output-mode` | Selected runtime/schema and repair attempt state. |
| `/validation-blocked` | The blocking contract issue. |
| `/validation-observed` | An issue observed in observe mode. |
| `/surface-document-bundle-diagnostic` | Shape diagnostic for model Surface Document output. |
| `/surface-document-blocked-source` | Rejected Surface Document source for inspection. |
| `/conjuror` | Ghost context compilation packet: strategy, selected/excluded nodes, warnings. |
| `/ghost-conformance` | Fingerprint conformance verdict. |
| `/ghost-receipt` | Receipt/accounting artifact. |
| `/run-metrics` | Summary counts for validation, repairs, safety violations, blocked state. |

## Blank or failed render checklist

1. Confirm an accepted `/artifact` line exists.
2. Confirm the artifact runtime is supported by the host render path.
3. Inspect Devtools events for `render`, `rendered`, and `surface-runtime-error`.
4. For Surface Document, check that `main.html` parsed, `main.css` injected, and optional `main.js` mounted.
5. If a host tool did not run, verify the selected `SurfacePolicy` granted the tool and the host registered a handler.
6. Run the safety harness before changing runtime or tool-dispatch behavior:

```sh
pnpm test:safety
```

## Protocol reference

The stream and meta-path registry are documented in [`../spec/protocol.md`](../spec/protocol.md).
