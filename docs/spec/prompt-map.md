# Prompt map

> **Status:** lightweight live map. Keep this file small and source-linked; do
> not copy full prompts here.

Summon prompt assembly keeps three authorities separate:

| Authority | Owns | Does not own |
| --- | --- | --- |
| Summon | Runtime contract, safety rules, output schema, tool bridge semantics | Design direction |
| Ghost fingerprint | Composition, visual language, checks, token/style material | Runtime authority |
| Host | Tools, data, allowed actions, policy/plan/contract view | Model self-granted permissions |

## Runtime prompt contract

| Runtime selection | Provider method | Tool / output mode | Schema | Prompt constants |
| --- | --- | --- | --- | --- |
| `surface-document` | `generateSurfaceDocumentBundle` | `emit_surface_document` | `summon.surface-document-bundle/v1` | `SUMMON_FIXED_SURFACE_DOCUMENT_INSTRUCTIONS`, `SUMMON_STRUCTURED_SURFACE_DOCUMENT_BUNDLE_INSTRUCTIONS` |

## Core source files

| Concern | Source |
| --- | --- |
| Fixed/runtime prompt text | `packages/engine/src/prompt.ts` |
| Prompt block assembly | `packages/engine/src/contracts.ts` |
| Surface Document bundle schema | `packages/engine/src/surface-document-bundle.ts` |
| Runtime provider methods | `packages/server/src/types.ts`, `apps/server/src/model-providers.ts` |
| Runtime strategy | `packages/server/src/runtime/surface-document.ts` |
| Ghost surface brief | `packages/server/src/ghost/adapter.ts` |

## Prompt blocks

`compileSystemContracts()` assembles model prompt blocks. Relevant block categories:

| Block | Owner | Purpose |
| --- | --- | --- |
| `fixed` | Summon | Runtime rules and safety boundary for Surface Document. |
| `fingerprint` / Ghost brief | Ghost | Design authority, composition grammar, checks, and token/style material. |
| `layout` | Host | Optional host-provided layout slots. |
| `scale` | Host | Optional scale constraints. |
| `surface-contract` | Host | Purpose, tools/resources, constraints, and compiled policy view. |
| `tools` | Host/Summon | Granted host tools and how Surface Document behavior may call them. |
| `output-contract` | Summon | Final structured output reminder and schema identity. |

## Repair prompts

Repair prompts live in `apps/server/src/model-providers.ts` and reuse Surface
Document schemas plus `hintsForContractIssue()` from `packages/engine/src/contracts.ts`.

| Runtime | Repair function | Notes |
| --- | --- | --- |
| `surface-document` | `repairSurfaceDocumentPrompt` | Repairs bundle shape, inert HTML/CSS violations, JS authority/API violations. |

## Maintenance rule

When changing the Surface Document contract, update these in the same change:

1. prompt constants in `prompt.ts`
2. bundle/artifact schema descriptions
3. validators and issue codes
4. repair hints
5. worked examples/tests
6. this map
