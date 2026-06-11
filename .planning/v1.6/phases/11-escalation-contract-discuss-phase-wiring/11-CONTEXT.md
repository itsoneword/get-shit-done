# Phase 11: Escalation Contract + discuss-phase Wiring - Context

**Gathered:** 2026-06-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship the written escalation contract artifact (4 discrete criteria → 3-tier verdict schema), wire an inline evaluator into discuss-phase's `question_triage` that fires only when `GSD_RUN_ID` is active and writes the verdict into the ledger record at append time, define the handcrafted golden set (≥10 scenarios), and document the human trust-ladder calibration gate that blocks Phase 13. Mailbox interactivity (Phase 12), the overnight runner and autonomous.md wiring (Phase 13) are NOT in this phase.

**Detected domain:** Generic
**Evidence:** Deliverable is a contract reference doc + workflow prose edits + a human calibration procedure; the evaluator is explicitly an inline orchestrator reasoning block, NOT a spawned agent (ARCHITECTURE.md Component 2)
**Confirmed by user:** not contested (offered, no objection)

</domain>

<established>
## Established Patterns (from codebase + Phase 10)

- `GSD_RUN_ID` env var is THE run signal — never a config key [STRONG, locked Phase 10; supersedes ARCHITECTURE.md's config-set assumption]
- Ledger records are write-once; verdict must be produced BEFORE append — decision + verdict in one JSONL line; no `ledger patch`, superseding records for revisions [STRONG, locked Phase 10]
- `ledger.cjs` already accepts caller-supplied `escalation_verdict` / `escalation_reason` (defaults null, `Object.assign` override at `ledger.cjs:231-238`) — **no lib changes required**
- Interactive sessions without `GSD_RUN_ID`: zero behavior change; the Phase 10 run-context gate already errors loudly on out-of-run appends
- Orchestrator-level only — evaluator is prose-inline in the workflow, never a Task() spawn (subagents lack Skill/Agent grants)
- Framework reference docs live in `get-shit-done/references/` and are consumed by workflow prose (pattern: `resolution-loop.md`)
- Source→runtime: edits in `get-shit-done/`, synced to `.claude/` via `npm run dev`

</established>

<decisions>
## Implementation Decisions

### Contract artifact location (ESC-01)
- Contract lives at `get-shit-done/references/escalation-contract.md` — framework-shipped, consumed by discuss-phase prose like `resolution-loop.md` [STRONG, specialist-backed — convention match; offered with override, user accepted]
- Golden set is calibration material, not framework: lives in the phase dir as `11-GOLDEN-SET.md` [STRONG, specialist-backed]

### Criteria precision (ESC-01)
- ARCHITECTURE.md Component 2 draft definitions are hardened into discrete, checkable conditions per criterion — literal action/path lists, no inference required to apply [STRONG — verbatim roadmap success criterion 1 + discussion-focus directive]
- Starting definitions: irreversibility = not undoable by `git revert` or one CLI command; security = touches credentials, network egress, or hook execution paths; scope change = adds work outside the phase CONTEXT.md `<domain>` boundary; spec ambiguity = contradicts a [STRONG] decision or resolution loop returned LOW after budget exhausted
- Contract structure: criterion → discrete conditions → mapped tier. Exact verb lists are planner/executor work within this structure

### Verdict tiers + tie-break bias (ESC-02)
- Three tiers per ARCHITECTURE.md: `proceed` (HIGH confidence, reversible, no criterion fires), `proceed-and-log` (MEDIUM/borderline, reversible), `park-and-ask` (any criterion fires) [STRONG — REQUIREMENTS ESC-01]
- Borderline tie-break defaults to **proceed-and-log**, NOT park — `proceed-and-log` is the neutral tier: do the work, flag it, discuss in morning review [STRONG — user explicitly chose balance over strict over-asking: "we need a balance... start with something neutral and see where it goes"]
- EXCEPTION: when irreversibility or security is the borderline criterion, tie-break parks — those two cannot be fixed in morning review [STRONG — user accepted the carve-out rationale]

### Evaluator wiring (ESC-02)
- Evaluator is a sub-step in discuss-phase `question_triage` AFTER the resolution loop, prose-inline [STRONG — ARCHITECTURE.md Component 2 placement, roadmap success criterion 2]
- Fires only when `GSD_RUN_ID` is set; verdict + reason included in the single `ledger append` call (write-once)
- In Phase 11's interactive calibration mode, a park-and-ask verdict still asks the human directly (as discuss-phase normally would) — branch parking + mailbox routing is Phase 12
- autonomous.md `smart_discuss` wiring is NOT this phase — deferred to Phase 13 (which also owns the fixed-question-count alignment in autonomous.md:255/276)

### Golden set (ESC-03)
- Handcrafted, ≥10 scenarios: at least 2 per criterion that must yield park-and-ask, plus clear proceed and proceed-and-log cases [STRONG, specialist-backed — deterministic, testable against the contract before any real run]
- Entry format: scenario + expected verdict + which discrete condition fires
- The real interactive phase run (`GSD_RUN_ID=<id> claude`, one full discuss-phase) is the live confirmation on top of the golden set, per roadmap success criterion 3

### Trust-ladder gate (ESC-03)
- Neutral starting threshold, expected to be tuned after first real runs [STRONG — user: "start with something neutral and see where it goes"]:
  - Hard criteria (irreversibility, security): **zero misses** — non-negotiable even in neutral posture [STRONG — user accepted; can't be fixed in the morning]
  - Soft criteria (scope, ambiguity): a miss landing in `proceed-and-log` is acceptable (still seen in review); a miss landing in plain `proceed` counts against the gate, ≤1 allowed [WEAK, specialist-backed — concrete numbers proposed by specialist, user accepted the posture not the digits; planner may adjust numbers, not the structure]
  - False parks: ≤3 in 10 [WEAK, specialist-backed — same]
- Gate record: human writes PASS/FAIL + date + run-id into committed `11-CALIBRATION.md`; Phase 13 discuss-phase checks that file contains PASS before proceeding [STRONG, specialist-backed — gate is social per roadmap success criterion 4, the file is just the structural witness]
- Contract artifact carries a short "calibration posture" note: these dials are a starting point, not doctrine

### Claude's Discretion
- Exact discrete verb/condition lists per criterion (within the hardened-structure requirement)
- Golden set scenario content and count beyond the ≥10 / ≥2-per-criterion floor
- 11-CALIBRATION.md template wording; exact evaluator prose block wording
- Whether the contract embeds the verdict-tier definitions or references REQUIREMENTS.md

</decisions>

<expected_outcome>
## Expected Outcome

User's north star (restated this session, [STRONG]): GSD evolves phase-by-phase into a self-sufficient mechanism — runs all night across phases in parallel, researches everything researchable, raises and saves only the questions that need a human, then the human has one meaningful ~1-hour morning discussion answering everything, and the run resumes to execute what was decided.

- **End state for this phase:** the escalation contract exists as a readable artifact; running one real interactive phase under `GSD_RUN_ID` produces a ledger where every autonomous decision carries a verdict; the human reads that ledger plus the golden set and records PASS/FAIL in 11-CALIBRATION.md
- **Success signal:** golden-set scenarios each map to their expected verdict by reading the contract alone (no inference); the real run's ledger shows zero hard-criteria misses; interactive sessions without a run_id are byte-identical to today
- **Flow:** discuss-phase resolves a question autonomously → evaluator applies contract → verdict written in the same ledger append → human reviews one filtered ledger → calibration PASS unblocks Phase 13

</expected_outcome>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Contract + evaluator design
- `.planning/research/ARCHITECTURE.md` §Component 2 — verdict schema, draft criteria table, inline-not-subagent placement rationale (note: any `config-set harness.run_id` mention elsewhere in that doc is SUPERSEDED by GSD_RUN_ID)
- `.planning/research/PITFALLS.md` — Pitfall 6 (unverifiable decisions)

### Requirements + success criteria
- `.planning/ROADMAP.md` §Phase 11 — four success criteria + Discussion focus line
- `.planning/REQUIREMENTS.md` — ESC-01, ESC-02, ESC-03

### Locked upstream decisions
- `.planning/v1.6/phases/10-decision-ledger-cli-foundation/10-CONTEXT.md` — run-id signaling, write-once ledger, schema fields
- `.planning/cross-phase-notes.md` §"From Phase 10 discussion" — the three Phase 11-targeted locked notes

### Integration surfaces
- `get-shit-done/bin/lib/ledger.cjs` — append accepts `escalation_verdict`/`escalation_reason`; REQUIRED_FIELDS validation; run-context gate
- `get-shit-done/workflows/discuss-phase.md` §question_triage — where the evaluator sub-step is spliced
- `get-shit-done/references/resolution-loop.md` — the loop the evaluator runs after; pattern template for a framework reference doc

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ledger.cjs` `cmdLedgerAppend`: verdict fields pass through caller input today — Phase 11 needs zero lib changes, only the workflow constructs richer JSON
- `mailbox.cjs` append primitive exists (Phase 10) — available if a park-and-ask verdict should also record the question now, though interactive calibration asks the human directly
- `resolution-loop.md` — structural template for how discuss-phase prose consumes a references/ doc

### Established Patterns
- Workflow prose edits live in `get-shit-done/workflows/`, references in `get-shit-done/references/`; `npm run dev` syncs to `.claude/`
- Phase 10 unit-test conventions (983 passing) — if any testable pure logic is added it follows `bin/lib/` + test-suite structure; the evaluator itself is prose, not code

### Integration Points
- `discuss-phase.md` `question_triage` — evaluator sub-step after resolution loop, guarded by `GSD_RUN_ID` check
- `references/escalation-contract.md` — new file, loaded by the evaluator sub-step
- `11-GOLDEN-SET.md` + `11-CALIBRATION.md` — phase-dir calibration artifacts; Phase 13 reads 11-CALIBRATION.md as its structural gate
- Future consumers (do NOT wire now): Phase 12 mailbox parking on park-and-ask; Phase 13 autonomous.md `smart_discuss` evaluator + `/gsd2:overnight`

</code_context>

<specifics>
## Specific Ideas

- "We need a balance between ask 10 questions instead of 1 bad decision and make working code based on self-performed research and discuss it later... start with something neutral and see where it goes" — proceed-and-log is the embodiment of that neutral middle; thresholds are dials, not doctrine
- Morning-review framing: a wrong scope/ambiguity call is reviewable and revertable from the ledger later; a wrong security/irreversible call is not — hence the asymmetric tie-break

</specifics>

<deferred>
## Deferred Ideas

- Branch parking + mailbox routing on park-and-ask — Phase 12 (PARK-01)
- autonomous.md `smart_discuss` evaluator wiring + fixed-question-count alignment (autonomous.md:255/276) — Phase 13
- Threshold tuning after first real overnight runs — post-calibration activity, contract documents the dials
- Whether calibration evidence should eventually be committed run artifacts (`.planning/run/` is gitignored) — revisit if PR-review of runs becomes wanted (Phase 10 [WEAK] git-posture decision)

### Reviewed Todos (not folded)
- "Add user sync checkpoints to plan-phase subagent chains" (match 0.6) — plan-phase workflow concern, unrelated to escalation contract; already reviewed-out in Phase 10

</deferred>

---

*Phase: 11-escalation-contract-discuss-phase-wiring*
*Context gathered: 2026-06-11*
