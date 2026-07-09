# Surface policy capability ceilings

> **Status:** accepted design position, implementation staged. Records the
> tier/axis vocabulary decision from the 2026-07 policy review. Normative
> policy behavior lives in `packages/engine/src/surface-policy.ts`; this
> document explains the model and the migration.

## Problem

`SurfacePolicy` is authored in tier vocabulary (`static | declarative |
worker | approval` + `grants`), while the derived `SurfacePlan` carries
capability axes (`data`, `authority`). Two vocabularies encode one trust
decision. The review found:

- **Runtime enforcement never reads tier.** `packages/host` contains zero
  tier references. Enforcement is per-grant: the narrowed tool pack,
  `PolicyEngine.dispatch`, per-tool approval wrappers, and the envelope
  boundary check `surfacePlanCoversGrants` — a rank comparison on the axes.
  Tier is compile-time vocabulary restriction plus a prompt/display label.
- **The tiers are not a ladder.** `validateToolForTier` makes `worker` and
  `approval` exclusive homogeneity branches: worker accepts only
  worker-backed grants, approval only approval-gated ones. A surface that
  computes in a worker *and* commits via an approval-gated action — the most
  natural operate flow — is inexpressible. In the agent path
  (`policyFromGoal` → `narrowSurfacePolicy`), a prompt matching both
  approval and worker patterns picks approval tier and silently rejects
  every worker grant.
- **The homogeneity invariant is already leaky.** `planForPolicy` hardcodes
  `data` for worker tier but joins `authority` from tools (and vice versa
  for approval), so a worker-tier surface can already carry
  `authority: 'approval-gated'` in its plan. The invariant protects no one;
  it produces false confidence.
- **The redundancy collects rent.** A reverse-mapper
  (`surfacePolicyForPlan`) and a plan/policy sync test exist in the demo
  solely to keep the two vocabularies aligned. The tool→capability
  defaulting logic (`toolData`/`toolAuthority`) is duplicated in four files.
  `agent-ward.ts` declares a third vocabulary (`SurfaceGoalDataNeed`
  re-declares `SurfaceData` verbatim).

The blast-radius steelman for homogeneous tiers — "an auditor reading
`tier: 'approval'` knows every control is gated" — fails on mechanism: the
approval gate lives in host-owned chrome per tool, not in surface
homogeneity, and a declarative neighbor cannot weaken it. Routing
compute-then-commit through sibling surfaces instead is rejected on
security grounds: it launders the worker result through a second model
generation before the approval gate, destroying the result-binding property
that `ToolContext.approval` (frozen `prepare()` plans over host-held state)
provides natively on a single surface.

## Decision

**Capability axes are primary. Tier becomes a derived display label and a
set of named ceiling presets.**

A policy's authority is its grant list plus an explicit **ceiling** in the
capability lattice:

```ts
interface SurfaceCeiling {
  data?: SurfaceData;          // default 'embedded'
  authority?: SurfaceAuthority; // default 'none'
}
```

Compilation validates `join(capabilities(grants)) ≤ ceiling` using the
existing rank lattices (`DATA_RANK`, `AUTHORITY_RANK` — the same tables
`surfacePlanCoversGrants` enforces at the envelope boundary). The compiled
plan's axes become the truthful join of the granted tools, clamped by
nothing — the ceiling gates *grant selection*, the plan *reports reality*.
Understatement is impossible by construction; the compile-time worldview
and the deserialization boundary check finally agree.

Mixed surfaces (worker compute + approval commit) become legal with zero
new machinery: the lattice join already handles them; only the tier gate
forbade them.

### Presets, not primitives, as the authoring surface

Hosts should not hand-write lattice points. The blessed authoring path is
named presets that map onto the old tier names:

```ts
ceilings.static       // { data: 'embedded',      authority: 'none' }
ceilings.declarative  // { data: 'host-resource', authority: 'host-action' }
ceilings.worker       // { data: 'worker',        authority: 'host-action' }
ceilings.approval     // { data: 'worker',        authority: 'approval-gated' }
```

**Stated decision:** `ceilings.approval` includes `data: 'worker'`. This
gives the tiers a total order (`static < declarative < worker < approval`)
and makes compute-then-commit expressible under a single preset. `data` is
compute locality inside the sandbox — a far smaller hazard than
`authority`, and grants remain host-curated per surface. Hosts wanting
approval authority without worker compute write an explicit ceiling.

`displayTier(ceiling | plan)` derives the label for chrome and prompts: the
least preset covering the axes. Chrome is encouraged to render the axes
directly ("runs computation locally · requires your approval to act");
mixed surfaces need two-clause labels regardless.

A ceiling is permission, not obligation: a surface whose grants all sit
below its ceiling is legal, and a ceiling with zero surviving grants
compiles to `mode: 'static'` even when its display label reads
`declarative`. The label describes headroom; the mode describes reality.

### What is deliberately kept

- **Floor requirements.** A ceiling that names a capability no grant
  reaches (e.g. worker ceiling, no worker-backed grant) remains a blocking
  compile issue. Without floors the label is noise.
- **Grant narrowing** (`narrowToolPack`), per-tool approval wrappers, and
  `surfacePlanCoversGrants` are unchanged. They were always the real
  enforcement.
- **Fail-closed defaults.** Omitted ceiling = `ceilings.static`. Unknown
  grants keep failing closed to action defaults.

## Migration

Executed as a single cut (pre-1.0, all consumers in-repo; ratified
2026-07-09):

- `SurfacePolicy.tier` is removed from input; policies author
  `ceiling` (usually via the `ceilings` presets).
- Shared `capabilityForTool()` / `capabilityCovers()` helpers replace the
  four duplicated `toolData`/`toolAuthority` copies.
- `planForPolicy` drops per-tier hardcoding and becomes a uniform join.
- `policyFromGoal` emits ceilings from goal capabilities, removing the
  approval-vs-worker ordering bug. `SurfaceGoalDataNeed` merges into
  `SurfaceData`.
- `CompiledSurfacePolicy` exposes `displayTier`. The `Tier:` line leaves
  the surface-contract prompt block (the plan line beneath it carries
  strictly more information).

## Non-goals

- No change to the Surface VM patch protocol, host-owned meta paths, or
  the envelope schema. `/surface-plan` remains the emitted projection.
- No new authority levels or data locations. The lattice values are
  unchanged; only how policies address them changes.
- `purpose` relocation (into a hints substructure) is acknowledged debt,
  tracked separately — not part of this migration.
