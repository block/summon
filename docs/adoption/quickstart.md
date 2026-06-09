# Summon Adoption Quickstart

This is the golden path for proving Summon works locally. Start with the Surface
Gallery to see generated UI in a sandbox, backed only by host tools the app
allows. Use the maintainer workbench only when you want to inspect diagnostics.

## Prerequisites

- Node 18 or newer.
- pnpm 10 or newer.
- An Anthropic API key for `apps/server`.

## Run The Gallery

```sh
pnpm install
cp apps/server/.env.example apps/server/.env
# edit apps/server/.env and set ANTHROPIC_API_KEY
pnpm dev:gallery
```

Open `http://localhost:5174`.

The gallery is live-first. It requires `apps/server` and `ANTHROPIC_API_KEY`;
it does not silently fall back to replay. Use the preset cards to generate
read-only surfaces, host-backed search, host-owned actions, approval flows,
trusted host components, and background host work.

Each preset chooses a surface config and a short list of allowed host tools.
The server turns that into the stricter validation details Summon uses during
generation and replay.

## Run The Workbench

```sh
pnpm dev:all
```

Open `http://localhost:5173/generate.html`.

## Golden Scenario

In the workbench, use the **Host Data Search** scenario. The scenario is
shaped to exercise the adopter path:

- The host registers a `search` data tool with `defineDataResource`.
- The generated surface renders loading, error, and result states.
- The surface can only request the `search` host tool.
- The host owns state updates and pushes safe state back into the sandbox.
- Diagnostics are available if generation or interaction fails.

## What To Verify

1. Select **Host Data Search**.
2. Keep layout on **Free layout**.
3. Confirm the run is interactive and only the `search` host tool is allowed.
4. Run the scenario.
5. When the UI renders, use its generated search control with a query such as
   `chicken pasta`.
6. Confirm the generated UI displays loading and then search results.
7. Open **Saved surfaces** and replay the completed surface. It should render
   the same UI while keeping the sandbox boundary intact.

Then open `http://localhost:5173/adversarial.html` and confirm the sandbox
checks pass. This proves the quickstart did not require relaxing the sandbox
boundary.

## Optional Diagnostics

The Stream and Devtools drawers are for understanding a run after you have
rendered and interacted with a surface:

- Open the **Stream** drawer to inspect accepted protocol lines, the selected
  surface config, validation summaries, and validation retry feedback.
- Open the **Devtools** drawer to inspect sandbox startup, render events, host
  tool requests, host dispatch, pushed state, trusted component sync, and stream
  diagnostics.
- For a healthy interactive run, expect to see a render event, a host tool
  request when you submit the search, host dispatch, and pushed state.

## Optional Checks

Open `http://localhost:5173/batch.html` to run several prompts through the same
surface config and allowed host tool set. Use it when changing prompt contracts,
directions, host tool wiring, visual direction coverage, or throughput behavior.

Use the other `/generate.html` scenarios to exercise static summaries,
declarative forms, host AI calls, GitHub lookup, trusted host components,
background host work, approval-required publish, scripted interactive mode,
token overrides, layout constraints, sibling summon, Ghost steering when
configured, and validation retry diagnostics.

Open `http://localhost:5173/strict.html` to see the trusted host overlay pattern
for sensitive input. The generated sandbox describes the slot; the host owns the
real input and pushes only safe state back.

## Troubleshooting

- If generation fails immediately, check `apps/server/.env` for
  `ANTHROPIC_API_KEY` and confirm the server is listening on `:3001`.
- If generated controls do nothing, confirm the run is interactive. Static
  surfaces intentionally have no allowed host tools.
- If the model emits unsafe HTML, inspect the Stream drawer for validation
  summaries, blocked output, and validation retry feedback.
- If the sandbox does not update after a generated control is used, inspect
  Devtools for rejected host tool requests, host dispatch, handler completion,
  and pushed state.
- If sections are missing or retried, inspect stream diagnostics in the Stream
  and Devtools drawers.
