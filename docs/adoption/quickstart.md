# Summon Adoption Quickstart

This is the golden path for proving Summon works locally: generation, interactive
data resources, host state pushback, Devtools events, stream health, and sandbox
boundaries.

## Prerequisites

- Node 18 or newer.
- pnpm 10 or newer.
- An Anthropic API key for `apps/server`.

## Run The Demo

```sh
pnpm install
cp apps/server/.env.example apps/server/.env
# edit apps/server/.env and set ANTHROPIC_API_KEY
pnpm dev:all
```

Open `http://localhost:5173/generate.html`.

## Golden Scenario

Use the **Host-resource search** scenario. The scenario is intentionally shaped
to exercise the adoption path:

- `defineDataResource` via the demo `search` resource.
- Loading, error, and data states through resource bindings.
- A narrowed model-facing capability pack and matching sandbox grants.
- Host state pushback from `PolicyEngine`.
- A server-emitted `SurfacePlan`.
- Devtools `stream-graph` health events.

## What To Verify

1. Select **Host-resource search**.
2. Keep layout on **Free layout**.
3. Confirm the contract cockpit shows
   `explore/declarative/host-resource/read/replayable` and `Grants 1: search`.
4. Run the scenario.
5. When the UI renders, use its generated search control with a query such as
   `chicken pasta`.
6. Open the **Stream** drawer and confirm accepted `add` or `set` protocol
   lines plus `/surface-plan` are visible.
7. Open the **Devtools** drawer and confirm these event kinds appear:
   `protocol-line`, `intent-emitted`, `intent-dispatched`, `state-pushed`,
   `render`, `surface-plan`, and `stream-graph`.
8. Confirm the `stream-graph` events report declared and present sections
   without blocked sections.
9. Open **Saved surfaces** and replay the completed surface. It should render
   from the stored `SurfaceEnvelope` while keeping the sandbox boundary intact.

Then open `http://localhost:5173/adversarial.html` and confirm the sandbox
checks pass. This proves the quickstart did not require relaxing the sandbox
boundary.

## Optional Checks

Open `http://localhost:5173/batch.html` to run several prompts through the same
direction and capability ceiling. Use it when changing prompt contracts,
directions, intent wiring, visual direction coverage, or throughput behavior.

Use the other `/generate.html` scenarios to exercise static summaries,
declarative forms, host AI calls, GitHub lookup, component islands,
worker-backed analysis, approval-gated publish, scripted interactive mode,
token overrides, layout constraints, sibling summon, Ghost steering when
configured, and repair diagnostics.

Open `http://localhost:5173/strict.html` to see the trusted host overlay pattern
for sensitive input. The generated sandbox describes the slot; the host owns the
real input and pushes only safe state back.

## Troubleshooting

- If generation fails immediately, check `apps/server/.env` for
  `ANTHROPIC_API_KEY` and confirm the server is listening on `:3001`.
- If generated controls do nothing, confirm the page is in **Interactive** mode.
  Static mode intentionally has no granted intents.
- If the model emits unsafe HTML, inspect `/validation-summary`,
  `/repair-feedback`, and `/repair-summary` in the Stream drawer.
- If the sandbox does not update after an intent, inspect Devtools for
  `intent-rejected`, `intent-dispatched`, `intent-settled`, and `state-pushed`.
- If sections are missing or repaired, inspect `/stream-graph-summary` and the
  Devtools `stream-graph` events.
