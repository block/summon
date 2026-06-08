---
"@anarchitecture/summon": minor
---

Require host-owned `grantedIntents` when spawning a sandbox and fail closed when
JavaScript callers omit it. Artifact-declared intents remain advisory and never
become executable bridge authority.
