# Summon Playground

The playground is the local-first Summon loop for Ghost-backed generative UI exploration.

It keeps the Arrow renderer, but turns hardening into diagnostics:

```txt
Ghost fingerprint / direction -> prompt -> Arrow bundle -> render
```

When **Playground mode** is enabled in the Generate workbench:

- the agent broker is skipped
- generic response-shape inference does not exist; Ghost composition and host policy shape the run
- repair attempts are skipped
- validation runs in observe mode
- preflight validation blockers are emitted as diagnostics instead of blocking generation
- renderable Arrow artifacts are accepted even when contract validation reports blockers

The runtime can still fail if the model does not return a structurally usable Arrow bundle or if the Arrow renderer itself cannot run the generated source.

## Run

```sh
pnpm install
cp apps/server/.env.example apps/server/.env
# edit apps/server/.env and set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY
pnpm dev:playground
```

Open `http://localhost:5173/generate`.

Playground mode is on by default in the workbench. Pick a direction or configured Ghost fingerprint, enter a prompt, and generate.

## Ghost roots

To use Ghost steering, add one or more roots to `apps/server/.env`:

```sh
SUMMON_GHOST_ROOTS=checkout=/absolute/path/to/checkout
```

Then select `Fingerprint · <id>` in the Direction control. The workbench sends the Ghost target and prompt to the server, streams Ghost context metadata, and renders the generated Arrow artifact best-effort.

## Hardened mode

Turn **Playground mode** off in the UI to restore the stricter adoption path: broker/policy selection, repair attempts, and enforced Arrow/runtime validation gates.
