# Phase 7 — Planning Assumptions

Flagged per the plan-phase quality gate. Each is typed `preference` (a judgment call the planner made) or `technical` (a fact taken as true that, if wrong, changes the plan).

---

## A1 — Backlog command files are runtime-only (typed: technical) — CONFIRMED

`add-backlog.md` and `review-backlog.md` exist ONLY in `.claude/commands/gsd2/`; there is NO `get-shit-done/commands/gsd2/` source for them (verified: `ls get-shit-done/commands/gsd2/*backlog*` → none). RESEARCH and CONTEXT both note this. **Decision:** the source↔runtime mirror rule does NOT apply to these two files; Plan 07-04 edits them in place in `.claude/`. The CLI/lib changes (phase.cjs, gsd-tools.cjs) DO follow the mirror rule. If a source copy is later introduced, 07-04 Task 2 would need a mirror step — but no such copy exists today.

## A2 — Doctor diff scope = `get-shit-done/` ↔ `.claude/get-shit-done/` only (typed: technical)

RESEARCH Open Question 1: whether the symmetry-check also diffs `commands/`. **Decision:** scope EXACTLY to `get-shit-done/` ↔ `.claude/get-shit-done/` per the CONTEXT locked decision (`diff -rq get-shit-done .claude/get-shit-done`), plus settings.json hook/statusLine parity as a separate named concern. The `commands/` mirror is OUT of Phase 7 scope (Plan 07-03). Rationale: CONTEXT states `get-shit-done/` only; commands/ wiring is covered elsewhere. If the user wants commands/ drift caught too, that is a follow-up.

## A3 — `--no-verify` removed in worktree path only, kept in in-place fallback (typed: preference)

RESEARCH Open Question 3: each worktree has no pre-commit hook contention, so `--no-verify` (added to dodge shared-tree contention) is unnecessary in worktree mode and can be dropped, letting hooks run cleanly per worktree. **Decision:** Plan 07-06 Task 1 removes the `<parallel_execution>` `--no-verify` instruction in worktree mode and keeps it ONLY on the in-place fallback path. Rationale: cleaner per-worktree hook execution; reversible (re-add if hook runtime proves costly). Low risk — fallback path preserves current behavior.

## A4 — Phase 7's own plans execute on the shared tree → router-editors serialized via depends_on (typed: technical)

The worktree isolation primitive is built DURING Phase 7 (07-01) and only wired into execute-phase at the very end (07-06). Therefore Phase 7 cannot dogfood its own unbuilt isolation — its plans run on the SHARED TREE, where there is no merge to reconcile parallel writes (two parallel executors doing read-modify-write on the same file → last-writer-wins, silent lost update — the exact bug this phase fixes).

**Decision (corrected after advisor review):** three plans edit `get-shit-done/bin/gsd-tools.cjs` (the router): 07-01 (worktree case), 07-04 (next-backlog-id case), 07-05 (parallel-safe case). They are SERIALIZED via `depends_on` so no two share a wave:

| Plan | depends_on | wave | touches gsd-tools.cjs |
|------|-----------|------|------------------------|
| 07-01 | [] | 1 | yes (worktree case) |
| 07-02 | [] | 1 | no |
| 07-03 | [] | 1 | no |
| 07-04 | ["07-01"] | 2 | yes (next-backlog-id case) |
| 07-05 | ["07-02","07-04"] | 3 | yes (parallel-safe case) |
| 07-06 | ["07-01","07-03","07-05"] | 4 | no (workflow .md only) |

Result: each wave has at most one router-editor. 07-02/07-03 stay genuinely parallel with 07-01 (disjoint files). The gate placement in its own lib file (07-05) and the symmetry-check in its own function (07-03) deliberately avoid editing `roadmap.cjs`, and all `execute-phase.md` edits are consolidated into a single plan (07-06) to avoid a same-file collision across waves. (Earlier draft relied on "Phase 04/05 additive-router precedent" — that precedent only holds under git-merge isolation, which Phase 7 does NOT have on its own plans; serialization is the correct fix.)

## A5 — Gate `related_to` is context-only, does NOT trigger refuse (typed: preference)

For todo edges, the gate treats `depends_on` as axis-B coupling (refuse) but `related_to` as context-only (no refuse). **Decision:** Plan 07-05 documents this. Rationale: `related_to` signals shared context, not a correctness dependency; refusing on it would over-block. If real usage shows related_to items genuinely couple, tighten later.
