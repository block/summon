# Summon Adoption Quickstart

This is the golden path for proving Summon works locally. Start with the Surface
Gallery to see generated UI in a sandbox, backed only by host tools the app
allows. Use the maintainer workbench only when you want to inspect diagnostics.

## Prerequisites

- Node 18 or newer.
- pnpm 10 or newer.
- An Anthropic, OpenAI, or Gemini API key for `apps/server`.

## Run The Gallery

```sh
pnpm install
cp apps/server/.env.example apps/server/.env
# edit apps/server/.env and set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY
pnpm dev:gallery
```

Open `http://localhost:5174`.

The gallery is live-first. It requires `apps/server` and one configured model
provider key; it does not silently fall back to replay. Set
`SUMMON_MODEL_PROVIDER` to choose the default provider when more than one key is
configured. Use the preset cards to generate read-only surfaces,
host-backed search, host-owned actions, approval flows, trusted host
components, and background host work.

Each preset chooses a surface config and a short list of allowed host tools.
The server turns that into the stricter validation details Summon uses during
generation and replay.

## Run The Workbench

```sh
pnpm dev:all
```

Open `http://localhost:5173/generate.html`.

The Generate workbench uses the same surface configs as the gallery where they
overlap, but keeps maintainer controls visible: stream diagnostics, Devtools,
validation retry, edit/replay, custom SurfacePlan overrides, directions, and
Ghost steering internals.

## Run A Ghost Sandbox

The Surface Gallery and Generate workbench both add Ghost-backed sandbox presets
when trusted roots are configured. The bundled **Ghost** direction is a visual
direction snapshot; root-backed product memory is enabled separately so the
host still owns which repositories the model can read from.

Add one or more trusted Ghost roots to `apps/server/.env`:

```sh
SUMMON_GHOST_ROOTS=checkout=/absolute/path/to/checkout
```

Canonical Ghost packages use this layout:

```txt
/absolute/path/to/checkout
└── .ghost
    ├── config.yml
    └── fingerprint
        ├── manifest.yml
        ├── prose.yml
        ├── inventory.yml
        └── composition.yml
```

Legacy roots with `.ghost/fingerprint.yml` are still accepted through the
compatibility bridge, but new examples and product fingerprints should use
`.ghost/fingerprint/manifest.yml`.

Then start the gallery or the workbench:

```sh
pnpm dev:gallery
# or
pnpm dev:all
```

Open `http://localhost:5174` for the adopter-facing gallery preset, or
`http://localhost:5173/generate.html` for the diagnostic Ghost scenario and
`Ghost · <id>` direction. Keep **Ghost base** on the bundled **Ghost** direction
unless you are intentionally testing another token base. **Ghost target** is a
relative path inside the configured repo root; use `.` for the root package or a
nested surface path.

When the run starts, the Stream drawer should show `/ghost-context`,
`/ghost-token-source`, and `/ghost-review-packet` metadata. Those lines confirm
the server resolved the fingerprint stack, chose token CSS, generated a Summon
surface, and emitted the review packet needed to inspect the output against the
same Ghost memory.

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

- If generation fails immediately, check `apps/server/.env` for the selected
  provider key and confirm the server is listening on `:3001`.
- If generated controls do nothing, confirm the run is interactive. Static
  surfaces intentionally have no allowed host tools.
- If the model emits unsafe HTML, inspect the Stream drawer for validation
  summaries, blocked output, and validation retry feedback.
- If the sandbox does not update after a generated control is used, inspect
  Devtools for rejected host tool requests, host dispatch, handler completion,
  and pushed state.
- If sections are missing or retried, inspect stream diagnostics in the Stream
  and Devtools drawers.
