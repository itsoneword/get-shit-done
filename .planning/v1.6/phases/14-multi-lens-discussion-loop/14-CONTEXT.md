# Phase 14: Multi-Lens Discussion Loop - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning

<domain>
## Phase Boundary

`/gsd2:discuss-loop` judges a concrete artifact through three lenses (Skeptic, User-Advocate, Architect) and either reaches convergence with a verifiable content delta or escalates the top divergent positions to the mailbox — a synthesized average is never produced (LOOP-01, LOOP-02). Phase 14 ships the command + loop machinery only; *wiring* discuss-loop into the overnight runner / autonomous flow is runner territory (Phases 13/15) and explicitly out of scope here.

**Detected domain:** Agentic
**Evidence:** multi-agent judgment loop, lens orchestration via Task() spawns, escalation/mailbox wiring; `agents/` + `workflows/` structure
**Confirmed by user:** yes

</domain>

<established>
## Established Patterns (from codebase + Phases 10–12)

- `GSD_RUN_ID` env var is THE run signal [STRONG, locked Phase 10]
- Ledger is write-once append-only; superseding records, never patch [STRONG, locked Phase 10]
- Interactive/autonomous bifurcation: interactive sessions ask the human directly; only autonomous contexts (`--auto` + `GSD_RUN_ID`) write to the mailbox [STRONG, locked Phases 11/12]
- Escalation contract at `get-shit-done/references/escalation-contract.md`: 4 criteria / 24 conditions / proceed / proceed-and-log / park-and-ask, borderline tie-break = proceed-and-log except irreversibility/security [STRONG, locked Phase 11]
- Mailbox schema (Phase 12) already carries `question`, `options`, `evidence`, `context`, `status` — parked entries are `pending`; `/gsd2:inbox` presents them in one morning session
- `mailbox append/answer/review` are run-context gated (env or explicit run-id arg)
- Orchestrator-level only: loops/spawning live in command + workflow prose; subagents lack Skill/Agent grants
- Source→runtime: edits in `get-shit-done/` and `commands/gsd2/`, synced via `npm run dev`
- No existing skeptic/user-advocate/architect agent definitions; ARCHITECTURE.md has no discussion-loop component — architecturally new

</established>

<decisions>
## Implementation Decisions

### Invocation contexts (LOOP-01/LOOP-02 escalation path)
- Mirrors the locked Phase 11/12 bifurcation exactly: in a run (`GSD_RUN_ID` + autonomous context) non-convergence escalates to the mailbox as a `pending` entry surfacing in `/gsd2:inbox`; interactive sessions present the divergent positions directly to the human in-session, no mailbox write [STRONG — consistency with locked pattern, user confirmed harness-first framing]
- North star (fifth consistent restatement, [STRONG]): discuss-loop is the harness's tool for resolving project-level open questions overnight — converge if the lenses agree, mailbox if they don't, human settles it in the morning inbox

### Lens execution model
- Three parallel fresh-context Task() spawns per round — NOT inline role switches in one context (a single context playing all three roles contaminates judgment; independence is the point of multi-lens) [STRONG, specialist-backed]
- Round 1 is blind (each lens sees only the artifact + question); rounds 2–3 each lens additionally receives all positions from prior rounds
- The orchestrating workflow (command prose) computes convergence between rounds — orchestrator-level, so Task() spawning is allowed
- Whether lenses are new agent definitions vs prompt-only roles on an existing generic agent: planner discretion

### Convergence test (LOOP-02 — "content delta on downstream constraints")
- Each lens returns a structured block: position (accept / reject / modify-with-what) + the downstream constraints it asserts (what later phases/decisions the artifact forces or breaks) [STRONG, specialist-backed — ROADMAP discussion-focus directive: content delta, not sentence similarity]
- Converged when no lens maintains a blocking objection AND round N introduced no new constraints — operationally a diff of the structured constraint sets between rounds, checkable by reading the loop transcript
- Round cap: hard 3, not a config dial in v1.6 [STRONG — ROADMAP research note]

### Converged-output handling
- Convergence produces a judgment (structured verdict + ledger record in run context); when the judgment modifies an existing committed artifact, the modification routes through the existing escalation contract rather than a new confirmation gate: reversible + no criterion fires → apply + proceed-and-log (visible in morning review); irreversibility / security / scope / ambiguity fires → park-and-ask → mailbox confirm (autonomous) or ask the human directly (interactive) [STRONG — user requirement "modifications should be confirmed by the customer or another agent"; specialist-backed routing through locked Phase 11 machinery]
- Judgment-only outcomes and net-new content are logged, not gated

### Non-convergence mailbox entry (LOOP-02)
- Reuses the Phase 12 mailbox schema as-is, no migration: `question` = the open question, `options` = one per surviving lens position (labeled Skeptic / User-Advocate / Architect), `evidence` = constraint-delta summary, `context` = artifact path + rounds run, `status` = `pending` [STRONG, specialist-backed]
- Never a blended/synthesized "average" option — LOOP-02 hard rule [STRONG — REQUIREMENTS verbatim]

### Artifact anchoring (LOOP-01)
- Positional file path argument for any artifact (CONTEXT.md, any doc — whole file) PLUS a `--decision dec-NNN` selector for ledger entries (a ledger record cannot be addressed by path; the selector extracts the record from DECISIONS.jsonl) [WEAK — user: "not critical, easiest option"; selector preferred as more native than long paths]

### Folded Todos
None — matched todos reviewed, none fold into this phase (see Deferred).

### Claude's Discretion
- Lens prompt content and persona definitions; agent-definition vs prompt-only implementation
- Structured position/constraint block exact format; loop transcript location and format
- Convergence-diff implementation details (within the constraint-set-delta structure)
- Command flag surface beyond positional path + `--decision`; output formatting
- Test structure (follows Phase 10–12 unit-test conventions where CLI surface exists)

</decisions>

<expected_outcome>
## Expected Outcome

Same north star as Phases 12/13 ([STRONG], fifth restatement): a self-sufficient agentic pipeline works phases on a project over the long run (overnight), researches everything researchable, raises and SAVES questions instead of blocking, and the human has one meaningful morning discussion; work then continues on what was decided. Phase 14 gives that pipeline its judgment instrument for project-level open questions.

- **End state:** `/gsd2:discuss-loop <artifact-path | --decision dec-NNN>` runs up to 3 rounds of three-lens judgment; convergence yields a structured verdict (and contract-gated application if it modifies an existing artifact); non-convergence lands the top divergent lens positions in the mailbox where `/gsd2:inbox` presents them next morning
- **Success signal:** a converged run shows a verifiable round-over-round constraint delta in its transcript; a non-converged run produces a mailbox entry with distinct labeled lens positions (never an average); interactive runs without `GSD_RUN_ID` never touch the mailbox
- **Flow:** harness (or human) invokes discuss-loop on an artifact → 3 lenses judge in parallel, fresh contexts → orchestrator diffs constraint sets per round → converged: verdict + ledger (+ contract-gated apply) | diverged after 3 rounds: top positions → mailbox → morning inbox discussion → decision recorded

</expected_outcome>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Escalation + verdict machinery (converged-output gating, non-convergence escalation)
- `get-shit-done/references/escalation-contract.md` — 4 criteria / 24 discrete conditions / 3-tier verdicts + tie-break rules; converged modifications route through this
- `.planning/v1.6/phases/11-escalation-contract-discuss-phase-wiring/11-CONTEXT.md` — locked escalation posture decisions

### Mailbox + parking (escalation target, inbox presentation)
- `get-shit-done/bin/lib/mailbox.cjs` — schema (`question`/`options`/`evidence`/`context`/`status`), run-context gate, append/answer/review
- `.planning/v1.6/phases/12-park-don-t-block-mailbox/12-CONTEXT.md` — locked parking/inbox decisions incl. interactive/autonomous bifurcation
- `get-shit-done/workflows/inbox.md` — how pending entries are presented in the morning session

### Ledger (verdict recording, --decision anchoring)
- `get-shit-done/bin/lib/ledger.cjs` — write-once append-only DECISIONS.jsonl, dec-NNN ids, run-context gate

### Phase definition
- `.planning/ROADMAP.md` §Phase 14 — goal, LOOP-01/LOOP-02, discussion focus
- `.planning/REQUIREMENTS.md` §Discussion Loop — LOOP-01, LOOP-02 verbatim

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mailbox.cjs` append (run-gated, q-NNN ids): non-convergence escalation writes through it unchanged
- `ledger.cjs` append: converged verdict recording in run context; dec-NNN records are the `--decision` anchor source
- `escalation-contract.md` + the Phase 11 inline-evaluator prose in `discuss-phase.md` question_triage: the membership-check pattern to reuse for gating converged modifications
- `/gsd2:inbox` (Phase 12): already presents `pending` mailbox entries with options/evidence — lens positions will render there with zero inbox changes

### Established Patterns
- Thin-skill pattern (command stub in `commands/gsd2/` → workflow prose in `get-shit-done/workflows/`) — discuss-loop follows it
- Orchestrator-level spawning only: the loop lives in workflow prose executed by the main session, lenses are Task() spawns
- Module pattern for any CLI surface: pure functions + cmd* handlers + thin dispatch (Phases 10/12)

### Integration Points
- Mailbox: non-convergence writes `pending` entries (autonomous context only)
- Ledger: converged verdicts append decision records (run context only)
- Escalation contract: converged-modification gating
- `/gsd2:inbox`: presentation surface for escalated divergent positions (no changes expected)

</code_context>

<specifics>
## Specific Ideas

- "Confirmed by the customer or another agent" for modifications to existing parts — satisfied via escalation-contract routing rather than a dedicated always-confirm gate
- `--decision dec-NNN` "looks more native" than passing long file paths for ledger anchoring

</specifics>

<deferred>
## Deferred Ideas

### Reviewed Todos (not folded)
- "Add user sync checkpoints to plan-phase subagent chains" — plan-phase concern, not discuss-loop
- "Update command should sync project-local hooks" — tooling concern, unrelated

### Other
- Autonomous invocation wiring (what calls discuss-loop during overnight runs) — runner/resume territory, Phases 13/15
- Configurable round cap — explicitly fixed at 3 for v1.6

</deferred>

---

*Phase: 14-multi-lens-discussion-loop*
*Context gathered: 2026-06-12*
