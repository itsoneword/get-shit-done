---
phase: 05
slug: milestone-versioned-phase-ids
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-12
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node ≥18 builtin) |
| **Config file** | none (uses defaults); runner `scripts/run-tests.cjs` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` (~30s; 852 tests currently green) |
| **Estimated runtime** | ~30 seconds |
| **Coverage gate** | 70% lines via `c8` on `get-shit-done/bin/lib/*.cjs` |
| **Test fixture helper** | `tests/helpers.cjs` — `createTempProject()`, `runGsdTools()` |

---

## Sampling Rate

- **After every task commit:** Run `npm test` (full suite — it's only ~30s)
- **After every plan wave:** Run `npm test` + manual `gsd-tools` smoke test on tmp fixture
- **Before `/gsd2:verify-work`:** Full suite green AND dogfood retrofit (this repo's `.planning/`) committed
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

Mapped to ROADMAP.md Phase 5 success criteria (SC-1 … SC-8). Per-task IDs assigned by planner.

| Success Criterion | Plan | Wave | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------------|------|------|----------|-----------|-------------------|-------------|--------|
| SC-1 | 05-01 | 1 | `.planning/v1.4/phases/...` canonical post-retrofit; `planningPaths()` partition-aware | unit | `node --test tests/init.test.cjs` (extend with partitioned fixture) | ❌ Wave 0 (extend) | ⬜ pending |
| SC-2 | 05-02 | 2 | Migration prints plan + prompts `[y/N]`; `--dry-run` exits without changes | unit + property | `node --test tests/migration.test.cjs` (new) | ❌ Wave 0 (new) | ⬜ pending |
| SC-3 | 05-02 | 2 | `git mv` preserves history; ref-rewrites in STATE/PROJECT/ROADMAP/cross-phase-notes + path-shaped refs in todos/quick | integration | `node --test tests/migration.test.cjs` (with `createTempGitProject` from helpers.cjs:52-69) | ❌ Wave 0 (new) | ⬜ pending |
| SC-4 | 05-02 | 2 | Missing/corrupt STATE.md `milestone:` → exit 1 with clear refusal error (no path-guess fallback) | unit | `node --test tests/migration.test.cjs::missing-milestone-field` | ❌ Wave 0 (new) | ⬜ pending |
| SC-5 | 05-03 | 3 | `MILESTONE-{ver}-SUMMARY.md` produced with typed-tag sections (`decisions[]`, `requirements_validated[]`, `open_blockers[]`, `entry_points[]`, `public_api[]`) | unit | `node --test tests/milestone.test.cjs` (extend) | ❌ Wave 0 (extend) | ⬜ pending |
| SC-6 | 05-01 | 1 | `cmdInitProgress` (and similar) loads only active milestone phases + summaries of prior milestones | unit | `node --test tests/init.test.cjs::cmdInitProgress` (extend) | ❌ Wave 0 (extend) | ⬜ pending |
| SC-7 | 05-01 | 1 | Decimal-phase resolution (`2.1`) works inside partition; `{padded_phase}`/`{phase_dir}` placeholders resolve | unit + property | `node --test tests/phase.test.cjs::phase-next-decimal` (extend with partitioned fixture) | ❌ Wave 0 (extend) | ⬜ pending |
| SC-8 | 05-03 | 3 | Retrofit of current v1.4 tree performed and committed as integration evidence | E2E / dogfood | Manual: `node bin/gsd-tools.cjs migrate-to-milestone-partition` on this repo; verify `.planning/v1.4/phases/...` exists + commit | ❌ N/A — dogfood proves it | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] **`tests/migration.test.cjs`** — new file. Target: 15–25 tests covering SC-2, SC-3, SC-4. Specifically:
  - dry-run prints plan and does not mutate the fixture tree
  - `[y/N]` confirmation gate: 'n' aborts without changes; 'y' proceeds
  - `git mv` preserves history (assert via `git log --follow <new_path>`)
  - reference rewrite in `STATE.md`, `PROJECT.md`, `ROADMAP.md`, `cross-phase-notes.md`
  - reference rewrite in `todos/**/*.md` and `quick/**/*.md` (path-shaped only — `.planning/phases/NN-...` or bare `phases/NN-...`)
  - free-prose mention of "phase 4" or "phases" is **not** rewritten (false-positive guard)
  - missing STATE.md `milestone:` → exit 1, clear error message
  - corrupt STATE.md frontmatter → exit 1, clear error message
  - manifest file persisted on crash; subsequent runs detect and refuse cleanly
  - same migration idempotent on a fresh manifest (no double-mv)
- [ ] **`tests/helpers.cjs`** — extend with:
  - `createLegacyLayoutFixture(milestone = 'v1.0')` — pre-Phase-5 layout (`.planning/phases/...`)
  - `createPartitionedFixture(milestone = 'v1.4')` — post-Phase-5 layout (`.planning/v1.4/phases/...`)
  - `withStateMilestone(tmpDir, version)` — write STATE.md `milestone:` frontmatter helper
- [ ] **`tests/init.test.cjs`** — extend `cmdInitProgress` tests with a partitioned-layout fixture asserting only active milestone phases are emitted in `phases[]`; prior-milestone summaries surfaced separately. Also extend `cmdInitPlanPhase` to verify `phase_dir` returns partitioned path.
- [ ] **`tests/phase.test.cjs`** — extend `phase-next-decimal` and related tests with a partitioned-layout fixture.
- [ ] **`tests/milestone.test.cjs`** — extend `cmdMilestoneComplete` tests with `MILESTONE-{ver}-SUMMARY.md` emission + typed-tag schema validation.
- [ ] **Backwards-compat fixture** — at least one test asserts that a legacy-layout project, after running `gsd-tools migrate-to-milestone-partition --auto`, ends up structurally identical to a freshly-created partitioned project.
- [ ] No framework install needed — `node:test` is already wired via `package.json` + `scripts/run-tests.cjs`.

---

## Manual-Only Verifications

| Behavior | Success Criterion | Why Manual | Test Instructions |
|----------|-------------------|------------|-------------------|
| Dogfood retrofit on this repo | SC-8 | Real-world integration test, not a tmpDir fixture; verifies migration handles the exact set of root-files + todos + quick artifacts that exist in v1.4 | After Plans 05-01/02/03 land: run `node bin/gsd-tools.cjs migrate-to-milestone-partition --dry-run`. Review plan. Run without `--dry-run`, confirm `[y]`. Verify `.planning/v1.4/phases/*` exists with full git history (`git log --follow`). Run `npm test`. Commit. |
| `/gsd2:progress` token reduction | SC-6 (proof — beyond SC-6's unit assertion) | Token count is project-dependent; only meaningful on a real downstream project | After Phase 5 lands and is installed globally: run `/gsd2:progress` in a multi-milestone project (e.g. a cv_work clone with v1.4 + v1.5 phases). Capture `/context` message tokens. Compare to pre-Phase-5 baseline. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all Wave-0 (❌) references above
- [ ] No watch-mode flags (full suite runs to completion in <30s)
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter after sign-off

**Approval:** pending
