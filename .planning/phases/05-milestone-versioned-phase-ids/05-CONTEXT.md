# Phase 5: Milestone-versioned phase IDs - Context

**Gathered:** 2026-05-10 (initial); resumed 2026-05-12 (open items resolved)
**Status:** Discussion complete. Ready for planning.

<domain>
## Phase Boundary

Implement milestone partitioning so each milestone is a self-contained tree where phases reset to 1, 2, 3… (with optional decimal insertions remaining local to that milestone). Closing a milestone produces a distilled artifact (summary + critical decisions) that the next milestone reads instead of the full prior phase tree. Backward compat is non-negotiable: GSD updating in a project on the old layout must DTRT — auto-retrofit on apply.

This phase ships the *machinery*. It does NOT close milestone v1.4. Whether/when v1.4 actually transitions to v1.5 is a separate decision after this phase lands.

**Detected domain:** Generic
**Evidence:** Tooling/CLI refactor — touches `.claude/get-shit-done/bin/lib/*.cjs` (init, phase, roadmap, normalizePhaseName) and workflow markdown. No UI files (no `src/components/`, no `*.tsx`). No agentic keywords in title or scope.
**Confirmed by user:** yes

</domain>

<established>
## Established Patterns (from codebase)

- **`padded_phase` produced by `normalizePhaseName`** in `.claude/get-shit-done/bin/lib/init.cjs` (lines 195, 529) — every workflow uses the `{padded_phase}` placeholder. Renaming the produced shape requires updating call sites, not workflow templates one-by-one.
- **Phase resolution flows through `lib/phase.cjs`** — `findPhaseDirectory`, `phase_number` resolution. Single chokepoint for any ID-format change.
- **Slash commands consume `init` outputs as JSON.** Workflows parse `phase_dir`, `padded_phase`, `phase_number`, `phase_slug` from `gsd-tools init phase-op` output. That JSON is the public API; adding fields is non-breaking, renaming is a wide blast radius.
- **Decimal phases (`1.1`, `2.1`) already supported** in `lib/phase.cjs:454`. Milestone-versioning must preserve this semantic.
- **Commit-message prefixes are conventional, not enforced.** Existing styles: `docs(04-04): …`, `feat(04-04): …`, `feat(260507-u0a): …`. Quick-task IDs already diverge from phase IDs, so prefix shape has flex.
- **`complete-milestone` and `new-milestone` slash commands exist** — natural extension points for distillation and reset-on-transition logic.
- **STATE.md frontmatter already carries `milestone: v1.4`** — partition root path can derive from existing field; no new config required.
- **Source vs runtime mirror split.** `.claude/` is gitignored runtime copy; edits go to `get-shit-done/` and `commands/gsd2/` source trees. `install.js` propagates. (Cross-machine: after pull on second workstation, may need to run install/update to refresh runtime mirror.)

</established>

<decisions>
## Implementation Decisions

### Scope
- Phase bundles **partition + distillation** as one unit. [STRONG — user confirmed; splitting creates a half-built state where IDs reset but next milestone still inherits the full prior tree, which doesn't solve the load-everything problem]

### Boundary — what this phase does NOT do
- Does **not** close milestone v1.4 or trigger transition to v1.5. [STRONG — user explicit: "I would not think on finishing milestone 1.4 at the moment at all, lets concentrate on phase"]
- Closing a milestone is a separate user decision after this capability lands.

### Migration / backward compatibility
- **Auto-retrofit on apply.** When this phase's code lands and GSD next runs in a project with old-layout planning artifacts, it detects "no milestone partition + phases at `.planning/phases/`" and migrates them under `.planning/{current_milestone}/phases/...`. [STRONG — user agreed with auto; rationale: only way to actually exercise the migration code before v1.5 happens; retrofit doubles as the integration test]
- Backward compat is a **hard, non-negotiable requirement**: GSD updating in a project on old layout must DTRT, not break. [STRONG — user explicit]
- The retrofit also rewrites references in committed `.planning/STATE.md`, `.planning/PROJECT.md`, `.planning/cross-phase-notes.md`, `.planning/ROADMAP.md` to use the new IDs/paths. [STRONG implication of "flawless" + auto — UX detail of *how* it confirms is in Open Items]

### Success criteria — structural, not numeric
- Token-cost reduction is the motivation but is **not** the success metric — token counts are project-dependent and unmeasurable in the abstract. [STRONG — user override on initial framing]
- Success metric is **what gets loaded**: default context for `/gsd2:progress` and similar commands = active milestone's phases (current ± a small window) + high-level docs (PROJECT.md, ARCHITECTURE) + distilled prior milestones. Does NOT load all phases regardless of count. [STRONG]
- Planner picks the concrete window (e.g., current phase ± 1, or anchor + 2). The *type* of metric is locked, the exact bound is [DISCRETION].

### Distillation artifact must be graph-friendly
- The distilled milestone summary (and ongoing decision logs) carries **typed tags + explicit links** between phases, decisions, requirements, canonical refs — machine-parseable headers, not free-form prose. [STRONG]
- Why: Phase 6 (Graph) consumes this structure. We don't want to retrofit tags later. Phase 5 produces the substrate; Phase 6 indexes it.

### Phase 6 / Phase 7 are deferred siblings, not in this phase
- **Phase 6: Graph-based linking** — typed/weighted edges across decisions, phases, requirements; replaces "load everything" with "follow the graph". The structural fix for the load-bloat problem. [STRONG — deferred]
- **Phase 7: RAG / semantic retrieval** — semantic search over planning artifacts when graph still over-loads. The long-tail fix. [STRONG — deferred]
- Partitioning (this phase) is acknowledged as a workaround that ships immediate value; graph is the structural fix; RAG is the long-tail fix.
- Cross-phase notes file captures both as Phase 6 / Phase 7 seeds.

### Resolved 2026-05-12 (was Open Items 1–5)
- **[Phase 05] ID shape:** Path-only. Filenames keep short IDs (`01`, `04-04`); milestone disambiguation lives entirely in the path (`.planning/v1.4/phases/...`). Commit prefix unchanged: `feat(04-04: ...)`. [STRONG]
- **[Phase 05] Distillation artifact `MILESTONE-{version}-SUMMARY.md`:** Rich. Sections: `decisions[]` (typed, with `phase:` link), `requirements_validated[]`, `open_blockers[]` (carried into next milestone), `entry_points[]` (file:symbol), `public_api[]`. Machine-parseable typed tags (graph-friendly substrate for Phase 6). [STRONG]
- **[Phase 05] Migration trigger UX:** One-time confirmation prompt. Print plan (`N dirs to move, M ref-rewrites in K files`) and require `[y/N]` before mutating committed files. `--dry-run` mode prints the plan without prompting and exits. [STRONG]
- **[Phase 05] Reference rewrite scope:** Root files (`STATE.md`, `PROJECT.md`, `ROADMAP.md`, `cross-phase-notes.md`) always rewritten. Sweep `todos/**/*.md` and `quick/**/*.md` for **path-shaped** refs only (regex match on `.planning/phases/...` and bare `phases/NN-`). Free prose untouched. Commit message history untouched. [STRONG]
- **[Phase 05] Active milestone source of truth:** STATE.md `milestone:` frontmatter (current value: `v1.4`). If missing/corrupt: refuse to migrate, exit with clear error prompting user to set it. No path-based guessing, no default. [STRONG]
- **[Phase 05] Layout:** Only phase tree moves under `.planning/{milestone}/phases/`. PROJECT/ROADMAP/STATE/cross-phase-notes/todos/quick stay at `.planning/` root. ROADMAP resets when milestone transitions; closed milestones are summarized in `.planning/{milestone}/SUMMARY.md`. [STRONG]

</decisions>

<expected_outcome>
## Expected Outcome

- **End state:** GSD has the *capability* to partition phases by milestone, distill closing milestones, and auto-retrofit old-layout projects. The capability is implemented, tested, committed. The current v1.4 milestone is itself retrofitted into the new layout as the integration test of the migration path.
- **Success signal:** Running `/gsd2:progress` (and the planner-side load) inside the (now-partitioned) v1.4 milestone surfaces only active milestone phases + high-level docs — not all 5+ phases regardless of relevance. Old-layout commits remain readable; new-layout files coexist. Cross-machine workflow continues to work after a `git pull` on the second workstation.
- **Flow (high level):** Phase 5 lands → GSD detects old layout → auto-migrates `.planning/phases/*` under `.planning/v1.4/phases/*` (and updates references) → all subsequent commands operate on the partitioned tree → user continues working on whatever phase they were on, just at a new path → at some later point, user runs `/gsd2:complete-milestone` and gets a distill artifact for v1.5 to read (this last step is verified-but-not-fired in this phase).

</expected_outcome>

<open_items>
## Open Items — RESOLVED 2026-05-12

All 5 items resolved with the user before planning. Decisions appended to `<decisions>` below.

1. **ID literal shape:** Path-only. `.planning/v1.4/phases/01-foo/01-PLAN.md`. ID inside files stays `01`. Commit prefix stays `feat(04-04: ...)`. [STRONG — user selected]

2. **Distillation contents:** Rich. `MILESTONE-{version}-SUMMARY.md` carries `decisions[]` (typed, linked to phase IDs), `requirements_validated[]`, `open_blockers[]`, `entry_points[]` (file:symbol), `public_api[]`. Format: machine-parseable, typed tags (graph-friendly for Phase 6). [STRONG — user selected]

3. **Migration UX:** One-time confirmation prompt before rewriting committed planning files. Print plan ("will move N dirs, rewrite refs in M files"), prompt `[y/N]`. Implicit `--dry-run` mode preview-only. [STRONG — user selected]

4. **Reference rewrite scope:** Root files (`STATE.md`, `PROJECT.md`, `ROADMAP.md`, `cross-phase-notes.md`) ALWAYS rewritten. PLUS sweep `todos/**/*.md` and `quick/**/*.md` for **path-shaped** refs only (regex matching `.planning/phases/...` and `phases/NN-...`). Free prose mentioning phase numbers left untouched. Commit history not touched. [STRONG — user confirmed after layout clarification]

5. **Active milestone source:** STATE.md `milestone:` frontmatter field is source of truth. If missing or corrupt: refuse to migrate, prompt user to set it explicitly. Do not guess from path or default. [STRONG — Claude pre-answered, user accepted]

### Layout confirmed (post-retrofit)

```
.planning/
  PROJECT.md            ← root, project-wide
  ROADMAP.md            ← root, active milestone's phases (resets on milestone transition)
  STATE.md              ← root
  cross-phase-notes.md  ← root, project-wide
  todos/                ← root
  quick/                ← root
  v1.4/
    SUMMARY.md          ← distilled artifact (written by /gsd2:complete-milestone)
    phases/
      01-domain-router/
      02-agent-spec/
      03-documentation-agent/
      04-verification-harness-and-context-efficiency/
      05-milestone-versioned-phase-ids/
  v1.5/
    phases/
      01-.../
```

Only the phase tree drops one level under the milestone partition. Everything else at `.planning/` root stays put.

</open_items>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — milestone vocabulary, current milestone (v1.4), Key Decisions log structure
- `.planning/REQUIREMENTS.md` — requirement ID schema, traceability table format
- `.planning/ROADMAP.md` — phase listing, plan numbering convention, decimal-phase rules
- `.planning/STATE.md` — `milestone:` frontmatter field (current source of truth for milestone identity), Decisions log schema, progress counters
- `.planning/cross-phase-notes.md` — current cross-phase note format (one of the migrated files)

### Code — phase ID generation and resolution
- `.claude/get-shit-done/bin/lib/init.cjs` — `normalizePhaseName()`, `padded_phase` generation, output JSON contract consumed by every workflow
- `.claude/get-shit-done/bin/lib/phase.cjs` — `findPhaseDirectory`, decimal-phase resolution, phase enumeration
- `.claude/get-shit-done/bin/lib/roadmap.cjs` — roadmap parsing, phase-from-roadmap lookup
- `.claude/get-shit-done/bin/lib/core.cjs` — shared phase-number normalization helpers

### Workflows that consume `padded_phase` / `phase_dir` / `phase_number`
- All `.claude/get-shit-done/workflows/*.md` and `commands/gsd2/*.md` — every `{padded_phase}` and `{phase_dir}` placeholder is a touch point. Planner enumerates exhaustively.

### Existing milestone-boundary logic (extension points)
- `commands/gsd2/complete-milestone.md` — milestone closure workflow (extension point for distillation)
- `commands/gsd2/new-milestone.md` — milestone start workflow (extension point for reset-numbering)
- `commands/gsd2/cleanup.md` — archive logic (overlaps with retrofit; needs reconciliation)
- `commands/gsd2/audit-milestone.md` — milestone audit (will read distill in future)

### Discussion-focus reference
- `commands/gsd2/progress.md` — current `/gsd2:progress` workflow that loads "too much" — primary measurable consumer of the new partitioned layout

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `normalizePhaseName(phase_number)` in `init.cjs` — single function that produces zero-padded IDs. Hook for new format.
- `init phase-op` JSON output — single API surface that workflows consume. If `phase_dir` becomes milestone-aware, downstream workflows automatically adapt.
- `gsd-tools state record-session` and `commit` subcommands — already used by every workflow; useful for migration progress markers.
- Existing decimal-phase resolver in `phase.cjs:454` — preserves user's `2.1` insertion semantic; do not rewrite.
- STATE.md `milestone:` frontmatter field — existing single source of truth for current milestone identity.

### Established Patterns
- **JSON-output contract from `gsd-tools` is the workflow API.** Adding new fields (`milestone`, `milestone_path`, `partition_root`) is non-breaking; renaming existing fields breaks every workflow.
- **Source vs runtime mirror split** — `.claude/` is gitignored runtime copy; `get-shit-done/` and `commands/gsd2/` are committed source. Edits go in source; `install.js` propagates. (See feedback memory: dual-tree edits.)
- **Quick-tasks already use a parallel ID scheme** (`260507-u0a`) — precedent that not every artifact needs to follow phase ID conventions.

### Integration Points
- Every workflow that resolves a phase via init: `discuss-phase`, `plan-phase`, `execute-phase`, `verify-phase`, `progress`, `next`, `audit-uat`, `complete-milestone`, `new-milestone`, `archive`, `document`, `cleanup`. Planner enumerates and updates either via init.cjs output (preferred) or per-workflow placeholder updates.
- Commit-message prefix convention (`feat(04-04): …`) — implicit; not enforced. Decision needed on whether to bake milestone into prefix.
- `git mv` is preferable to `rm + write` during retrofit so blame/history survives the path change.

</code_context>

<specifics>
## Specific Ideas

- User framing of the underlying problem: "if we have 20 phases, loading all the small context into the context window gives us 60k. But if we have just plus minus 1 or 2 or something like this, it's significantly better."
- User on the milestone model: milestones become *partitions*, not labels. Each milestone is a self-contained tree where phases reset to 1, 2, 3…
- User on the long-term direction: partition is a workaround; graph is the real fix; RAG is the long-tail fix. Phase 5 must produce graph-friendly substrate so Phase 6 doesn't retrofit it.
- User explicitly OK with auto-migration on apply (no per-step confirmation gating).

</specifics>

<deferred>
## Deferred Ideas

- **Milestone v1.4 closure / transition to v1.5** — out of scope here; user said "lets concentrate on phase". Run `/gsd2:complete-milestone` only after this phase ships and the user explicitly chooses to.
- **Phase 6: Graph-based linking** — typed/weighted edges across decisions, phases, requirements. Indexes the structured artifacts Phase 5 produces. Cross-phase note added.
- **Phase 7: RAG / semantic retrieval** — semantic search over planning artifacts when graph still over-loads. Cross-phase note added.

</deferred>

---

*Phase: 05-milestone-versioned-phase-ids*
*Context gathered: 2026-05-10 (paused — see Open Items)*
