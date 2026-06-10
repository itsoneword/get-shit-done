# Pitfalls Research: Autonomous Supervision Harness (GSD v1.6)

**Domain:** Adding autonomous long-horizon supervision to an existing HITL (human-in-the-loop) dev framework (GSD / Claude Code)
**Researched:** 2026-06-10
**Confidence:** HIGH — drawn from direct codebase reading, first-party GSD architectural decisions, documented failure modes from parallel-session work, and cross-phase notes recording what broke during v1.5

---

## Critical Pitfalls

### 1. Escalation Miscalibration — Over-escalating Trivia While Under-escalating Critical Decisions

**What goes wrong:**
The escalation evaluator fires on everything vaguely uncertain (file naming, comment style, test coverage percentage) and the human inbox fills with noise. After three ignored trivia questions the human stops reading the mailbox. Meanwhile a scope-changing architectural decision that meets no written criterion gets auto-resolved silently. The harness becomes untrustworthy in both directions simultaneously.

**Why it happens:**
Escalation criteria are written as prose principles ("irreversible", "security-touching", "scope change") but evaluated by an LLM that interprets them differently on each run. A task that touches a security-adjacent file gets flagged even if the change is a comment. A decision that modifies the fundamental phase structure passes because no criterion literally says "phase structure change". Without a verdict schema with discrete, testable thresholds, calibration drifts.

**How to avoid:**
- Write escalation criteria as a verdict schema with explicit thresholds: `irreversibility: [ "file deletion", "schema migration", "published API change" ]` — not prose.
- Separate `proceed` (no log needed), `proceed-and-log` (log but don't ask), and `park-and-ask` (block branch, queue question). The three-tier schema forces the evaluator to pick a lane.
- Calibrate against a golden set: at least 10 annotated decisions (5 should-escalate, 5 should-not) before wiring into overnight runs. Measure precision/recall against the golden set after each schema change.
- Wire the ledger first, run it interactively for one full phase, read every verdict. Escalation miscalibration is invisible until the ledger exists.

**Warning signs:**
- Human inbox has more than 2-3 parked questions per phase on average.
- Any question in the inbox reads like "what file should I name this?" or "which of these two identical approaches should I pick?"
- Zero questions in the inbox after a phase with genuine scope ambiguity.

**Phase to address:** Decision Ledger phase (Phase 1) — the ledger must exist and be read before the escalation evaluator is wired. Escalation Contract phase (Phase 2) calibrates against ledger data.

---

### 2. Deliberation Drift — Multi-Lens Discussion Generates Plausible Documents Without Converging

**What goes wrong:**
The skeptic, user-advocate, and architect lenses each produce well-reasoned positions. The synthesis step picks the most balanced-sounding answer. The "decision" is a document that looks resolved but is actually the average of three different recommendations — each reasonable in isolation, none correct for the specific constraints. Downstream agents plan against this pseudo-decision and produce plans with internal contradictions.

**Why it happens:**
Multi-agent deliberation without a convergence test produces averaging behavior. The convergence brake that declares the loop "done" fires on sentence similarity ("all three agree on X") rather than on logical consistency ("all three answers imply the same downstream constraints"). A 3-lens loop that runs `max_iterations` and emits the last round's synthesis looks identical to a loop that genuinely converged — both produce a `DECISION:` line.

**This is the GSD-specific version of the general problem:** v1.5 Phase 5 already built stall-detection for the plan revision loop (non-decreasing BLOCKER+WARNING counts). The discussion loop needs an analogous brake, but the signal is harder: you cannot count BLOCKERs in a discussion artifact; you must detect whether new iterations are changing the decision-relevant content.

**How to avoid:**
- The convergence brake must operate on content delta, not iteration count. Test: does round N's synthesis materially change the downstream constraints implied by round N-1? If the delta is cosmetic (word order, hedging), declare convergence. If the delta changes a constraint ("should be synchronous" → "can be async"), run another round.
- The loop must produce a concrete artifact before calling for deliberation — a proposal or design sketch, not an open question. Lenses judge the artifact, not each other's positions.
- Cap the loop at 3 iterations with hard cutoff. If no convergence: escalate to human with the top-2 divergent positions, not a synthesized average. The human choice is then the convergence mechanism.
- The convergence check must be a distinct step, not implicit in the last round's synthesis. The loop cannot evaluate its own convergence — that is the same failure mode.

**Warning signs:**
- Discussion loop artifacts that contain the word "balancing" or "trade-off" but no specific chosen value.
- Downstream plans that re-open a question already addressed by the discussion loop.
- Discussion loop runs all 3 iterations every time (never exits early on convergence).

**Phase to address:** Artifact-Anchored Discussion Loop phase. Convergence brake is the load-bearing acceptance criterion.

---

### 3. Overnight Token Burn on Stuck Loops

**What goes wrong:**
The overnight runner starts a phase, hits a case the resolution loop cannot resolve (LOW confidence after max iterations, or a file that cannot be found), and retries the same step in a sleep-poll pattern. By morning the run has consumed 50k+ tokens on identical attempts, the phase is not done, and the ledger has 40 identical `escalated: true` entries for the same question.

**Why it happens:**
The current GSD autonomous workflow (`workflows/autonomous.md`) already has a `handle_blocker` step with a 1-retry gap-closure limit ("WHY: prevents infinite loops"). The overnight runner wraps this, but if the blocker detection path misclassifies a stuck state as a non-fatal gap (returns `gaps_found` instead of triggering `handle_blocker`), the 1-retry limit never fires. The gap-closure path retries once, reports partial progress, the outer loop sees `incomplete` status, and re-runs the full phase.

**How to avoid:**
- Treat identical-ledger-hash as a stuck signal. If two consecutive `DECISIONS.jsonl` snapshots for the same phase share the same hash on the unresolved-questions subset, the runner must park the branch and move on — not retry.
- The park-don't-block mechanism must fire at the runner level, not just inside the escalation evaluator. The runner cannot rely on the evaluator to detect its own spinning.
- Per-phase token budget with hard ceiling. If a phase consumes more than N tokens without a commit, the runner parks it automatically.
- The existing `handle_blocker` 1-retry limit in `autonomous.md` must be preserved when the overnight runner wraps it. Do not re-implement the retry logic — extend the existing one.

**Warning signs:**
- DECISIONS.jsonl file for a phase exceeding 20 entries without any `escalated: false` entries in between.
- `agent-trace.jsonl` showing 10+ spawns of the same agent type against the same phase without a phase-complete commit.
- Runner process still running after 8 hours with no new commits.

**Phase to address:** Overnight Runner phase (and Park-Don't-Block phase which supplies the parking primitive).

---

### 4. Parked Branch Resume Corruption

**What goes wrong:**
A branch is parked mid-phase with unresolved questions in the mailbox. The human answers the questions. The runner resumes the branch against a stale phase state — either the planning context changed (another phase completed and updated cross-phase-notes), or the parked branch diverged from main (worktree fell behind). The resumed run produces plans based on decisions that were correct at park time but wrong now.

**Why it happens:**
GSD phase planning is context-dependent: discuss-phase reads `cross-phase-notes.md`, prior CONTEXT.md decisions, and current ROADMAP.md state. A branch parked mid-discuss will resume with the same stale reads unless the resume path explicitly re-reads these files. This is not hypothetical — v1.5 Phase 7 found that even the worktree symmetry-check (07-03) must run post-merge to detect drift; the same drift problem applies to a resumed branch.

**How to avoid:**
- Resume path must re-read `cross-phase-notes.md`, `STATE.md`, and `ROADMAP.md` before replaying any parked questions. The human answers land in the mailbox against old context; the runner must re-evaluate whether those answers still make sense against current state.
- Detect worktree divergence before resuming: `git log --oneline HEAD..origin/main` — if main has new commits, the runner must merge or warn before continuing.
- Park files must capture a context snapshot (the relevant ROADMAP.md state, the prior CONTEXT.md decisions read) so the resume path can detect staleness by diff, not by re-reading everything.
- The resume path is separate code from the initial run path. Do not merge them — the invariants are different.

**Warning signs:**
- Resume produces a CONTEXT.md that contradicts a decision from a recently completed phase.
- A resumed run re-asks a question the user answered in the mailbox.
- DECISIONS.jsonl entries after resume reference state (file names, module names) that no longer exist in the codebase.

**Phase to address:** Park-Don't-Block phase — the park artifact must include a context snapshot for resume validation.

---

### 5. Orchestrator-Level vs Subagent Tool Grant Confusion

**What goes wrong:**
The supervisor is implemented as a spawned subagent (Task/Agent call) rather than as orchestrator-level code. It attempts to call `Skill(...)`, spawn other agents, or read the decision ledger with `Agent(...)`. These calls silently degrade: `Skill` is not in the subagent's grants, `Agent` is not in the subagent's grants. The supervisor appears to run successfully (no error) but its actual behavior is a stripped-down inline fallback that makes no decisions and writes no ledger entries.

**Why it happens:**
GSD's architecture already documents this trap: subagents (`gsd-planner`, `gsd-phase-researcher`) have restricted tool grants — no `Skill`, no `Agent/Task`. This constraint was discovered during v1.5 Phase 2 when the resolution loop was initially designed to run inside `gsd-planner` and then had to be moved to orchestrator level. The supervisor/runner faces the same constraint: it needs `Task` (to spawn phases), it needs to call skills, it needs full tool access — all of which require orchestrator level.

**The GSD-specific constraint from PROJECT.md:** "GSD subagents lack Skill/Agent tool grants — the supervisor/runner must execute at orchestrator level (top-level session or headless run), never as a spawned subagent."

**How to avoid:**
- The overnight runner lives in a workflow file (`.md`) loaded at orchestrator level, not in an agent file. The rule: if the code needs `Task` or `Skill`, it is orchestrator code.
- Write a negative test: verify the runner workflow does NOT contain a `Task(gsd-supervisor` spawn. If supervision is being done by a spawned agent, it's in the wrong place.
- Headless/cron runs need a way to start a top-level Claude Code session, not spawn an agent. The mechanism for this (Claude Code headless invocation, `claude -p`, or a wrapper script) must be validated before building the runner logic. If the invocation mechanism cannot grant full tools, the runner cannot run.
- The ledger writer must also be at orchestrator level or wired through `gsd-tools.cjs` (which runs as a bash subprocess and can always write files regardless of agent context).

**Warning signs:**
- Supervisor agent file appears in `agents/` directory rather than `workflows/` directory.
- Runner produces no DECISIONS.jsonl entries despite "completing" a phase.
- `agent-trace.jsonl` shows no runner-type spawns for a phase that the runner claims it ran.

**Phase to address:** Decision Ledger phase (the ledger writer must be tested at the correct level) and Overnight Runner phase (runner invocation mechanism validated before any other runner logic is built).

---

### 6. Trust Erosion from Silent Discards and Unverifiable Decisions

**What goes wrong:**
The harness makes a decision, it does not meet the `park-and-ask` threshold, it logs a `proceed-and-log` entry. Over time the human notices that several decisions in the ledger were wrong, but cannot tell whether the wrongness was a bad model decision or a bad criterion — the ledger entry shows only "confidence: HIGH" and the recommendation, not the full reasoning chain. The human stops trusting the ledger and goes back to watching agent tabs directly, defeating the purpose.

**Why it happens:**
Decision quality audit requires being able to replay the reasoning, not just the conclusion. A ledger entry that says "chose approach A (confidence: HIGH)" is unverifiable: was HIGH confidence correct? Was the evidence cited? Were alternatives considered and dismissed? GSD's PROJECT.md states: "every autonomous decision must be auditable from the ledger alone, without replaying transcripts." This requirement is the exact failure condition — a ledger that technically has entries but lacks the evidence and alternatives fields is not auditable.

**How to avoid:**
- Ledger schema must be enforced at write time. Required fields: `recommendation`, `alternatives_considered[]`, `evidence[]`, `confidence`, `escalated`, and `reasoning_summary`. An entry missing any of these is a schema violation — the writer rejects it.
- The first ledger review (after Phase 1) is a manual audit: does the reasoning in each entry actually justify the confidence verdict? If HIGH-confidence entries have thin evidence, the calibration is wrong before the escalation evaluator is ever built.
- Make the audit workflow a first-class command, not a post-hoc thought. The "review inbox" command (`park-and-ask` answers) should also surface the last N `proceed-and-log` entries for spot-check, not just the parked questions.
- Never allow a `proceed` (no-log) verdict for decisions in irreversibility categories — those must always be at least `proceed-and-log`.

**Warning signs:**
- Ledger entries with empty or single-word `reasoning_summary` fields.
- Multiple consecutive `escalated: false` verdicts on decisions that the human, on manual review, would have escalated.
- Human manually reviewing agent tabs during a run that the harness was supposed to be supervising.

**Phase to address:** Decision Ledger phase — schema and write-time enforcement are the prerequisite. Escalation Contract phase — calibration audit uses the ledger data.

---

### 7. Parallel Worktree Merge Conflicts from Concurrent Supervisor and Human Sessions

**What goes wrong:**
The overnight runner is executing Phase N in a worktree. The human, seeing the run in progress, makes a quick fix in the main working tree that touches a file the runner's phase also modifies. The worktree merge (07-01 machinery) surfaces a conflict — but since the runner is headless, there is no one to resolve it. The runner parks the conflict and continues other phases, but the parked-conflict branch sits unresolved indefinitely because it never appeared in the mailbox.

**Why it happens:**
The v1.5 Phase 7 worktree machinery (`cmdWorktreeMerge`) exits 0 on conflict — conflict is a detected state, not a command error. The `07-06` wire in `execute-phase` is designed to detect `clean: false` and pause for human review. But the overnight runner, wrapping `execute-phase`, must also handle this case — it cannot silently continue if the merge conflict is in a file that invalidates the phase's correctness.

**How to avoid:**
- Merge-conflict detection in the runner must distinguish between: (a) conflict in `.planning/` files (planning artifacts — serious, park the phase), (b) conflict in source files (code — serious, park the phase), and (c) conflict in generated/ephemeral files (usually resolvable automatically).
- The park-and-ask mailbox must include merge-conflict entries, not just escalation-evaluator questions. A mailbox that only contains deliberation questions gives the human no signal that a worktree conflict is blocking a branch.
- The runner must not start a new phase in the same worktree as a conflicted phase. Worktrees are per-phase; a conflict in Phase N's worktree does not block Phase M's worktree.
- For the GSD-specific constraint: parallel *execution* requires worktree isolation (Phase 7 machinery); parallel *planning* writes only `.planning/` and is safe — but if the runner does planning in the main tree and execution in a worktree, the conflict zone changes. Document this boundary clearly.

**Warning signs:**
- `git worktree list` shows worktrees that have been idle for hours without a merge or prune.
- DECISIONS.jsonl for a phase stops mid-phase with no `phase_complete` entry.
- Human finds uncommitted conflict markers in source files after a runner run.

**Phase to address:** Overnight Runner phase — the runner must handle the `clean: false` merge case explicitly as a mailbox-parkable event.

---

### 8. Headless Permission Failures and Auth Token Expiry

**What goes wrong:**
The overnight runner starts via cron or a background process. By 3am, the Claude Code session has expired or the API key rotation has invalidated the token. The runner silently produces no output — no errors in the ledger, no entries in `agent-trace.jsonl`, no commits. In the morning the human sees the runner "completed" with zero phases actually done.

**Why it happens:**
GSD hooks already handle silent failures: hook scripts exit 0 silently rather than reporting errors ("hook failure never interrupts the agent run"). This is correct for advisory hooks but wrong for the runner's health check. If the headless session cannot authenticate, it should write a visible failure to the mailbox or ledger, not exit 0 silently.

**How to avoid:**
- The runner must include a startup health check before any phase work: can it spawn a trivial subagent? Can it write a test entry to DECISIONS.jsonl? If either fails, the run is aborted with a failure entry in a persistent log — not silent exit 0.
- Session token lifespan must be tested before building the runner. The specific Claude Code mechanism for long-running headless sessions is an empirical unknown — this needs a Wave-0 investigation (mirrors how Phase 4 used Wave-0 to validate hook API fields before building the scraper).
- Runner log must be separate from DECISIONS.jsonl. The ledger records decisions; a `run.log` records runner health (start time, phases attempted, exit reason). Even a failed run should leave a `run.log` entry.
- For API key rotation: the runner must fail loudly on auth errors, not treat them as retryable transient failures.

**Warning signs:**
- DECISIONS.jsonl is empty after a scheduled run.
- `agent-trace.jsonl` has no entries from the expected run window.
- No new commits in the run window despite the runner "succeeding."

**Phase to address:** Overnight Runner phase — startup health check and failure logging are Wave-0 prerequisites before any scheduling logic is built.

---

### 9. Triage Worker Disposing Instead of Proposing

**What goes wrong:**
The todo/backlog triage worker is built with a `dispose` verdict — it marks todos as obsolete and removes them from the list. On a run where the worker misclassifies a still-relevant backlog item as "already-done" or "obsolete," the item is silently dropped. No human review, no audit trail. The item reappears as a problem in a future milestone because it was never actually addressed.

**Why it happens:**
"Triage worker emits proposals, never disposes" is stated in PROJECT.md as a hard constraint. But the implementation path of least resistance is to have the worker write verdicts directly to the backlog file — it knows the verdict, it has Write access, and proposing-without-applying requires an extra round-trip through the mailbox. The shortcut is tempting and breaks the contract.

**How to avoid:**
- The triage worker's Write access must be scoped to the mailbox file only, not to the backlog or todo files. This is an architectural boundary: the worker proposes, the human or a separate ratify step disposes. If the worker needs to modify the backlog directly, the architecture is wrong.
- Triage verdicts in the mailbox must be reviewable in bulk — not one-at-a-time. A session with 20 backlog items that generates 20 individual mailbox entries defeats the inbox-consolidation purpose.
- `already-done` and `obsolete` verdicts require stronger evidence than `fold-into-phase` or `defer`. The ledger entry for a disposal proposal must cite the commit or requirement that made the item obsolete.
- The ratify step for triage verdicts should be a batch review, not a per-item decision — the human reviews the proposed triage in one pass and approves/rejects categories.

**Warning signs:**
- Backlog shrinks significantly after a triage run with no corresponding human inbox review.
- A backlog item that disappeared is mentioned in a future milestone discussion as if it had never been addressed.
- Triage worker DECISIONS.jsonl entries for `obsolete` verdicts with thin evidence fields.

**Phase to address:** Todo/Backlog Triage Worker phase — scope Write access to mailbox-only, not backlog files, as the first design decision.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Prose escalation criteria ("flag irreversible things") | Fast to write | LLM interprets inconsistently; cannot be unit-tested | Never — use a discrete criterion schema from day one |
| Runner retries indefinitely rather than parking | Fewer stuck runs in the short term | Overnight token burn; ledger flooding with duplicates | Never for overnight runs; acceptable for single-phase interactive runs with a 2-retry hard cap |
| Single DECISIONS.jsonl for all phases | Simpler write path | Merge conflicts when parallel phases write simultaneously; makes per-phase audit harder | Never for parallel runs; acceptable for strictly serial single-phase runs |
| Discussion loop synthesis without convergence test | Loop always terminates | Produces plausible-but-wrong averaged decisions that planners treat as locked | Never — the convergence test IS the value of the loop |
| Triage worker writes directly to backlog | One step fewer | Silent discards; no audit trail | Never — the propose-not-dispose principle is load-bearing for trust |
| Runner starts phases without worktree isolation | Simpler for the planning-only phases | Background planning writes to `.planning/` shared with active human session; planning artifact corruption on race | Acceptable for planning-only phases (safe per PROJECT.md constraint); never for execution phases |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `autonomous.md` wrapper | Reimplementing the `handle_blocker` / gap-closure retry logic inside the runner | Extend `autonomous.md`'s existing blocker handling — it already has a 1-retry ceiling. The runner adds park-to-mailbox as a new path, not a replacement retry |
| `gsd-tools.cjs` DECISIONS.jsonl writer | Using `output()` (which calls `process.exit(0)`) from library code that the runner calls in-process | Use the append-JSONL pattern from `lesson.cjs` (no `output()`, direct fs write), not the standard command pattern — the exit-in-library problem is documented in CONCERNS.md |
| `agent-trace.jsonl` (Phase 4 telemetry) | Scraping runner health from telemetry | Telemetry is a correlation tool, not a health monitor. Write a separate `run.log` for runner operational status; keep `agent-trace.jsonl` for agent-spawn correlation |
| Worktree merge (`cmdWorktreeMerge`) | Treating `clean: false` as a fatal error in the runner | `cmdWorktreeMerge` exits 0 on conflict — it's a detected state. The runner must JSON-parse the result and route `clean: false` to the park-and-ask mailbox, matching the 07-06 pattern |
| Escalation evaluator reading DECISIONS.jsonl | Spawning the evaluator inside a GSD subagent (gsd-planner, gsd-verifier) | The evaluator needs to read the ledger file and potentially spawn research — orchestrator-level only. The tool-grant constraint is the same as the resolution loop (v1.5 Phase 2 finding) |
| Headless Claude Code invocation | Assuming `Skill(...)` is available in a cron-triggered headless session | `deep-research` and other native harness skills are only available in interactive sessions. The runner must use `gsd-phase-researcher` full mode (portable heavy path) and not rely on `Skill(...)` |
| Park-and-ask mailbox file | Writing one mailbox file per question | Batch into a per-run mailbox file. One file per run with an array of parked questions is reviewable in one pass; N individual files fragment the inbox |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Discussion loop without an early-exit on convergence | Every discussion takes exactly `max_iterations` turns regardless of complexity | Convergence test after each round; exit early when content delta is cosmetic | At 3+ lenses × 3 iterations; the cost is O(lenses × iterations) subagent spawns per question |
| DECISIONS.jsonl append without size guard | File grows unbounded across multiple runs; agents that read the ledger context-blow | Prune entries older than current run from the active read window; archive prior runs to `DECISIONS-{date}.jsonl` | After 50+ run entries; ledger becomes too large for a single agent context read |
| Overnight runner checking phase status via full roadmap re-parse per loop | Slow startup on every phase iteration | Use `gsd-tools roadmap analyze` (existing, already fast) and cache result for the run; re-read only after a commit | After 10+ phases; the re-parse cost is O(phases) per check |
| Parallel worktrees writing to shared `agent-trace.jsonl` | Interleaved JSONL entries from concurrent phases; corrupted reads | Per-run trace file (`agent-trace-{run-id}.jsonl`) merged at run end, or row-level locking (append is atomic on most filesystems for small writes) | At 3+ parallel phases writing simultaneously |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Mailbox file world-readable in a shared environment | Another agent or session reads and responds to parked questions before the human does | Mailbox lives in `.planning/` which is gitignored; in shared envs, file permissions should be 600 |
| Escalation evaluator with Write access to source files | An incorrectly classified `proceed` decision causes the evaluator to make destructive changes with no human review | The evaluator produces verdicts only — it writes to DECISIONS.jsonl and the mailbox, never to source or planning artifacts |
| Runner re-using a stale API key from a cron environment file | Runner authenticates successfully for hours then silently fails at key expiry with no error | Startup health check must test actual agent spawn (not just key presence); run immediately before first phase, not at cron-schedule time |
| Decision ledger in a committed file | Autonomous decisions (including wrong ones) permanently in git history, potentially leaking architectural choices or failed experiments | DECISIONS.jsonl should be gitignored (like `agent-trace.jsonl`); only the ratified summary (human-reviewed decisions) is committed |

---

## "Looks Done But Isn't" Checklist

- [ ] **Decision ledger:** Entries present but `alternatives_considered` and `evidence` fields are empty arrays — verify schema enforcement at write time, not just at read time
- [ ] **Escalation evaluator:** Returns verdicts but `proceed` and `proceed-and-log` are never emitted — evaluator may be defaulting to `park-and-ask` for everything; check calibration against the golden set
- [ ] **Park-don't-block mailbox:** Parked questions appear in mailbox but the runner continues the same branch (not parking) — verify that `park` actually creates a checkpoint and stops phase execution on that branch
- [ ] **Overnight runner:** Runner "completes" with zero new commits — check for silent auth failures in `run.log`; DECISIONS.jsonl should have entries even for phases with all-`proceed` verdicts
- [ ] **Discussion loop:** Loop terminates in 1 iteration for every question — convergence test may be triggering immediately; verify that early-exit is gated on actual content-delta check, not a trivially-true condition
- [ ] **Triage worker:** Backlog item count drops after a triage run with no inbox activity — worker is writing directly to backlog, not proposing; check Write access scope

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Escalation miscalibration found post-overnight-run | MEDIUM | Read DECISIONS.jsonl, identify miscalibrated entries, update criterion schema, re-run the affected phase from the parked-branch checkpoint |
| Discussion loop produced averaged non-decision | MEDIUM | Identify the concrete artifact the loop judged; manually choose one of the divergent positions from round N; update CONTEXT.md with that choice tagged `[STRONG, human-override]` |
| Overnight token burn on stuck loop | LOW (no data lost) | Kill the runner; check DECISIONS.jsonl for the repeated-question pattern; add the stuck question to `park-and-ask` criteria list; resume with `--from N` |
| Parked branch resumed against stale context | HIGH | Diff the resumed CONTEXT.md against current cross-phase-notes; identify contradictions; re-discuss the affected decisions; re-plan the phase |
| Silent auth failure overnight | LOW | Check `run.log` for failure entry; re-authenticate; re-run with `--from N` |
| Triage worker silently disposed a relevant item | HIGH | `git log -- .planning/todos/` to find deletion commit; `git show <commit>` to recover content; re-add to backlog; audit triage worker Write access scope |
| Worktree merge conflict left unresolved | MEDIUM | `git worktree list` to find blocked worktrees; resolve conflict manually; confirm with `gsd-tools health --repair`; add conflict-type to mailbox routing |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Escalation miscalibration | Phase 2 (Escalation Contract) — golden-set calibration | Golden set precision/recall test; interactive run of 1 phase with ledger review before overnight |
| Deliberation drift without convergence | Discussion Loop phase — convergence brake acceptance criterion | Loop exits in <3 iterations on a test question with an obvious answer; escalates on a genuinely ambiguous one |
| Overnight token burn on stuck loop | Phase 3 (Park-Don't-Block) supplies parking; Overnight Runner phase adds runner-level stuck detection | Identical-ledger-hash detection test; per-phase token ceiling enforced in runner |
| Parked branch resume corruption | Phase 3 (Park-Don't-Block) — park artifact includes context snapshot | Resume test: park mid-phase, advance main, resume; verify CONTEXT.md re-reads current state |
| Orchestrator vs subagent tool grant confusion | Phase 1 (Decision Ledger) — verify ledger writer is orchestrator-level | Negative test: runner workflow file does NOT spawn a `gsd-supervisor` agent; ledger entries appear during interactive test |
| Trust erosion from unverifiable decisions | Phase 1 (Decision Ledger) — schema enforcement | Schema validation test rejects entries with empty `evidence[]`; manual audit of first-phase ledger |
| Parallel worktree merge conflicts | Overnight Runner phase — `clean: false` routes to mailbox | Test: simulate merge conflict in runner worktree; verify mailbox entry appears and phase parks |
| Headless permission failures | Overnight Runner phase — Wave-0 health-check investigation | Health-check startup test; `run.log` present even on auth failure |
| Triage worker disposing instead of proposing | Triage Worker phase — Write access scoped to mailbox only | Test: worker run with no human inbox interaction; verify backlog file unchanged |

---

## Sources

Evidence for these pitfalls is drawn from:

- **Direct codebase reading** (HIGH confidence): `workflows/autonomous.md` (existing blocker/retry patterns), `get-shit-done/bin/lib/core.cjs` (output()/exit-in-library, isGitIgnored execSync, fragile extractCurrentMilestone), CONCERNS.md (full tech-debt and fragile-area analysis), ARCHITECTURE.md (tool grant constraints, worktree isolation findings)
- **GSD v1.5 cross-phase notes** (HIGH confidence): Phase 2 resolution-loop tool-grant discovery (orchestrator-only constraint), Phase 5 stall-detection as prior art for convergence brakes, Phase 7 worktree `cmdWorktreeMerge exits 0 on conflict` (load-bearing detail for runner conflict handling), Phase 9 propose-not-auto-apply principle (ratify gate as trust mechanism)
- **PROJECT.md v1.6 constraints** (HIGH confidence): "harness proposes, never disposes", "orchestrator level only", "auditable from ledger alone without replaying transcripts", "working tree sharing means background execution requires worktree isolation"
- **GSD memory: gsd2-subagent-tool-grants.md** (HIGH confidence): confirmed that gsd-planner has no Task/Skill grants; orchestrator-level placement is a hard constraint, not a preference
- **GSD memory: gsd2-parallel-session-tree.md** (HIGH confidence): confirmed single shared working tree as the current state; worktree isolation is the structural fix
- **GSD Phase 4 empirical pattern** (HIGH confidence): Wave-0 empirical investigation before building a hook that depends on undocumented API behavior — applicable to headless auth (also undocumented behavior that must be tested before building against it)
- **Training data on long-horizon agent failure modes** (MEDIUM confidence — flagged as potentially stale): Devin/OpenHands/AutoGen practitioner reports documenting: context-window depletion causing loop reruns, agent drift toward plausible-document generation in multi-agent deliberation, token burn on stuck loops, and the specific problem of multi-agent synthesis averaging rather than converging. These are corroborated by GSD's own documented failure modes in CONCERNS.md and cross-phase-notes — the GSD-specific evidence is HIGH confidence and makes the training-data claims verifiable by analogy.

---

*Pitfalls research for: Autonomous Supervision Harness (GSD v1.6)*
*Researched: 2026-06-10*
