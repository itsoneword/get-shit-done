---
phase: 7
slug: parallel-multi-session-safety-planning-ergono
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-06
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Detailed per-success-criterion verification design lives in `07-RESEARCH.md` §"Validation Architecture". The planner fills the Per-Task Verification Map below from the plans it produces.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node (gsd-tools.cjs CLI) + bash integration scripts |
| **Config file** | none — meta-work on GSD shell/CLI/workflow tooling |
| **Quick run command** | `node .claude/get-shit-done/bin/gsd-tools.cjs <subcommand>` smoke checks |
| **Full suite command** | bash integration scripts (worktree add→conflict→merge; gate refuse/greenlight; `diff -rq` symmetry; todo-frontmatter parse; backlog-ID glob migration) |
| **Estimated runtime** | ~30–60 seconds |

---

## Sampling Rate

- **After every task commit:** Run the relevant smoke check (CLI subcommand or targeted grep assertion)
- **After every plan wave:** Run the full integration script set
- **Before `/gsd2:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| *(planner fills from plans — one row per task, mapped to the 5 success criteria below)* | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Success-criteria coverage targets (from ROADMAP / CONTEXT):**
1. Quick-fix in a parallel session surfaces a reviewable merge, never a silent overwrite → worktree integration test (force a conflict, assert pause + reviewable diff).
2. Gate decides safe/unsafe from `depends_on` + file-scope; HARD-refuses parallel discuss/plan of dependent phases → gate unit tests (dependent set → refuse; disjoint set → greenlight; file overlap → warn).
3. Todos carry `depends_on`/`related_to` and the gate reads them → todo-frontmatter parse test.
4. `/gsd2:health` reports source↔runtime drift in one invocation → `diff -rq` symmetry assertion (with `agents/` path-token exclusion).
5. Backlog ID scheme no longer reuses phase-number space → backlog-ID glob migration test (`B1, B2…`; `999*` globs updated).

---

## Wave 0 Requirements

- [ ] Smoke-test `git worktree add` succeeds in this environment (Research Open Question 3 — verify before building full worktree orchestration)
- [ ] Integration script scaffold for worktree conflict/merge assertions

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end two-session ergonomics ("finishes faster than serial, feels safe") | SC1 | Real concurrent human+agent session timing is environment-dependent | Run a quick-fix session while a phase executes; confirm no silent overwrite and a reviewable merge on conflict |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
