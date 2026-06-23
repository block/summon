# Summon Diagnostic Playground

The playground path is the local-first diagnostic loop for Ghost-backed generative UI debugging. The main Generate workbench defaults to real showcase scenarios with the agent broker, host policy, granted tools, repair attempts, and enforced validation.

Diagnostic mode keeps the Arrow renderer, but turns hardening into diagnostics:

```txt
Ghost fingerprint -> prompt -> Arrow bundle -> render
```

When **Diagnostic mode** is enabled in the Generate workbench:

- the agent broker is skipped
- generic response-shape inference does not exist; Ghost composition and the selected scenario's tool ceiling shape the run
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

Generate opens in the showcase path by default. Pick a configured Ghost fingerprint, choose a sample prompt or enter your own, and generate. Use the advanced **Diagnostic mode** toggle only when you want observe-mode validation and best-effort artifact rendering.

## Ghost roots

To use Ghost steering, add one or more roots to `apps/server/.env`:

```sh
SUMMON_GHOST_ROOTS=checkout=/absolute/path/to/checkout
```

Then select the fingerprint in the Generate workbench. The workbench sends `{ fingerprint: { id, targetPath } }` to the server, streams Ghost context metadata, and renders the generated artifact.

## Showcase Mode

The default Generate path is the stricter adoption path: broker/policy selection, scenario tool ceilings, repair attempts, and enforced Arrow/runtime validation gates.

## Experimental HTML Stream

The `HTML preview stream` picker option is for bakeoff diagnostics only. It streams raw HTML text into an inert, scriptless preview iframe, then commits only complete fragments that pass the existing `/artifact/html-patch` validation path. Raw partial HTML is never applied to the authoritative surface iframe.
