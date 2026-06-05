# Phase 5: Plan-Loop Convergence and Verify Fix - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Two self-contained changes to GSD's own meta-tooling:

1. **CONV-01** — Add stall-detection to the `plan-phase` revision loop (`get-shit-done/workflows/plan-phase.md` step 12) so that when the checker's BLOCKER+WARNING count fails to converge, the loop emits a `## STALL DETECTED` diagnosis and escalates, rather than presenting a blunt "max iterations reached" with no convergence signal.
2. **FIX-01** — Fix `parseMustHavesBlock` (`get-shit-done/bin/lib/frontmatter.cjs:163`) so `gsd-tools verify artifacts` / `verify key-links` work on real (2-space-indented) plans instead of silently returning `[]`.

Scope is **plan-phase revision loop only** (CONV-01) and the **`parseMustHavesBlock` parser + its callers** (FIX-01). No changes to the execute-phase verify_loop, the checker agent's output contract, or `max_iterations`.

**Detected domain:** Generic
**Evidence:** Modifies workflow prose (`plan-phase.md` control flow) + a CLI lib regex (`frontmatter.cjs`); no `src/components`/`app/` UI signals, no new agent system being designed (existing gsd-planner/gsd-plan-checker loop is being tuned, not architected — no new communication contracts, security boundaries, or topology decisions that AGENT-SPEC would capture).
**Confirmed by user:** yes (implicit — domain not contested; choices made were implementation-level)

</domain>

<established>
## Established Patterns (from codebase)

- **Revision loop, `plan-phase.md` step 12**: Tracks `iteration_count` (starts at 1 after initial plan+check), `max 3`. On `## ISSUES FOUND` it re-spawns `gsd-planner` in revision mode, then re-spawns `gsd-plan-checker` (step 10), incrementing the counter. At `iteration_count >= 3` it shows "Max iterations reached. {N} issues remain" and offers **Force proceed / Provide guidance and retry / Abandon**. — This is the loop CONV-01 augments.
- **Checker already emits parseable counts**: `gsd-plan-checker` returns, on `## ISSUES FOUND`, a header line `**Issues:** {X} blocker(s), {Y} warning(s), {Z} info` (`agents/gsd-plan-checker.md:279`). The BLOCKER+WARNING signal CONV-01 needs **already exists in the return text** — no checker-agent change required; the orchestrator just has to capture it each cycle and compare. Parse must be tolerant (regex on that line).
- **CHECKPOINT-file pattern**: ceiling-reached / checkpoint state is written to a file elsewhere in the workflow — the precedent for persisting loop state *if it ever needs to cross workflow boundaries*. Deliberately NOT used here (see decisions).
- **`parseVerifyCommands` (Phase 4, frontmatter.cjs)**: Phase 4 wrote a *separate* parser to dodge `parseMustHavesBlock`'s indent bug. So `verify commands` already works on 2-space plans; only `verify artifacts` / `verify key-links` (which route through `parseMustHavesBlock`) are broken.

</established>

<decisions>
## Implementation Decisions

### CONV-01: Stall threshold
- **Stall condition = the BLOCKER+WARNING count is non-decreasing for 2 consecutive comparison cycles.** [STRONG — user picked the recommended "2 cycles" deliberately over both the aggressive 1-cycle and the do-nothing "only at max" options]
- **Important nuance for the planner:** with `max_iterations = 3` there are exactly 2 comparison cycles (C2-vs-C1, C3-vs-C2). So "2 consecutive non-decreasing" is *confirmable precisely at iteration 3* — the same boundary where the max-iterations branch already fires. CONV-01 therefore does NOT add an earlier exit; it makes the **iteration-3 escalation convergence-aware**. [STRONG — explicitly reasoned through with user]
- **Do NOT raise `max_iterations`** to manufacture an earlier stall exit — out of scope, would be scope creep. [STRONG]

### CONV-01: What the orchestrator must track
- Capture the BLOCKER+WARNING count at **every** `## ISSUES FOUND` (C1 at the first check, C2, C3…) into live orchestrator working state — a small trajectory list. [STRONG — derived from the threshold decision]
- Source of the count: parse the checker's `**Issues:** {X} blocker(s), {Y} warning(s), …` line tolerantly. BLOCKER+WARNING only — `info` is excluded from the convergence metric. [STRONG]

### CONV-01: Escalation UX
- At the escalation boundary, branch the message on convergence: [STRONG — user picked recommended "soft prompt, reuse existing options"]
  - **Count never decreased (stalled)** → emit a `## STALL DETECTED` block showing the trajectory (e.g. "Issue count: 5 → 5 → 5 — not converging") + the unresolved issue list.
  - **Count was decreasing but didn't reach zero** → keep the existing "Max iterations reached. {N} issues remain" message (not a stall).
- **Both branches present the SAME existing options**: Force proceed / Provide guidance and retry / Abandon. No new option set, no new escalation mechanism — just a clearer diagnosis triggered at the existing boundary. [STRONG]

### CONV-01: Stall state persistence
- **Inline only** — the trajectory and STALL DETECTED block live in the conversation/orchestrator working state, NOT written to disk. [STRONG, user-conditional-resolved]
- **User's condition:** "if only active within a single workflow → inline is fine; if it can be used between workflows → file." Resolution: the revision loop runs entirely within **one `plan-phase` invocation**; a stall is resolved in-session (force/retry/abandon) and has no resume-across-sessions path today → condition selects **inline**.
- **Deferred trigger:** if a future phase makes planning resumable mid-loop (stall must survive a session boundary), switch to the CHECKPOINT-file pattern. Captured in Deferred Ideas — do NOT build the file path now.

### FIX-01: parseMustHavesBlock fix scope
- **Generalize to N-space indentation**, not a hardcoded 2-space swap. [STRONG — user picked recommended "generalize to N-space"]
- The current parser hardcodes the block header at 4 spaces, list items at 6, continuation keys at 8+, nested array items at 10+ (`frontmatter.cjs:171,187,205,212`). Real plans are 2/4/6/8. The fix detects the block's base indent dynamically and parses **relative** to it, so it works for 2-space (today) AND 4-space, and is immune to future template reflow. [STRONG]
- **Lock with a regression test on a real 2-space-indented plan fixture** — `verify artifacts` and `verify key-links` must return the correct non-empty lists (the two failing success criteria). [STRONG — user emphasized killing the whole bug class]
- Keep the existing callers (`verify.cjs`) working; do not change `parseVerifyCommands` (already correct, separate code path).

### Folded Todos
None — no pending todos matched this phase.

</decisions>

<expected_outcome>
## Expected Outcome

- **End state:**
  - When the user runs `/gsd2:plan-phase {N}` and the checker keeps finding the same number of blockers+warnings across iterations, the loop says `## STALL DETECTED` with the count trajectory and hands back — instead of silently burning the iteration budget and reporting a flat "max reached."
  - `gsd-tools verify artifacts <plan>` and `gsd-tools verify key-links <plan>` return the correct lists for every current (2-space-indented) plan, where today they return "no blocks found"/`[]`.
- **Success signal:**
  - CONV-01: a non-converging plan run produces a `## STALL DETECTED` block citing the trajectory; a converging-but-incomplete run still shows the normal "max iterations" message. Both offer Force proceed / Retry / Abandon.
  - FIX-01: a regression test runs `verify artifacts` / `verify key-links` against a real 2-space plan fixture and asserts the expected non-empty artifact/key-link lists. Both pass.
- **Flow:** planner runs revision loop → checker reports counts each cycle → orchestrator compares trajectory → at the iteration-3 boundary, branches diagnosis (STALL vs max-reached) → user chooses force/retry/abandon. Independently, any `verify artifacts`/`verify key-links` call parses 2-space plans correctly.

</expected_outcome>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### CONV-01 (stall-detection)
- `get-shit-done/workflows/plan-phase.md` §12 (Revision Loop, ~lines 693–738) — the loop to augment; `iteration_count`, max-3, escalation options
- `get-shit-done/workflows/plan-phase.md` §10–11 (~lines 641–691) — checker spawn + `## ISSUES FOUND` handling where the count must be captured
- `agents/gsd-plan-checker.md` §structured_returns (~lines 272–301) — the `## ISSUES FOUND` template and the `**Issues:** {X} blocker(s), {Y} warning(s), {Z} info` line that is the count source (also mirror to `.claude/` runtime copy)

### FIX-01 (parser fix)
- `get-shit-done/bin/lib/frontmatter.cjs:163` — `parseMustHavesBlock` (the hardcoded 4/6/8/10 indents to generalize)
- `get-shit-done/bin/lib/verify.cjs` — caller of `parseMustHavesBlock` for `verify artifacts` / `verify key-links`
- `tests/frontmatter.test.cjs`, `tests/verify.test.cjs` — existing test homes for the regression test
- Real fixture exemplar (2-space `must_haves`): `.planning/quick/260507-u0a-consolidate-gsd2-progress-into-single-in/260507-u0a-PLAN.md`

### Project guardrails
- `.planning/PROJECT.md` — Core Value + "minimize the human round-trip" operating principle (CONV-01 is a round-trip-quality change: escalate with a real diagnosis, only when genuinely stuck)
- `.planning/REQUIREMENTS.md` — CONV-01, FIX-01 acceptance text

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Checker `**Issues:**` line** — already-emitted, parseable BLOCKER/WARNING/info counts. CONV-01 consumes this; no agent contract change.
- **Existing escalation options** (Force proceed / Retry / Abandon) — reuse verbatim for the stall branch.
- **`parseVerifyCommands`** (frontmatter.cjs) — reference implementation of a working 2-space-aware parser; FIX-01 can mirror its indent-handling approach but must keep `parseMustHavesBlock`'s own (different) item shape (artifacts/key_links objects vs verify commands).

### Established Patterns
- **Source-then-runtime mirroring** (PATH-TOKEN rule, prior phases): edits to `get-shit-done/` and `agents/` source must be mirrored to the gitignored `.claude/` runtime copy; only source is committed. Applies if any agent/workflow file is touched. `frontmatter.cjs` lives under `get-shit-done/bin/lib/` (committed source); confirm whether a runtime copy exists and mirror if so.
- **Off-by-indent bug class**: Phase 4 already hit this and routed around it. FIX-01 closes it for `parseMustHavesBlock` specifically — generalize, don't re-hardcode.

### Integration Points
- CONV-01: between checker-return handling (step 11) and the revision-loop escalation branch (step 12) — insert count capture on each ISSUES FOUND, and the convergence branch at the escalation boundary.
- FIX-01: `parseMustHavesBlock` is called by `verify.cjs` subcommands; the fix is internal to the parser — callers unchanged.

</code_context>

<specifics>
## Specific Ideas

- STALL DETECTED block should **show the trajectory** ("5 → 5 → 5"), not just declare a stall — the number history is the evidence the user needs to decide force vs retry.
- "Kill the whole class of off-by-indent bugs" (user framing) — FIX-01 is generalize-to-N-space precisely so a future template reflow can't silently resurrect the `[]` failure.

</specifics>

<deferred>
## Deferred Ideas

### Reviewed Todos (not folded)
None reviewed for this phase.

- **Cross-workflow stall persistence (CHECKPOINT file)** — only build if/when planning becomes resumable mid-revision-loop across sessions. User's explicit condition: file-backed state earns its place only when state must survive a workflow boundary. Not the case today.
- **Earlier stall exit (raising `max_iterations` or a 1-cycle threshold)** — rejected for this phase: 1-cycle risks false stalls on a single noisy reshuffle; raising max is scope creep. Revisit only if real runs show the 3-iteration budget is routinely wasted on obvious stalls.

</deferred>

---

*Phase: 05-plan-loop-convergence-and-verify-fix*
*Context gathered: 2026-06-05*
