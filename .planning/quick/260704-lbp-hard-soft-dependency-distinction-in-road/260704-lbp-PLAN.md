---
phase: quick-260704-lbp
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - get-shit-done/bin/lib/roadmap.cjs
  - get-shit-done/bin/lib/parallel-gate.cjs
  - agents/gsd-roadmapper.md
  - get-shit-done/templates/roadmap.md
  - tests/roadmap.test.cjs
  - tests/parallel-gate.test.cjs
autonomous: true
requirements: []
sidecar_impact: []
must_haves:
  truths:
    - "`roadmap analyze --raw` emits a `sequence_after` field per phase, separate from `depends_on`, populated from a `**Sequence after**` prose line."
    - "`roadmap get-phase <N> --raw` emits both `depends_on` and `sequence_after` fields."
    - "parallel-safe greenlights two phases coupled ONLY by `**Sequence after**` (no axis-B refuse)."
    - "A roadmap with only `**Depends on**` (no `**Sequence after**`) produces identical output to before: `depends_on` unchanged, `sequence_after` null."
    - "gsd-roadmapper instructs: `**Depends on**` = hard technical dependency only; `**Sequence after**` = soft ordering; independent phases explicitly flagged."
  artifacts:
    - get-shit-done/bin/lib/roadmap.cjs
    - get-shit-done/bin/lib/parallel-gate.cjs
    - agents/gsd-roadmapper.md
    - get-shit-done/templates/roadmap.md
    - tests/roadmap.test.cjs
    - tests/parallel-gate.test.cjs
  key_links:
    - "roadmap.cjs: `**Sequence after**` is parsed into `sequence_after`, NEVER into `depends_on` (breakage = soft edges leak as hard, false serial edges persist)."
    - "parallel-gate.cjs hasPhaseDecisionCoupling reads `depends_on` only (breakage = soft ordering triggers refuse and blocks legitimate parallelism)."
---

<objective>
Add a hard/soft dependency distinction to the roadmap layer so soft risk-ordering no longer creates false serial edges that block parallel scheduling (P1 of the parallel-phase design).

Today `roadmap.cjs` scrapes `**Depends on**` from ROADMAP prose and the parallel-gate treats every such edge as a hard axis-B coupling → refuse. A soft "sequence after 02, not a hard dependency" is indistinguishable from a hard edge, so independent phases are serialized.

This plan makes the roadmapper emit a second, optional prose line `**Sequence after**` (soft) and threads it through parsing as a SEPARATE `sequence_after` field. Hard `depends_on` semantics are unchanged; only hard edges feed axis-B coupling. Scope is planning-side only — do NOT touch autonomous.md or the executor.

Backward compatibility is a hard requirement: roadmaps with no `**Sequence after**` line must produce output identical to today.
</objective>

<execution_context>
@/home/cleversol/gsd2/mine/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@/home/cleversol/gsd2/mine/get-shit-done/bin/lib/roadmap.cjs
@/home/cleversol/gsd2/mine/get-shit-done/bin/lib/parallel-gate.cjs
@/home/cleversol/gsd2/mine/agents/gsd-roadmapper.md
@/home/cleversol/gsd2/mine/get-shit-done/templates/roadmap.md
@/home/cleversol/gsd2/mine/tests/roadmap.test.cjs
@/home/cleversol/gsd2/mine/tests/parallel-gate.test.cjs

<interfaces>
Existing depends_on extraction (roadmap.cjs cmdRoadmapAnalyze, ~line 125):
```js
const dependsMatch = section.match(/\*\*Depends on(?::\*\*|\*\*:)\s*([^\n]+)/i);
const depends_on = dependsMatch ? dependsMatch[1].trim() : null;
```
The value is stored as a RAW trimmed string (e.g. "Phase 1" or "Nothing"), NOT parsed into numbers. sequence_after must follow the exact same shape: raw trimmed string or null.

Axis-B coupling (parallel-gate.cjs hasPhaseDecisionCoupling, ~line 132) reads ONLY `phaseA.depends_on` / `phaseB.depends_on` via string `.includes(\`Phase ${n}\`)`. It never reads sequence_after — so keeping the two fields separate in roadmap.cjs is what guarantees soft edges never refuse.

Tests shell out to the SOURCE lib: helpers.cjs `TOOLS_PATH = get-shit-done/bin/gsd-tools.cjs`, and parallel-gate.cjs shells to `__dirname/../gsd-tools.cjs`. No runtime build (`npm run dev`) is required for tests to pass against these edits.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Parse **Sequence after** as a separate sequence_after field (both getter + analyze) with regression tests</name>
  <files>get-shit-done/bin/lib/roadmap.cjs, tests/roadmap.test.cjs</files>
  <action>
In `get-shit-done/bin/lib/roadmap.cjs`:

1. In `cmdRoadmapAnalyze`, immediately after the existing `depends_on` extraction (~line 125-126), add a parallel soft-edge extraction using the same regex shape:
```js
const sequenceMatch = section.match(/\*\*Sequence after(?::\*\*|\*\*:)\s*([^\n]+)/i);
const sequence_after = sequenceMatch ? sequenceMatch[1].trim() : null;
```
Add `sequence_after` to the object pushed into `phases` (right after `depends_on`). Do NOT alter the `depends_on` regex or its meaning.

2. In `cmdRoadmapGetPhase`, the per-phase getter currently emits neither field. Extract BOTH from the phase `section` (after the goal/criteria extraction, before the `output(...)` call) and add both to the emitted object:
```js
const dependsMatch = section.match(/\*\*Depends on(?::\*\*|\*\*:)\s*([^\n]+)/i);
const depends_on = dependsMatch ? dependsMatch[1].trim() : null;
const sequenceMatch = section.match(/\*\*Sequence after(?::\*\*|\*\*:)\s*([^\n]+)/i);
const sequence_after = sequenceMatch ? sequenceMatch[1].trim() : null;
```
Add `depends_on` and `sequence_after` to the getter's output object. These are additive fields — backward compatible.

CRITICAL: `**Sequence after**` must land in `sequence_after` ONLY, never in `depends_on`. Verify the depends_on regex `\*\*Depends on...` cannot match a `**Sequence after**` line (it cannot — different literal), and vice versa.

In `tests/roadmap.test.cjs`, add tests in the existing `roadmap analyze command` and `roadmap get-phase command` describe blocks:
- analyze: a phase with both `**Depends on**: Phase 1` and `**Sequence after**: Phase 2` → `depends_on === 'Phase 1'` AND `sequence_after === 'Phase 2'` (soft did NOT leak into depends_on).
- analyze regression: a phase with only `**Depends on**: Phase 1` and no sequence line → `depends_on === 'Phase 1'` AND `sequence_after === null` (byte-identical prior behavior; sequence_after absent/null).
- analyze: a phase with ONLY `**Sequence after**: Phase 1` (no Depends on) → `sequence_after === 'Phase 1'` AND `depends_on === null`.
- get-phase: a phase with both lines → output has `depends_on` and `sequence_after` set correctly.
Cover both colon-inside (`**Sequence after:**`) and colon-outside (`**Sequence after**:`) bold formats in at least one assertion, matching the existing depends_on test style.
  </action>
  <verify>node --test /home/cleversol/gsd2/mine/tests/roadmap.test.cjs 2>&1 | tail -20</verify>
  <done>New sequence_after assertions pass; all pre-existing roadmap tests still pass; a depends_on-only roadmap yields sequence_after null with depends_on unchanged.</done>
</task>

<task type="auto">
  <name>Task 2: Confirm axis-B coupling ignores soft edges; prove sequence_after-only phases greenlight</name>
  <files>get-shit-done/bin/lib/parallel-gate.cjs, tests/parallel-gate.test.cjs</files>
  <action>
`hasPhaseDecisionCoupling` in `get-shit-done/bin/lib/parallel-gate.cjs` already reads ONLY `depends_on`. No logic change is needed for correctness once Task 1 keeps `sequence_after` separate. Make the invariant explicit and defensive:

1. In the docblock above `hasPhaseDecisionCoupling` (~line 122-131), add a line: soft `sequence_after` edges are intentionally NOT read here — axis-B refuse is driven exclusively by hard `depends_on`; soft ordering is a tiebreak, never a refuse.
2. Do NOT read `sequence_after` anywhere in the axis-B path. Do NOT weaken axis-A file-overlap logic. Leave axis-A untouched.

In `tests/parallel-gate.test.cjs`:
1. Extend the `writeRoadmap` fixture helper to accept an optional `sequenceAfter` per phase and, when present, emit a `**Sequence after**: <val>` line into that phase's section (alongside the existing `**Depends on**` line).
2. Add a test in the `parallel-safe gate` describe: two phases where the only coupling is `sequenceAfter` (e.g. phase 4 `**Sequence after**: Phase 3`, NO depends_on edge, disjoint files) → `decision === 'greenlight'`, `safe === true`, `axis_b_coupled === false`. This is the core anti-false-serial-edge proof.
3. Add a guard test: a phase with BOTH a hard `dependsOn` edge and an unrelated `sequenceAfter` still refuses on the hard edge (confirms hard semantics preserved and soft line does not mask them).
  </action>
  <verify>node --test /home/cleversol/gsd2/mine/tests/parallel-gate.test.cjs 2>&1 | tail -20</verify>
  <done>Sequence-after-only phases greenlight (axis_b_coupled false); hard depends_on still refuses; all pre-existing parallel-gate tests pass.</done>
</task>

<task type="auto">
  <name>Task 3: Instruct roadmapper on hard vs soft edges + independent-phase flagging; update templates</name>
  <files>agents/gsd-roadmapper.md, get-shit-done/templates/roadmap.md</files>
  <action>
In `agents/gsd-roadmapper.md`:
1. In the `## ROADMAP.md Structure` → detail-section example (the `### Phase X:` block, ~lines 194-209), add a `**Sequence after**` line to at least one phase and demonstrate an independent phase. Concretely show all three edge states across the example phases:
   - hard: `**Depends on**: Phase 1`
   - soft: `**Sequence after**: Phase 2` (with `**Depends on**: Nothing`)
   - independent: `**Depends on**: Nothing` and `**Sequence after**: Nothing (independent — safe to run in parallel)`
2. Add a short guidance block (near `<phase_identification>` or `<coverage_validation>`) titled e.g. "Hard vs soft dependencies" instructing:
   - Emit `**Depends on**` ONLY for a hard technical dependency: phase B literally needs phase A's artifact to compile/run.
   - Emit `**Sequence after**` for soft risk/preference ordering (build the risky one first, proven-pattern-first) — this is a tiebreak, NOT a scheduling gate.
   - Every phase MUST carry a `**Depends on**` line; use `Nothing` when there is no hard dependency and explicitly flag fully-independent phases (no hard deps AND no soft ordering) so they surface as parallel candidates.
   - Rationale (one line): soft edges written as `**Depends on**` create false serial edges that block parallel scheduling.

In `get-shit-done/templates/roadmap.md`:
- Add `**Sequence after**` demonstration lines so the template shows both edge kinds and at least one explicitly independent phase. Keep existing `**Depends on**` lines intact; make the additions consistent with the roadmapper example above.

This is documentation/prompt guidance only — no code, no unit test. tdd="false".
  </action>
  <verify>grep -n "Sequence after" /home/cleversol/gsd2/mine/agents/gsd-roadmapper.md /home/cleversol/gsd2/mine/get-shit-done/templates/roadmap.md</verify>
  <done>Both files contain `**Sequence after**` guidance/examples; roadmapper explicitly distinguishes hard vs soft and instructs flagging fully-independent phases; existing `**Depends on**` lines preserved.</done>
</task>

</tasks>

<verification>
Run both affected suites and confirm no regressions elsewhere:
```
node --test /home/cleversol/gsd2/mine/tests/roadmap.test.cjs
node --test /home/cleversol/gsd2/mine/tests/parallel-gate.test.cjs
```
Manual smoke (optional): create a tmp ROADMAP with a `**Sequence after**`-only edge and run `roadmap analyze --raw` — confirm `sequence_after` populated and `depends_on` null for that phase.
</verification>

<success_criteria>
- `roadmap analyze` and `roadmap get-phase` both expose `depends_on` (hard, unchanged) and `sequence_after` (soft) as separate fields.
- `**Sequence after**` is never parsed into `depends_on`.
- parallel-safe greenlights two phases coupled only by `sequence_after`; hard `depends_on` still refuses.
- Roadmaps without a `**Sequence after**` line behave byte-identically to before (sequence_after null).
- gsd-roadmapper and the roadmap template document the hard/soft distinction and independent-phase flagging.
- All pre-existing tests in both suites pass.
</success_criteria>

<output>
After completion, create `.planning/quick/260704-lbp-hard-soft-dependency-distinction-in-road/260704-lbp-SUMMARY.md`.
</output>
