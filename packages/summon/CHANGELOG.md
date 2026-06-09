# @anarchitecture/summon

## 0.2.0

### Minor Changes

- [`9965b88`](https://github.com/block/summon/commit/9965b8852e06f2dc11b39acf6589dcc86363d076) Thanks [@nahiyankhan](https://github.com/nahiyankhan)! - Require host-owned `grantedIntents` when spawning a sandbox and fail closed when
  JavaScript callers omit it. Artifact-declared intents remain advisory and never
  become executable bridge authority.
