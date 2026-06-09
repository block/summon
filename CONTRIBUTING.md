# Contributing To Summon

Thanks for helping make Summon sturdier. Summon is pre-1.0, so public APIs can
still move, but changes should preserve the core boundary: generated artifacts
describe UI; the host owns grants, handlers, state, network, credentials, and
persistence.

## Local Setup

```sh
pnpm install --frozen-lockfile
cp apps/server/.env.example apps/server/.env
# optional for generation demos: set ANTHROPIC_API_KEY in apps/server/.env
pnpm dev:all
```

The browser demo runs at `http://localhost:5173/generate.html`.

## Required Checks

Run the focused checks for your change, then run the full release gate before a
public package or sandbox-boundary change:

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm check:public-packages
pnpm check:public-api
pnpm pack:dry-run
pnpm smoke:public-packages
pnpm test:safety
```

`pnpm test:safety` runs Chromium and WebKit smoke tests for sandbox containment,
strict input, component islands, startup fatal checks, and generate-page boot.
Run it before changing iframe attributes, CSP, postMessage routing, bootstrap
startup checks, script policy, grants, or component overlay behavior.

## Package Boundary

Applications should import public packages only:

- `@anarchitecture/summon` for host-authoring helpers and surface-plan types.
- `@anarchitecture/summon/browser` for iframe/runtime browser helpers.
- `@anarchitecture/summon/engine` for protocol, validation, prompt contracts,
  stream graph, and other advanced engine APIs.
- `@anarchitecture/summon/host` for adapter authors needing the full host
  runtime surface.
- `@anarchitecture/summon-server` for provider-neutral generation lifecycle.
- `@anarchitecture/summon-react` for React rendering and component islands.

Do not import `src/*.ts` paths or `@summon-internal/*` packages from apps,
examples, docs, or public package builds. If a public export changes, update
`scripts/check-public-api.mjs`, package-consumption docs, and the packed-package
smoke test in the same change.

## Changesets

Public package changes need a changeset:

```sh
pnpm changeset
```

Private `@summon-internal/*` implementation packages and demo apps are ignored
by Changesets; describe public impact on `@anarchitecture/*` packages.
