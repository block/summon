# Public packaging

Summon publishes a narrow public package surface and keeps implementation packages private.

## Packages

| Package | Purpose |
| --- | --- |
| `@anarchitecture/summon` | Core host/engine/policy/envelope/Devtools public API. |
| `@anarchitecture/summon-server` | Provider-neutral generation lifecycle and model-provider contracts. |
| `@anarchitecture/summon-react` | React rendering adapter for inline Summon surfaces and replay envelopes. |

Private workspaces such as `packages/engine`, `packages/host`, `packages/server`, and `packages/surface-vm` are implementation details published through the public facades.

## Runtime contract

The public docs should describe Surface Document as the preferred generated artifact contract. Lower-level runtime helpers remain coordinated implementation pieces, not separate public products.

## Release checks

Before release:

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm check:public-packages
pnpm check:public-api
pnpm smoke:public-packages
```

Public API snapshots should fail CI when exports drift unintentionally.
