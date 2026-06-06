# Phase 7: Parallel Multi-Session Safety & Planning Ergonomics - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Phase Boundary

GSD makes it safe and ergonomic to run several sessions at once — start a quick-fix while a phase executes, or work two independent phases in parallel — and finish faster than serial, without the silent-overwrite mess today's shared working tree produces. Folds in the doctor source↔runtime symmetry-check and tidies the backlog ID model these workflows depend on.

**In scope (all 5 items land together):**
1. Worktree-isolated execution + merge in `execute-phase` (axis A) and the quick path.
2. Parallel-safety gate: `depends_on` (axis B) + file-scope disjointness via the Phase 4 file-dep graph (axis A) → greenlight/refuse a proposed parallel set; forbid parallel discussion of dependent phases.
3. `depends_on` / `related_to` on **todo** frontmatter so the gate covers quick tasks, not just phases.
4. Doctor source↔runtime symmetry-check (absorbed from ex-999.1) + post-merge drift verification.
5. Backlog ID scheme rethink (999.x → non-phase IDs).

**Out of scope:** the future *semantic stale-decision healer* doctor (Phase 3 cross-phase note — distinct from this phase's structural symmetry-check); RAG/semantic retrieval; the worktree *technique* itself (Phase 6 delivers that reference — Phase 7 consumes it).

**Detected domain:** Generic
**Evidence:** meta-work on the GSD framework (workflow/CLI/tooling edits — `execute-phase`, `gsd-tools`, `health`); no UI structural signals; not a new agentic-system design (no topology/communication-contract work)
**Confirmed by user:** not prompted (Generic → no confirm prompt)

</domain>

<established>
## Established Patterns (from codebase + roadmap discussion-focus + Phase 6)

- **Two-axis coupling model** (roadmap-locked): Axis A = file/write coupling → worktree isolation (separate worktree *dir*, not just a branch); makes conflicts explicit/reviewable at merge instead of silent. Axis B = decision/knowledge coupling → only sequencing (refuse parallel discuss/plan of `depends_on`-linked phases). Conflating them is the trap.
- **Isolation lives deterministically in `execute-phase`** (workflow runs worktree add→wave→merge) + a session-launch convention for human quick-fixes — NEVER in agent prose (too fragile for a load-bearing guarantee). [STRONG — roadmap + PROJECT principle]
- **Phase 6 ships the worktree *technique* reference; Phase 7 wires the orchestration.** `execute-phase` consumes the reference; do not re-derive (detect-existing, native-first, git fallback, ignore-check, baseline test, sandbox fallback). [STRONG — Phase 6/7 boundary ratified by user]
- **`depends_on` already parsed** in `roadmap.cjs` (L125–126, phase-level) and plan frontmatter (`phase-prompt.md`); a Wave>1-but-empty-`depends_on` consistency check exists in `verify.cjs` (L390–391). No parallel-safety gate yet.
- **Phase 4 file-level dependency graph** (`04-dependency-graph.json`, agents/workflows/tools → callers/spawned_by) is the axis-A file-scope substrate — reuse, don't rebuild.
- **Source↔runtime mirror rule:** edit `get-shit-done/` source AND `.claude/get-shit-done/` runtime; agent files use `~/.claude/` token in source vs absolute path in runtime; only source is committed (runtime gitignored). The doctor symmetry-check verifies exactly this invariant.

</established>

<decisions>
## Implementation Decisions

### Merge ergonomics (scope 1)
- **Auto-merge if clean, pause + surface a reviewable diff only on conflict.** [WEAK, recommendation-backed — picked recommended option from explained tradeoffs]
  - Rationale: keeps the fast path autonomous (minimize human round-trips); the worktree turns a would-be silent mid-run overwrite into an explicit, reviewable conflict at merge. Merge target = the phase branch.

### Parallel-safety gate force (scope 2)
- **Deterministic check, baked into the workflows. HARD-refuses parallel discuss/plan of `depends_on`-linked phases (axis B — decision coupling is unrecoverable); file-scope overlap (axis A) only WARNS** (worktrees make it reviewable at merge). [WEAK, recommendation-backed → STRONG on the axis-B-hard-refuse half, which restates the roadmap success criterion "refuses parallel discussion of dependent phases"]
  - The gate reads both `depends_on` (axis B) and the Phase 4 file-dep graph (axis A).

### Quick-fix convention (scope 1, human-driven path)
- **`/gsd2:quick` auto-creates a worktree when it detects concurrent phase execution**, falling back to in-place when nothing else is running. [WEAK, recommendation-backed → reinforced by the STRONG "deterministic, not agent-prose" principle: a GSD command CAN enforce this where a bare human terminal cannot]
  - This is the highest-value case (quick-fix while a phase runs → axis A dominates, axis B ≈ 0).
  - Open for planning: detection mechanism for "a phase is executing" (candidate: the telemetry/state signal from execute-phase). The roadmap's "session-launch convention" framing still applies as the fallback for sessions opened entirely outside any GSD command.

### Backlog ID scheme (scope 5)
- **`B1, B2, …` non-phase backlog IDs** that live outside the phase-number space; an item gets a real phase number only when promoted into a milestone. [WEAK, recommendation-backed — matches roadmap candidate direction]
  - Replaces `999.x` (which conflates "backlog/unsequenced" with "phase number" and reads oddly next to `vX.Y` milestones and `1,2,3` phases).
  - Touch points to update (from scout): `roadmap.cjs` phase-pattern parser (L107), `review-backlog.md` `ls -d .planning/phases/999*` glob (L19), any 999-glob in workflows, plus migrating existing `999.1` (folded into Phase 7) and `999.2` dirs.

### Doctor symmetry-check shape (scope 4)
- **Fold into `/gsd2:health` (structural check + `--repair` to re-sync) AND call the same check function as an `execute-phase` post-merge step.** No new command. [WEAK, recommendation-backed → STRONG on the no-new-command intent, derived from PROJECT anti-proliferation bias + Phase 6 form-factor principle]
  - Check = `diff -rq get-shit-done .claude/get-shit-done` + settings.json hook/statusLine registration parity.
  - **Deliberately does NOT claim the `/gsd2:doctor` name** — the future *semantic stale-decision healer* doctor (Phase 3 cross-phase note) is a distinct, larger thing; leave the name free for it. This phase's doctor is structural symmetry only.

### Scope & sequencing (scope F)
- **All 5 items land in Phase 7** — they interlock (the gate needs todo `depends_on` edges; the doctor verifies the worktree merge flow). [WEAK, recommendation-backed]
- **Phase 6 must hard-close before Phase 7 starts.** [STRONG, user-override — user overrode the recommendation/roadmap "may start 7 first"]
  - Rationale: the worktree-isolation *technique* reference Phase 6 ships must be final before `execute-phase` wires it; building on a still-changing primitive risks rework. This converts the roadmap's soft "relates to Phase 6" into a **hard dependency**.

</decisions>

<expected_outcome>
## Expected Outcome

- **End state:** A quick-fix in a parallel session, and two independent planned phases, can run concurrently and finish faster than serial. Conflicts surface as reviewable merges, never silent overwrites. A documented gate decides safety from `depends_on` + file-scope and refuses parallel discussion of dependent phases. Todos carry `depends_on`/`related_to` and the gate reads them. `/gsd2:health` reports source↔runtime drift in one invocation. The backlog ID scheme no longer reuses the phase-number space.
- **Success signal (matches roadmap success criteria):**
  1. A quick-fix run in a parallel session no longer silently overwrites a concurrently-executing phase — conflicts surface as a reviewable merge.
  2. The gate decides, from `depends_on` + file-scope, whether a proposed parallel set is safe, and refuses parallel discussion of dependent phases.
  3. Todos carry `depends_on`/`related_to` and the gate reads them.
  4. The doctor symmetry-check reports source↔runtime drift in one invocation (via `/gsd2:health`).
  5. The backlog ID scheme no longer reuses the phase-number space.
- **Flow:** Phase 6 closes → `execute-phase` wires the worktree technique (add→wave→auto-merge-if-clean) → safety gate (hard-refuse axis B, warn axis A) reads `depends_on` + Phase 4 graph + new todo edges → `/gsd2:quick` auto-worktrees under concurrent execution → `/gsd2:health` + post-merge step run the symmetry-check → backlog migrates to B-prefixed IDs.

</expected_outcome>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & requirements
- `.planning/ROADMAP.md` §"Phase 7: Parallel Multi-Session Safety & Planning Ergonomics" (L108–142) — two-axis model, case mapping, scope items 1–5, success criteria. The authoritative discussion-focus.
- `.planning/PROJECT.md` Core Value — minimize human round-trips; loops/skills over agent/command proliferation (constrains gate/doctor form factor).
- `.planning/cross-phase-notes.md` — "From Phase 6 discussion" (Phase 6/7 worktree boundary; SEC-DEFER-01 reversal) and "From Phase 3 discussion" (the SEPARATE semantic-healer doctor — do not conflate).

### Worktree technique (Phase 6 — consume, don't re-derive)
- `.planning/v1.5/phases/06-skill-self-sufficiency-audit-and-port-superpo/06-CONTEXT.md` §"Gap 4 — using-git-worktrees" — the technique reference Phase 7 wires in. **Hard prerequisite: Phase 6 must close first.**

### Axis-B (decision coupling) substrate
- `get-shit-done/bin/lib/roadmap.cjs` L125–126 — `depends_on` extraction; L107 — phase-number pattern (backlog-ID rethink touch point).
- `get-shit-done/bin/lib/verify.cjs` L390–391 — existing Wave>1/`depends_on` consistency check (gate builds alongside).
- `get-shit-done/templates/phase-prompt.md` L20,145,197 — plan-level `depends_on` frontmatter contract.

### Axis-A (file coupling) substrate
- `.planning/v1.4/phases/04-verification-harness-and-context-efficiency/04-dependency-graph.json` + `04-dependency-graph.md` — file-level caller graph; reuse for file-scope disjointness.

### Integration / edit points
- `get-shit-done/workflows/execute-phase.md` — `handle_branching` (L123), `execute_waves` (L176–351), `aggregate_results` (L494), `sync_sidecars` drift heuristic (L760–822). Worktree add before wave; merge after wave; doctor post-merge check.
- `get-shit-done/workflows/quick.md` (`/gsd2:quick`) — auto-worktree-on-concurrent-execution.
- `get-shit-done/workflows/health.md` + `get-shit-done/bin/lib/verify.cjs` (`validate health [--repair]`) — fold in symmetry-check.
- `get-shit-done/workflows/add-todo.md` L92–108 + `get-shit-done/bin/lib/init.cjs` L586–638 + `frontmatter.cjs` schema (~L266) — add `depends_on`/`related_to` todo fields (informal `related:` precedent exists).
- `get-shit-done/workflows/review-backlog.md` L19 — `999*` glob (backlog-ID migration touch point).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Phase 4 file-dep graph** (`04-dependency-graph.json`): ready-made axis-A file-scope substrate — agents/workflows/tools → callers/spawned_by. The gate consumes or re-runs its grep recipes.
- **`depends_on` parsing** (`roadmap.cjs`, `verify.cjs` consistency check): axis-B edges already extracted; the gate reads them rather than re-parsing.
- **`validate health [--repair]`** (`verify.cjs`): existing structural-validation harness — the doctor symmetry-check slots in as another check + repair action.
- **`execute-phase` wave machinery** (`PARALLELIZATION`, wave grouping, `PHASE_BASE` drift heuristic at L760–822): the merge + post-merge-drift hooks attach to existing structure.
- **Informal todo `related:` line** (seen in done/ todos): precedent for formalizing `related_to`.

### Established Patterns
- **Source↔runtime mirror rule** — all edits land in `get-shit-done/` source + `.claude/get-shit-done/` runtime; only source committed. The doctor check *verifies* this invariant, so it must itself respect it.
- **Deterministic-not-prose for load-bearing guarantees** — isolation enforced by workflow/CLI, never by an agent "remembering." Drives the gate-baked-in and `/gsd2:quick` auto-worktree decisions.
- **No-new-commands bias** (PROJECT + Phase 6) — doctor folds into `/gsd2:health`; gate bakes into existing workflows.

### Integration Points
- Worktree: Phase 6 technique reference → `execute-phase` add→wave→merge orchestration (Phase 7 defines the API; build a `gsd-tools` worktree helper here if needed — Phase 6 deliberately left it unbuilt).
- Gate: `depends_on` (roadmap.cjs) + Phase 4 graph + new todo edges → a parallel-safety decision surfaced in execute-phase/discuss-phase.
- Doctor: `diff -rq` + settings.json parity → `/gsd2:health` check + `execute-phase` post-merge step (same check function).

</code_context>

<specifics>
## Specific Ideas

- The silent-overwrite pain being solved (verbatim sense from the roadmap design conversation): today's shared working tree makes it "hard to tell if harm was done" mid-run. Worktrees don't *prevent* conflicts — they make them *explicit and reviewable at merge*.
- The trap to avoid: conflating axis A (file) and axis B (decision) — worktrees do nothing for B; only sequencing does.
- Quick-fix-while-phase-runs is explicitly the "safest, highest value" case — bias build effort there.

</specifics>

<deferred>
## Deferred Ideas

### Reviewed but not folded
- **Semantic stale-decision healer doctor** (Phase 3 cross-phase note) — distinct from this phase's structural symmetry-check; keep the `/gsd2:doctor` name reserved for it. Future phase.
- **RAG / semantic retrieval** (Phase 5 cross-phase note) — the long-tail context solution after partition + graph; far out of Phase 7 scope.
- **`worktree-path-guard` hard-block hook** (SEC-DEFER-01) — its descope rationale ("user doesn't rely on worktree isolation") is now reversed by this phase making isolation load-bearing; reconsider as a follow-up once worktree execution is routine, but not required to ship Phase 7.

None of the above block Phase 7.

</deferred>

---

*Phase: 07-parallel-multi-session-safety-planning-ergono*
*Context gathered: 2026-06-06*
