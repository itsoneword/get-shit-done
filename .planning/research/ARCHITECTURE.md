# Architecture Patterns: Autonomous Supervision Harness Integration
**Domain:** GSD framework extension — v1.6 milestone
**Analysis Date:** 2026-06-10
**Confidence:** HIGH (based on direct inspection of all existing source files)

---

## What This Document Covers

Six new components need to integrate into the existing GSD architecture:

1. **Decision ledger** — `DECISIONS.jsonl` per run, wired into `discuss-phase --auto`
2. **Escalation evaluator** — verdict schema (proceed / proceed-and-log / park-and-ask)
3. **Park-don't-block mailbox** — `.planning/run/` layout, inbox review command
4. **Overnight runner** — wraps `/gsd2:autonomous` with ledger + escalation + worktree isolation
5. **Multi-lens discussion loop** — skeptic/user-advocate/architect judging of artifacts with convergence brake
6. **Todo/backlog triage worker** — proposals emitted into the same mailbox

The central constraint throughout: **subagents lack Skill and Agent tool grants**. Every component that needs to spawn a skill or another agent must execute at the orchestrator level (top-level session or headless `claude -p`).

---

## Existing Architecture Anchor Points

Before mapping integration points, the existing pieces that matter for v1.6:

```
get-shit-done/
  workflows/
    discuss-phase.md      -- has --auto mode and question_triage
    autonomous.md         -- existing multi-phase runner (discuss→plan→execute per phase)
    plan-phase.md         -- spawns gsd-planner subagent
    execute-phase.md      -- spawns gsd-executor subagent
  bin/
    gsd-tools.cjs         -- CLI router (dependency-free Node CJS)
    lib/
      lesson.cjs          -- JSONL ledger pattern (append/list/filter/update)
      trace.cjs           -- JSONL telemetry read/write pattern
      worktree.cjs        -- worktree add/merge/remove/prune
      parallel-gate.cjs   -- axis-A/B safety gate
      state.cjs           -- STATE.md read/write
  hooks/
    gsd2-agent-trace.js   -- PostToolUse hook writes to .planning/telemetry/agent-trace.jsonl

.planning/
  telemetry/
    agent-trace.jsonl     -- existing per-event JSONL telemetry
  lessons/
    lessons.jsonl         -- existing per-lesson JSONL ledger (v1.5 Phase 9)
  STATE.md                -- frontmatter + sections (decisions, blockers)
  ROADMAP.md              -- source of truth for phase status
```

---

## Component 1: Decision Ledger

### Where it lives

`.planning/run/{run-id}/DECISIONS.jsonl` — one file per run (not one global file). Run IDs are timestamps or GSD-generated slugs so concurrent runs stay isolated. The ledger is **append-only during a run**; it becomes read-only when the run completes.

### Schema (one JSON line per decision)

```json
{
  "id": "dec-001",
  "ts": "2026-06-10T02:15:00.000Z",
  "phase": 3,
  "context": "discuss-phase --auto: question_triage TECHNICAL",
  "question": "Should rate-limiting use sliding window or fixed bucket?",
  "decision": "sliding window",
  "alternatives": ["fixed bucket", "token bucket"],
  "evidence": "Context7 redis-rate-limit docs; 2x blog posts prefer sliding for API fairness",
  "confidence": "HIGH",
  "escalated": false,
  "escalation_verdict": null,
  "escalation_reason": null
}
```

The `escalated` + `escalation_verdict` + `escalation_reason` fields are written by the evaluator after the initial decision is logged. A decision is logged first (with `escalated: null`), then the evaluator updates in place (or appends a patching record — see Pitfall below).

### How it hooks into `discuss-phase --auto`

The `--auto` path in `discuss-phase.md` already uses `question_triage` for TECHNICAL/HYBRID questions. The integration point is the write-back step where resolved technical decisions are appended to CONTEXT.md (`<!-- resolved inline by resolution loop -->`). The ledger write happens **at the same moment** — after the resolution loop settles a confidence verdict:

```
question_triage → resolution loop reaches HIGH/MEDIUM
    → existing: write to CONTEXT.md with [STRONG/WEAK, specialist-backed]
    → NEW: append to DECISIONS.jsonl: {id, ts, phase, context, question, decision, alternatives, evidence, confidence, escalated: null}
    → NEW: evaluator step (inline, not a subagent) sets escalated: true/false + verdict
    → if escalated: append question to .planning/run/{run-id}/MAILBOX.jsonl
```

The evaluator runs **inline in the discuss-phase orchestrator**, not as a spawned subagent. This is the critical constraint: the evaluator needs to call `Skill()` if it wants to park a phase and continue another — that's an orchestrator-only capability.

### gsd-tools subcommand

Add `ledger` to `gsd-tools.cjs`:

```
ledger append <run-id> --data '{json}'   Append one decision record
ledger list <run-id> [--phase N]         List decisions for a run
ledger get <run-id> --id dec-001         Get single decision
ledger patch <run-id> --id dec-001 --data '{json}'  Update fields (for evaluator write-back)
```

Implementation mirrors `lesson.cjs` and `trace.cjs` exactly — a new `lib/ledger.cjs` with `readLedger`, `writeLedger`, `appendLedger`, `patchLedger`. The JSONL path: `.planning/run/{run-id}/DECISIONS.jsonl`.

---

## Component 2: Escalation Evaluator

### Placement: inline prompt step, not a separate agent

The evaluator is **not a spawned subagent**. Reasons:

1. Spawning a subagent for a classification decision costs context budget and breaks the DECISIONS.jsonl audit trail (the subagent's reasoning would be invisible to the ledger).
2. The evaluator needs to write to the mailbox and potentially re-route the runner — both are orchestrator-level operations.
3. The evaluation criteria are a written contract (4 conditions) that can be applied inline by the orchestrator in 2-3 reasoning steps.

### Verdict schema

```
proceed              -- decision is safe to execute; log only (escalated: false)
proceed-and-log      -- borderline; execute but flag in ledger for post-run human review
park-and-ask         -- do not execute this branch; write to mailbox; continue other phases
```

### Escalation criteria (written contract — not heuristic)

A decision triggers `park-and-ask` if ANY of the following is true:

| Criterion | Description |
|-----------|-------------|
| **Irreversibility** | Decision produces an artifact or state that cannot be undone by `git revert` or a single CLI command |
| **Security surface** | Decision expands credential scope, adds network egress, or modifies hook execution paths |
| **Scope change** | Decision would add tasks outside the current phase's `<domain>` boundary in CONTEXT.md |
| **Spec ambiguity** | The question's answer directly contradicts a `[STRONG]` decision in CONTEXT.md, or the resolution loop returned LOW confidence after exhausting budget |

`proceed-and-log` applies when: confidence is MEDIUM, decision is reversible, no other criterion fires.

`proceed` applies when: confidence is HIGH, decision is reversible, no criterion fires.

### Where the evaluator is embedded

The evaluator step is added to `discuss-phase.md`'s `question_triage` section as a sub-step after the resolution loop. It is also added to the `smart_discuss` step in `autonomous.md` (same placement). In both cases it is a prose reasoning block within the orchestrator, not a Task() call.

---

## Component 3: Park-Don't-Block Mailbox

### Directory layout under `.planning/run/`

```
.planning/run/
  {run-id}/
    DECISIONS.jsonl       -- append-only decision ledger for this run
    MAILBOX.jsonl         -- parked questions waiting for human answer
    RUN-META.json         -- run start time, phase list, status (running/paused/complete)
    parked/
      phase-{N}.json      -- per-parked-phase context snapshot (resume info)
```

The `run-id` format: `{date}-{slug}`, e.g., `20260610-v16-overnight`. Human-readable so the inbox command can display it without decoding.

### MAILBOX.jsonl schema

```json
{
  "id": "q-001",
  "ts": "2026-06-10T02:15:00.000Z",
  "run_id": "20260610-v16-overnight",
  "phase": 3,
  "decision_id": "dec-005",
  "question": "Rate limiting: should we use Redis or in-process?",
  "context": "CONTEXT.md decision 3 says [STRONG] no external deps — Redis contradicts this",
  "options": ["Redis (faster, external dep)", "in-process (slower, self-contained)"],
  "evidence": "CONTEXT.md [STRONG] no-external-deps; RSCH-02 confidence HIGH",
  "status": "pending",
  "answer": null,
  "answered_ts": null
}
```

### Inbox review command: `gsd-tools mailbox`

```
mailbox list [--run run-id] [--status pending|answered]   List questions
mailbox answer <run-id> --id q-001 --answer "Redis"       Record human answer
mailbox review <run-id>                                   Interactive: show each pending Q, prompt for answer
mailbox status <run-id>                                   Show run-id, phase count, pending/answered counts
```

No new workflow file needed for inbox review — `mailbox review` is a CLI command the human runs. The command prints each question with its context and options, reads stdin for the answer, writes back to MAILBOX.jsonl. The overnight runner polls MAILBOX.jsonl before resuming a parked phase (checks `status: "answered"` for the question that blocked it).

### Parked branch resume flow

```
Runner parks phase 3 (question written to MAILBOX.jsonl, parked/phase-3.json saved)
    → runner continues phase 4 in a different worktree
    → human runs: gsd-tools mailbox review 20260610-v16-overnight
    → answers question for phase 3
    → runner (on next iteration or next morning) reads MAILBOX.jsonl
    → sees phase-3 question now answered
    → restores parked/phase-3.json context
    → resumes discuss-phase for phase 3 with the answer injected
    → continues phase 3 → plan → execute
```

The resume mechanism: `parked/phase-{N}.json` stores enough context for the orchestrator to re-run the blocked step. It contains:

```json
{
  "phase": 3,
  "blocked_at": "discuss-phase --auto: question_triage",
  "question_id": "q-001",
  "phase_dir": ".planning/v1.6/phases/03-rate-limiting",
  "has_context": false,
  "resume_instruction": "Resume discuss-phase --auto for phase 3 with answer injected into question_triage"
}
```

---

## Component 4: Overnight Runner

### Design decision: headless `claude -p` per run, not a long-lived session

Three options were considered:

| Option | Verdict |
|--------|---------|
| **headless `claude -p`** — invoke `claude -p "/gsd2:autonomous --from N"` as a subprocess | **Chosen** |
| Long-lived session | Requires keeping a terminal open; context degrades over many phases |
| Scheduled (cron/systemd) | Too much infrastructure; not portable across machines |

`claude -p` fires a single-shot headless run. The runner wraps it with:
- Worktree setup per phase (using existing `worktree.cjs`)
- Ledger + mailbox initialization
- RUN-META.json tracking
- Post-run ledger archival

### New workflow: `workflows/overnight.md`

This is a new workflow file, invoked via a new `/gsd2:overnight` command. It is an orchestrator-level workflow — it uses `Skill()` to invoke `/gsd2:autonomous` — so it cannot be a subagent.

```
/gsd2:overnight [--from N] [--run-id name]
  → workflows/overnight.md
    1. Init: create .planning/run/{run-id}/, write RUN-META.json
    2. Init ledger: create DECISIONS.jsonl (empty)
    3. Init mailbox: create MAILBOX.jsonl (empty)
    4. Set config: gsd-tools config-set harness.run_id {run-id}
    5. Launch: Skill(skill="gsd2:autonomous", args="--from N")
       (autonomous.md will read harness.run_id and write to the active ledger)
    6. After autonomous completes: archive RUN-META.json status="complete"
    7. Print summary: gsd-tools mailbox status {run-id}
    8. Print: "Review parked questions: gsd-tools mailbox review {run-id}"
```

The key integration: `autonomous.md` needs to check `harness.run_id` (via `config-get`) at startup. When set, all `smart_discuss` question_triage decisions write to the active ledger and pass through the evaluator. When not set (interactive use), ledger/evaluator are skipped — no behavior change for normal use.

### Trust ladder: single-phase validation before overnight

The first use of the overnight runner is explicitly scoped to one phase:

```bash
/gsd2:overnight --from 1 --run-id validation-run-001
```

After that run, the human reads the ledger (`gsd-tools ledger list validation-run-001`) and evaluates:
- Were all `escalated: false` decisions actually safe?
- Did `escalated: true` decisions genuinely need human input?
- Were any safe decisions incorrectly escalated (false positives)?

Only after the human scores escalation precision on a single phase does the runner get used for multi-phase overnight runs. This is the trust ladder the PROJECT.md specifies — built into the workflow docs, not enforced by code.

---

## Component 5: Multi-Lens Discussion Loop

### Design: inline roles in the workflow, not separate agents

Three personas — Skeptic, User-Advocate, Architect — judge a concrete artifact (a CONTEXT.md, an AGENT-SPEC, a PLAN.md). The personas are **inline roles within the orchestrator**, not spawned subagents. Reasons:

1. Subagents cannot spawn further agents/skills — any follow-up action (re-research, escalate) requires orchestrator level.
2. Three spawns × N artifacts adds significant context budget cost; inline roles share context cheaply.
3. The convergence brake (stop when all 3 agree or when N rounds pass) requires shared state — hard to coordinate across subagents.

### Where it lives

New workflow: `workflows/discuss-loop.md`. Invoked:
- From `/gsd2:discuss-phase` when `--loop` flag is present (for project-level open questions, not standard phase discussion)
- From `/gsd2:overnight` for unresolved CONTEXT.md sections flagged as `[WEAK]` across multiple phases

### Convergence brake

```
Max rounds: 3 (configurable via config.json harness.loop_max_rounds)
Convergence condition: all 3 personas agree OR round delta drops below threshold (< 1 new objection)
Outcome if no convergence: the contested decision is escalated to mailbox (same park-and-ask path)
```

### Artifact-anchored: what this means

Each lens evaluates **a specific artifact section**, not an abstract question. The Skeptic reads `<decisions>` in CONTEXT.md and writes specific objections against named decisions. The User-Advocate reads `<expected_outcome>` and challenges whether decisions serve the stated end state. The Architect reads `<code_context>` and challenges whether patterns are coherent. This prevents the loop from becoming a free-form debate with no resolution surface.

---

## Component 6: Todo/Backlog Triage Worker

### Design: a workflow + one new gsd-tools subcommand, no new agent

The triage worker reads `.planning/todos/pending/*.md` (existing todo format), evaluates each against the current ROADMAP.md and STATE.md, and emits verdict proposals into the mailbox. It **never modifies a todo or roadmap directly** — the harness proposes, never disposes.

### New workflow: `workflows/triage.md`

```
/gsd2:triage [--run-id name]
  → workflows/triage.md
    1. Init: ensure .planning/run/{run-id}/ exists (or create)
    2. Read all pending todos: gsd-tools list-todos
    3. Read ROADMAP.md + STATE.md for current phase list and completed set
    4. For each todo: evaluate verdict (inline orchestrator, no subagent spawn)
    5. Write proposals to MAILBOX.jsonl with verdict + rationale
    6. Print summary: N proposals written, review with: gsd-tools mailbox review {run-id}
```

### Verdict taxonomy (inline evaluation criteria)

| Verdict | Condition |
|---------|-----------|
| `already-done` | Todo title/content matches a shipped requirement in REQUIREMENTS.md or a completed phase |
| `obsolete` | Todo references a pattern/file that no longer exists in the codebase |
| `fold-into-phase` | Todo is within scope of an incomplete phase — reference that phase |
| `new-phase` | Todo is out of scope for all existing phases; would be a standalone new phase |
| `needs-input` | Cannot determine verdict without human clarification |
| `defer` | Valid idea, no active phase home, not urgent enough to add now |

The verdict is written to MAILBOX.jsonl as a `triage` type entry (separate from `decision` type). The human can accept, modify, or reject each proposal via `gsd-tools mailbox review`.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  Orchestrator Level                          │
│  /gsd2:overnight   /gsd2:triage   /gsd2:discuss-loop        │
├─────────────────────────────────────────────────────────────┤
│                  Harness Workflows                           │
│  overnight.md ──→ Skill(autonomous) ──→ autonomous.md       │
│  triage.md ──────────────────────────→ mailbox writes       │
│  discuss-loop.md ─────────────────────→ inline roles        │
├─────────────────────────────────────────────────────────────┤
│              Modified Existing Workflows                     │
│  discuss-phase.md  (+evaluator step in question_triage)     │
│  autonomous.md     (+ledger writes in smart_discuss)        │
├─────────────────────────────────────────────────────────────┤
│               State / Persistence Layer                     │
│  .planning/run/{run-id}/                                    │
│    DECISIONS.jsonl   MAILBOX.jsonl   RUN-META.json          │
│    parked/phase-{N}.json                                    │
│  .planning/telemetry/agent-trace.jsonl  (existing)          │
│  .planning/lessons/lessons.jsonl        (existing)          │
├─────────────────────────────────────────────────────────────┤
│               CLI Layer (gsd-tools.cjs)                     │
│  ledger {append,list,get,patch}                             │
│  mailbox {list,answer,review,status}                        │
│  (existing: worktree, parallel-gate, lesson, trace)         │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `overnight.md` (new workflow) | Init run dir, launch autonomous, archive | Calls `Skill(autonomous)`, writes RUN-META.json, calls `mailbox status` |
| `autonomous.md` (modified) | Drive phases; read harness.run_id; write to ledger in smart_discuss | Calls `Skill(discuss-phase/plan/execute)`; reads `config-get harness.run_id` |
| `discuss-phase.md` (modified) | Add evaluator step to question_triage; park-and-ask if criteria fire | Writes DECISIONS.jsonl via `ledger append`; writes MAILBOX.jsonl via `mailbox append` |
| `discuss-loop.md` (new workflow) | Multi-lens review of a concrete artifact section | Inline roles (Skeptic/Advocate/Architect); writes convergence failures to mailbox |
| `triage.md` (new workflow) | Evaluate pending todos against ROADMAP; emit proposals | Reads todos, ROADMAP, STATE; writes to MAILBOX.jsonl |
| `ledger.cjs` (new lib module) | DECISIONS.jsonl CRUD (mirrors lesson.cjs) | Called by discuss-phase.md, autonomous.md via gsd-tools CLI |
| `mailbox.cjs` (new lib module) | MAILBOX.jsonl CRUD + interactive review | Called by overnight.md, discuss-phase.md, triage.md via gsd-tools CLI |
| `gsd-tools.cjs` (modified) | Route `ledger` and `mailbox` subcommands | Requires ledger.cjs, mailbox.cjs; same router pattern as lesson/trace |
| `model-profiles.cjs` (not modified) | No new agents — all components are inline or existing | N/A |
| `install.js` (not modified) | No new hook files needed for v1.6 | N/A |

---

## Data Flow: Autonomous Decision to Human Inbox

```
/gsd2:overnight --from 1
    ↓
overnight.md: create .planning/run/20260610-v16/
    config-set harness.run_id = 20260610-v16
    ↓
Skill(autonomous)
    ↓
autonomous.md → smart_discuss phase 1
    ↓
discuss-phase --auto: question_triage TECHNICAL
    resolution loop → HIGH confidence
    ↓
EXISTING write: CONTEXT.md [STRONG, specialist-backed]
NEW write: gsd-tools ledger append 20260610-v16 --data '{...decision...}'
    ↓
Evaluator (inline in discuss-phase orchestrator):
    check 4 escalation criteria
    verdict = proceed → patch ledger: {escalated: false}
    verdict = park-and-ask → patch ledger: {escalated: true}
                           → gsd-tools mailbox append --data '{...question...}'
                           → write parked/phase-1.json (resume context)
                           → runner continues next phase
    ↓
(Morning) Human: gsd-tools mailbox review 20260610-v16
    sees question, provides answer
    ↓
Runner resumes phase 1:
    reads parked/phase-1.json
    re-runs discuss-phase with answer injected
    continues → plan → execute → verify
```

---

## Data Flow: Triage Worker

```
/gsd2:triage --run-id 20260610-v16
    ↓
triage.md: gsd-tools list-todos
    read ROADMAP.md, STATE.md, REQUIREMENTS.md
    ↓
For each pending todo:
    inline verdict evaluation (already-done / obsolete / fold-into-phase / ...)
    ↓
gsd-tools mailbox append --run-id 20260610-v16 --type triage --data '{verdict, rationale, todo_path}'
    ↓
Human: gsd-tools mailbox review 20260610-v16
    accept verdict → gsd-tools todo complete <file>   (for already-done/obsolete)
    accept fold → edit ROADMAP.md manually or via /gsd2:add-todo
    reject → mark declined in MAILBOX.jsonl
```

---

## New Files Required

| File | Type | Role |
|------|------|------|
| `get-shit-done/workflows/overnight.md` | New workflow | Wraps `/gsd2:autonomous` with harness init/teardown |
| `get-shit-done/workflows/triage.md` | New workflow | Todo/backlog triage with proposal emission |
| `get-shit-done/workflows/discuss-loop.md` | New workflow | Multi-lens artifact review with convergence brake |
| `commands/gsd2/overnight.md` | New command stub | Entry point for `/gsd2:overnight` |
| `commands/gsd2/triage.md` | New command stub | Entry point for `/gsd2:triage` |
| `commands/gsd2/discuss-loop.md` | New command stub | Entry point for `/gsd2:discuss-loop` |
| `get-shit-done/bin/lib/ledger.cjs` | New lib module | DECISIONS.jsonl CRUD (mirrors lesson.cjs) |
| `get-shit-done/bin/lib/mailbox.cjs` | New lib module | MAILBOX.jsonl CRUD + interactive review |

---

## Modified Files

| File | Change |
|------|--------|
| `get-shit-done/workflows/discuss-phase.md` | Add evaluator step in `question_triage`; write to ledger + mailbox when `harness.run_id` is set |
| `get-shit-done/workflows/autonomous.md` | Read `harness.run_id` at startup; thread it into `smart_discuss` question_triage writes; implement parked-phase resume loop |
| `get-shit-done/bin/gsd-tools.cjs` | Add `require` for ledger.cjs and mailbox.cjs; register `ledger` and `mailbox` cases in the switch router |

---

## Build Order

The features have dependencies that suggest this order:

```
Phase 1: ledger.cjs + mailbox.cjs + gsd-tools routing
    → Foundation for all other components; no UI, no workflow changes yet
    → Can be unit-tested against the existing JSONL patterns (lesson.cjs, trace.cjs as reference)

Phase 2: Escalation evaluator + discuss-phase.md wiring
    → Wire evaluator inline in question_triage (guarded by harness.run_id check — no behavior change without overnight runner)
    → Validate: run /gsd2:discuss-phase --auto on one phase, confirm DECISIONS.jsonl is populated
    → TRUST LADDER CHECKPOINT: read the ledger, manually score escalation precision before proceeding

Phase 3: overnight.md + /gsd2:overnight command
    → Wraps existing autonomous.md; adds run init/teardown
    → Validate: single-phase overnight run → read ledger → score precision
    → Only after scoring: attempt multi-phase run

Phase 4: triage.md + /gsd2:triage command
    → Standalone worker; no dependency on overnight runner (but can share the same run-id mailbox)
    → Validate: run against current .planning/todos/pending/ and verify proposals are correct

Phase 5: discuss-loop.md + /gsd2:discuss-loop command
    → Standalone artifact reviewer; no dependency on other v1.6 components
    → Validate: pass one existing CONTEXT.md through the loop, verify convergence behavior

Phase 6: Resume logic in autonomous.md (parked branch resumption)
    → Depends on Phase 1-3; needs working mailbox, parked/*.json, and overnight runner
    → Most complex component; build last when the rest is verified
```

**Rationale for this order:**
- CLI layer first (Phase 1) — every other component calls it; having it unit-testable before the workflows reduces debugging surface
- Evaluator before runner (Phase 2 before 3) — the runner's value is nil without the evaluator; and the evaluator can be validated interactively without headless operation
- Trust ladder (Phase 2 checkpoint) — the PROJECT.md constraint says: validate on a single phase before widening; the build order enforces this structurally
- Triage and discuss-loop are independent (Phases 4-5) — they share the mailbox CLI but have no other coupling; they can be built/validated in parallel
- Resume logic last (Phase 6) — it's the most complex and requires all other pieces to be solid first

---

## Anti-Patterns to Avoid

### 1. Evaluator as a spawned subagent

**What people do:** Spawn `Task(subagent_type="gsd-escalation-evaluator", ...)` for each decision.

**Why it's wrong:** Subagents lack Skill/Agent grants. If the evaluator reaches `park-and-ask`, it cannot call `Skill(plan-phase, next-phase)` to continue. The orchestrator would need to re-evaluate the subagent's output anyway to decide whether to park or proceed. Double evaluation, no gain, and a broken tool-grant path.

**Do this instead:** Inline evaluator — a prose reasoning block in the orchestrator that applies the 4 written criteria and emits a verdict string.

### 2. One global DECISIONS.jsonl

**What people do:** Write all decisions to `.planning/DECISIONS.jsonl` (like the lessons ledger).

**Why it's wrong:** Concurrent overnight runs on different branches corrupt each other's audit trails. The human cannot distinguish decisions from run A vs run B. Ledger-per-run under `.planning/run/{run-id}/` is the isolation unit.

**Do this instead:** Run-scoped DECISIONS.jsonl under `.planning/run/{run-id}/`. The CLI's `ledger list --run all` can aggregate across runs when the human wants a full view.

### 3. Blocking autonomous.md on mailbox questions

**What people do:** When the evaluator says `park-and-ask`, the runner pauses and waits for the human to answer before continuing.

**Why it's wrong:** This defeats park-don't-block. The overnight runner's value is precisely that it continues other phases while a question waits. Blocking on the mailbox reinstates the human-in-the-loop bottleneck.

**Do this instead:** Write the question to MAILBOX.jsonl, save `parked/phase-{N}.json`, continue to the next incomplete phase. Resume the parked phase on the next iteration (or next run) after checking `status: "answered"`.

### 4. Triage worker that modifies artifacts directly

**What people do:** Have the triage worker move todos to `done/`, edit ROADMAP.md phase lists, or create new phases automatically.

**Why it's wrong:** Violates the "harness proposes, never disposes" principle. Silent mutations to ROADMAP.md during an overnight run could invalidate the entire planning state without audit trail.

**Do this instead:** Every triage verdict is a mailbox proposal. The human accepts/rejects each one via `gsd-tools mailbox review`. Only after human acceptance does any artifact change — and the human or an explicit `/gsd2:add-todo` call makes that change.

### 5. Multi-lens loop with spawned agents per persona

**What people do:** Spawn `gsd-skeptic-agent`, `gsd-advocate-agent`, `gsd-architect-agent` as three separate Task() calls.

**Why it's wrong:** Three spawns share no context; the Skeptic cannot see the Architect's objection and build on it. Coordination requires writing intermediate state files and re-reading them, adding fragility. The convergence brake (does round N have < 1 new objection vs N-1?) requires shared state.

**Do this instead:** Three inline role switches in the orchestrator, each reading the same artifact and the prior round's objections. Shared context window is the feature, not a limitation.

---

## Scalability Considerations

The v1.6 harness is designed for 5–10 parallel GSD sessions, not thousands. The relevant scaling question is: what breaks when the overnight runner processes 8-10 phases across 2-3 milestones?

| Scale | Concern | Design Response |
|-------|---------|----------------|
| 1 phase | Initial validation run | Single-phase overnight; human reads full ledger |
| 5-10 phases (1 milestone) | Mailbox gets 15-30 questions | `mailbox review --status pending` filters; `--run run-id` scopes |
| 2-3 concurrent milestones | Multiple overnight runners | Run IDs are isolated; no shared mutable state |
| Ledger growth | JSONL files grow over time | Ledger is per-run, archived on run complete; no unbounded growth |

Context window is the real scaling constraint for multi-phase overnight runs: `autonomous.md` re-reads ROADMAP.md after each phase, which keeps context fresh, but deeply nested `smart_discuss` over many phases accumulates. The `--from N` flag on overnight handles restarts after context-window degradation.

---

## Sources

- `.planning/PROJECT.md` — v1.6 requirements, constraints, trust ladder principle (direct inspection)
- `get-shit-done/workflows/discuss-phase.md` — `question_triage` write-back pattern, `--auto` mode (direct inspection)
- `get-shit-done/workflows/autonomous.md` — `smart_discuss` sub-step, harness integration points (direct inspection)
- `get-shit-done/bin/lib/lesson.cjs` — JSONL ledger pattern (append/list/filter/update) used as implementation template (direct inspection)
- `get-shit-done/bin/lib/trace.cjs` — second JSONL telemetry pattern confirming the convention (direct inspection)
- `get-shit-done/bin/lib/worktree.cjs` — worktree isolation API (direct inspection)
- `get-shit-done/bin/gsd-tools.cjs` — CLI router structure and subcommand registration pattern (direct inspection)
- `.planning/telemetry/agent-trace.jsonl` — live example of JSONL event format (direct inspection)
- `.planning/research/ARCHITECTURE.md` (v1.4) — prior integration architecture document for reference (direct inspection)

---

*Architecture research for: GSD v1.6 Autonomous Supervision Harness*
*Researched: 2026-06-10*
