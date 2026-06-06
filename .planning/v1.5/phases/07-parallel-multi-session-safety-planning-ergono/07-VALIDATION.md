---
phase: 7
slug: parallel-multi-session-safety-planning-ergono
status: planned
nyquist_compliant: true
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
| **Framework** | node:test (built-in) + gsd-tools.cjs CLI smoke checks |
| **Config file** | none — meta-work on GSD shell/CLI/workflow tooling |
| **Quick run command** | `node --test tests/worktree.test.cjs tests/parallel-gate.test.cjs` (new) |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30–60 seconds |

---

## Sampling Rate

- **After every task commit:** Run the relevant `node --test tests/<file>.test.cjs` (new tests, fast)
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd2:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01 T1 | 01 | 1 | SC1 (Wave 0) | Smoke/Integration | `node --test tests/worktree.test.cjs` | tests/worktree.test.cjs, tests/helpers.cjs | ⬜ pending |
| 07-01 T2 | 01 | 1 | SC1 | Integration (TDD) | `node --test tests/worktree.test.cjs` + `diff -q` source/runtime | get-shit-done/bin/lib/worktree.cjs | ⬜ pending |
| 07-01 T3 | 01 | 1 | SC1 | Smoke | `git check-ignore -q .worktrees` | .gitignore | ⬜ pending |
| 07-02 T1 | 02 | 1 | SC3 | Unit (TDD) | `node --test tests/frontmatter.test.cjs` + `diff -q` | get-shit-done/bin/lib/frontmatter.cjs | ⬜ pending |
| 07-02 T2 | 02 | 1 | SC3 | Unit | `init todos --raw` returns depends_on; `diff -q` x3 | init.cjs, add-todo.md | ⬜ pending |
| 07-03 T1 | 03 | 1 | SC4 | Unit (TDD) | `node --test tests/verify-health.test.cjs` + `diff -q` — covers BOTH file-tree drift AND settings.json hook/statusLine parity in one `validate health`; grep `settings.json`+`hooks\|statusLine` in verify.cjs symmetry fn | get-shit-done/bin/lib/verify.cjs | ⬜ pending |
| 07-03 T2 | 03 | 1 | SC4 | Grep | `grep -iE "symmetry\|drift" health.md` + `grep -i settings.json health.md` + `diff -q` | get-shit-done/workflows/health.md | ⬜ pending |
| 07-04 T1 | 04 | 2 | SC5 | Unit (TDD) | `node --test tests/roadmap.test.cjs` + `phase next-backlog-id --raw` | phase.cjs, gsd-tools.cjs | ⬜ pending |
| 07-04 T2 | 04 | 2 | SC5 | Grep/FS | `grep -c 999` (==0), `test -d B1-*`, `test ! -d 999.*` | add-backlog.md, review-backlog.md, ROADMAP.md | ⬜ pending |
| 07-05 T1 | 05 | 3 | SC2, SC3 | Unit (TDD) | `node --test tests/parallel-gate.test.cjs` + `diff -q` | get-shit-done/bin/lib/parallel-gate.cjs | ⬜ pending |
| 07-06 T1 | 06 | 4 | SC1, SC4 | Grep + smoke | `grep worktree/validate health execute-phase.md` + `diff -q` (reads 07-01-SUMMARY executor-targeting caveat first) | execute-phase.md | ⬜ pending |
| 07-06 T2 | 06 | 4 | SC2 | Grep + smoke | `grep parallel-safe` in execute/discuss/plan; `grep worktree` quick.md; `diff -q` x4 | discuss/plan/quick/execute-phase.md | ⬜ pending |
| 07-06 T3 | 06 | 4 | SC1, SC2, SC4 | Checkpoint (human) | `parallel-safe 6 7 --raw`→refuse; `validate health`→no drift; `worktree prune` | (workflow read-through) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Success-criteria coverage targets (from ROADMAP / CONTEXT):**
1. SC1 — Quick-fix surfaces a reviewable merge, never a silent overwrite → 07-01 (worktree CLI conflict test) + 07-06 (execute-phase/quick wiring).
2. SC2 — Gate decides safe/unsafe from `depends_on` + file-scope; HARD-refuses dependent discuss/plan → 07-05 (gate CLI) + 07-06 (workflow wiring).
3. SC3 — Todos carry `depends_on`/`related_to` and the gate reads them → 07-02 (todo schema) + 07-05 (gate reads todo edges).
4. SC4 — `/gsd2:health` reports source↔runtime drift in one invocation → 07-03 (symmetry check: file-tree diff + settings.json hook/statusLine parity) + 07-06 (post-merge step).
5. SC5 — Backlog ID scheme no longer reuses phase-number space → 07-04 (B-prefix migration).

---

## Wave 0 Requirements

- [ ] Smoke-test `git worktree add` succeeds in this environment (07-01 Task 1 — verify before building full worktree orchestration; RESEARCH Open Question 3)
- [ ] `createTempGitRepo()` helper added to tests/helpers.cjs (07-01 Task 1)
- [ ] Worktree conflict/merge integration test scaffold (tests/worktree.test.cjs — 07-01 Task 1/2)
- [ ] Write-isolation probe: a file written into the worktree dir lands on the worktree branch, NOT the main tree (07-01 Task 1 — load-bearing SC1 mechanism; executor-targeting caveat recorded for 07-06)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end two-session ergonomics ("finishes faster than serial, feels safe") | SC1 | Real concurrent human+agent session timing is environment-dependent | Run a quick-fix session while a phase executes; confirm no silent overwrite and a reviewable merge on conflict (07-06 Task 3 checkpoint) |

---

## Validation Sign-Off

- [x] All tasks have `<verify>` automated command or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (git worktree smoke + createTempGitRepo + test scaffold)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned (set true after plans validated 2026-06-06)
