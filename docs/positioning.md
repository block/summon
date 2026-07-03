# Positioning

Summon is generative UI with a design authority.

A Ghost fingerprint carries the brand. Summon composes a generated surface from
that authority, runs optional behavior inside a capability-isolated sandbox, and
returns a contract with diagnostics, verdict, and receipt.

## Thesis

Generated UI is only useful when the host can answer three questions:

1. **What design authority shaped this?**
2. **What can it do?**
3. **What happened?**

Summon answers those through:

- Ghost fingerprint material for composition and visual language
- Surface Document as the generated artifact contract
- host-owned tools and policies for authority
- stream diagnostics, conformance verdicts, and receipts for accountability

## Surface Document is the governed path

Surface Document is the artifact shape that matches the Govern/Account claim:
structure, style, and behavior are separately inspectable and citable.

```txt
main.html  -> inert structure
main.css   -> fingerprint styling
main.js    -> optional governed behavior
```

Generated behavior runs in Summon's capability-isolated VM against a descriptor
DOM. It does not receive the page's `window`, storage, credentials, native APIs,
or direct DOM access. Product authority flows through host-granted `callTool()`
requests.

## Runtime posture

There is one governed generated-UI path in current docs and demos:

| Runtime | Meaning |
| --- | --- |
| `surface-document` | `main.html` + `main.css` + optional governed `main.js` in the Summon sandbox. |

Any future runtime that changes the trust boundary must reopen the positioning
explicitly. It should not arrive as a hidden flag or demo-only escape hatch.

## Standalone and composable

Summon is standalone: point it at a Ghost fingerprint and it composes, governs,
and accounts for a surface.

It is also composable: any larger system that produces fingerprints can use
Summon as the rendering terminus where declared product direction finally hits a
screen and the loop closes.

## Non-goals

- Model-authored permissions.
- Host widget escape hatches for generated UI.
- Runtime-choice UX in adopter docs.
- Generic AI aesthetics that ignore the fingerprint.
