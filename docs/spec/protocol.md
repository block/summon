# Summon protocol

> **Status:** working protocol reference. This document describes the validated
> JSONL stream between the server and host, plus the Surface VM patch protocol.

## Trust boundary

Model output is untrusted input. A line means nothing until the host/server has
parsed and validated it. Generated artifacts cannot emit host-owned policy or
contract metadata.

The protocol has two layers:

1. **Generation stream protocol** — JSON lines emitted by the server and consumed by the host.
2. **Surface VM patch protocol** — host/VM messages and render patches used by the descriptor runtime.

## Generation stream line shapes

### Meta

```json
{ "op": "meta", "path": "/model-output-mode", "value": {} }
```

Meta lines carry diagnostics, policy summaries, conformance verdicts, receipts,
and timing. Meta paths are namespaced by convention and validated before
delivery.

### Event

```json
{ "op": "event", "path": "/surface", "value": { "type": "surface.status", "status": "drafting", "text": "..." } }
```

Events drive preview/status surfaces while generation is in progress.

### Artifact

```json
{ "op": "artifact", "path": "/artifact", "value": { "runtime": "surface-document", "source": {} } }
```

Artifact lines carry accepted complete Surface Document artifacts.

## Artifact runtime

| Runtime | Meaning |
| --- | --- |
| `surface-document` | `main.html` + `main.css` + optional governed `main.js`. |

## Host-owned paths

Generated artifacts must not emit these host-owned meta paths:

```txt
/surface-policy
/surface-plan
/surface-contract
```

The host/server owns policy selection, plan compilation, contract view, and
enforcement.

## Meta path registry

| Path | Owner | Meaning |
| --- | --- | --- |
| `/model-output-mode` | server | Runtime/schema selected for this generation or repair pass. |
| `/run-metrics` | server | Summary metrics: blocked, validation count, repairs, safety violations. |
| `/agent-goal` | server | Advisory goal inferred before host policy narrowing. |
| `/surface-policy` | server | Host-owned selected policy. Generated artifacts cannot emit this. |
| `/surface-plan` | server | Host-owned compiled plan. Generated artifacts cannot emit this. |
| `/surface-contract` | server | Host-owned compact contract view. Generated artifacts cannot emit this. |
| `/validation-blocked` | server | Contract issue that blocked generation. |
| `/validation-observed` | server | Contract issue observed in observe mode. |
| `/validation-summary` | server | Aggregate validation health. |
| `/ghost-conformance` | server | Fingerprint conformance verdict. |
| `/ghost-receipt` | server | Fingerprint receipt/accounting artifact. |
| `/fidelity-review` | server | Optional design-fidelity repair diagnostic. |
| `/surface-document-bundle-diagnostic` | server | Shape diagnostic for Surface Document bundle output. |
| `/surface-document-blocked-source` | server | Rejected Surface Document source dump for audit/debugging. |

Add new diagnostics as meta paths before adding new protocol operations.

## Surface VM patch protocol

The Surface VM emits an initial render tree and then patch operations. The
operation set is intentionally small and stable:

| Patch op | Meaning |
| --- | --- |
| `set-text` | Replace a text node's contents. |
| `set-attr` | Set or remove an element attribute/property representation. |
| `set-style` | Set or remove a style property. |
| `replace-region` | Replace the children of a region or element-scoped implicit region. |
| `listen` | Register an event handler. |
| `release` | Release VM-side handler/resource references. |

Surface Document landed without adding new patch ops. Prefer artifact/runtime
changes over protocol expansion.

## Stability policy

- Keep the operation set small.
- Prefer typed artifacts and meta diagnostics over new ops.
- Validate strictly at boundaries.
- Rejection reasons should be machine-readable `ContractIssue` codes.
- Any incompatible artifact semantics require a new schema/runtime version.
