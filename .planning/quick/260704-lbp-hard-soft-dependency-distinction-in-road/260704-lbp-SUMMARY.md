# Quick Task 260704-lbp: Hard/Soft Dependency Distinction in Roadmap — Summary

**Completed:** 2026-07-04
**Source:** P1 of the parallel-phase design — soft "sequence after" risk-ordering was indistinguishable from a hard `**Depends on**` edge, so the parallel-gate refused to greenlight phases that were actually independent.

## What was done

| Task | Commit | Change |
|------|--------|--------|
| 1 | `8a7d25f` | `roadmap.cjs`: both `cmdRoadmapAnalyze` and `cmdRoadmapGetPhase` now parse a second, optional prose line `**Sequence after**` into a separate `sequence_after` field (raw trimmed string or null), using the same regex shape as `**Depends on**` and supporting both colon-inside/outside bold formats. `depends_on` extraction and semantics are untouched. Added 5 regression/coverage tests to `tests/roadmap.test.cjs`. |
| 2 | `38bf2ef` | `parallel-gate.cjs`: `hasPhaseDecisionCoupling` already read only `depends_on`; added a docblock line making the invariant explicit (soft edges are never read in the axis-B path) — no logic change needed. Extended the `writeRoadmap` test fixture to accept an optional `sequenceAfter` per phase and added two tests: sequence-after-only coupling greenlights (`axis_b_coupled: false`), and a hard `depends_on` edge still refuses even when an unrelated `sequence_after` is also present. |
| 3 | `ac7b20e` | `agents/gsd-roadmapper.md`: added a `hard_vs_soft_dependencies` guidance block instructing that `**Depends on**` is a hard technical dependency only (always present, `Nothing` if none) and `**Sequence after**` is a soft tiebreak, never a scheduling gate — with `Nothing (independent — safe to run in parallel)` for fully independent phases. Extended the phase-detail example with hard/soft/independent phases. `get-shit-done/templates/roadmap.md`: added matching `**Sequence after**` demonstration lines to Phase 3 (soft) and Phase 4 (independent), plus a guidelines bullet explaining the distinction. |

## Verification

- `node --test tests/roadmap.test.cjs`: 38 pass (0 fail) — includes 5 new sequence_after assertions; all pre-existing depends_on tests pass unchanged.
- `node --test tests/parallel-gate.test.cjs`: 9 pass (0 fail) — includes 2 new tests proving the anti-false-serial-edge invariant.
- Combined run (`node --test tests/roadmap.test.cjs tests/parallel-gate.test.cjs`): 47/47 pass.
- `grep -n "Sequence after" agents/gsd-roadmapper.md get-shit-done/templates/roadmap.md`: both files contain the new guidance/examples.

## Impact

- Roadmapper can now flag soft risk-ordering (`**Sequence after**`) separately from hard technical dependencies (`**Depends on**`), so `parallel-safe` no longer refuses phases that are only softly sequenced.
- Backward compatible: roadmaps with no `**Sequence after**` line produce identical `depends_on` output; `sequence_after` is simply null.
- Scope was planning-side only — `autonomous.md` and the executor were not touched, per plan.

## Deviations

None — plan executed exactly as written. No architectural surprises, no bugs found in existing code (axis-B coupling already correctly read only `depends_on`; Task 2 was verification + explicit documentation, not a fix).

## Self-Check

- FOUND: get-shit-done/bin/lib/roadmap.cjs (sequence_after in both cmdRoadmapAnalyze and cmdRoadmapGetPhase)
- FOUND: get-shit-done/bin/lib/parallel-gate.cjs (docblock invariant note)
- FOUND: tests/roadmap.test.cjs (5 new tests)
- FOUND: tests/parallel-gate.test.cjs (2 new tests)
- FOUND: agents/gsd-roadmapper.md (hard_vs_soft_dependencies block + example phases)
- FOUND: get-shit-done/templates/roadmap.md (Sequence after demonstration lines + guidelines bullet)
- FOUND commit 8a7d25f, 38bf2ef, ac7b20e in git log

## Self-Check: PASSED
