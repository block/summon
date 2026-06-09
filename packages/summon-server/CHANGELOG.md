# @anarchitecture/summon-server

## 0.2.0

### Minor Changes

- [#8](https://github.com/block/summon/pull/8) [`0bd2551`](https://github.com/block/summon/commit/0bd25519ce86ec81c924a6de6d0056b6d06f5766) Thanks [@nahiyankhan](https://github.com/nahiyankhan)! - Make SurfacePlan authority host-selected: server resolution now falls back to
  embedded/no-authority defaults unless an explicit host plan is accepted, and
  `suggestSurfacePlan()` exposes prompt heuristics as advisory UI scaffolding.

- [#5](https://github.com/block/summon/pull/5) [`4f8a939`](https://github.com/block/summon/commit/4f8a93950ec7cadd83368f322f709bf773d58c13) Thanks [@nahiyankhan](https://github.com/nahiyankhan)! - Narrow public package exports to explicit adoption-path APIs and move copied
  implementation output under `dist/_internal`.

### Patch Changes

- [#7](https://github.com/block/summon/pull/7) [`fd68e7f`](https://github.com/block/summon/commit/fd68e7f485a247642de887912cd8a4dfe295a134) Thanks [@nahiyankhan](https://github.com/nahiyankhan)! - Curate the root Summon export to the beta host-authoring API and move advanced
  browser, engine, and host runtime APIs behind explicit public subpaths. Packed
  server and React packages now import those public subpaths instead of relying on
  root export leakage.
- Updated dependencies [[`fd68e7f`](https://github.com/block/summon/commit/fd68e7f485a247642de887912cd8a4dfe295a134), [`0bd2551`](https://github.com/block/summon/commit/0bd25519ce86ec81c924a6de6d0056b6d06f5766), [`4f8a939`](https://github.com/block/summon/commit/4f8a93950ec7cadd83368f322f709bf773d58c13)]:
  - @anarchitecture/summon@0.3.0

## 0.1.1

### Patch Changes

- Updated dependencies [[`9965b88`](https://github.com/block/summon/commit/9965b8852e06f2dc11b39acf6589dcc86363d076)]:
  - @anarchitecture/summon@0.2.0
