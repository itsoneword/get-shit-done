# Phase 9: SkillOpt-Style Self-Improving Skills - Research

**Researched:** 2026-06-08
**Domain:** Agentic tooling / online feedback loop / GSD meta-improvement
**Confidence:** MEDIUM (codebase findings HIGH; SkillOpt primary source MEDIUM; bounded-edit size limit unresolved)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Phase delivers an **online, feedback-driven skill-evolution loop** — NOT a SkillOpt offline batch optimizer + benchmark [STRONG].
- SkillOpt discipline retained where cheap: **bounded** add/delete/replace edits, an **explicit accept-gate**, **git-reversible** application. The benchmark/scorer is dropped.
- **Capture: both** — manual `/teach` primary (lands lessons), auto-miner suggests only, never edits [STRONG].
- **Gate: always propose, human ratifies every edit** [STRONG — user is editing the framework's own brain; no auto-apply path].
- **Attribution: loop proposes target from telemetry + produced artifact; user confirms** [STRONG].
- **Accretion/bloat control delegated to future `/gsd2:doctor`** [STRONG — this phase ships capture → gate → apply + ledger only].
- Lessons persist in **`.planning/lessons/`** ledger [STRONG — implied by recurrence-counter requirement].
- Reflection/edit engine = **advisor-style critic** [DISCRETION — exact model/agent at research time].

### Claude's Discretion
- Exact `/teach` command name + invocation surface (standalone command vs. flag on `fix`/`verify-work`).
- Lessons ledger file format + schema.
- Which existing events the auto-miner harvests first and the recurrence threshold.
- The reflection agent/model and the diff-proposal mechanics.
- Edit-bound definition (max size / shape of "bounded").

### Deferred Ideas (OUT OF SCOPE)
- SkillOpt quantitative optimizer / offline benchmark / automated scorer.
- Lesson/skill-edit consolidation (dedup, merge, prune stale edits) → future `/gsd2:doctor`.
- Auto-apply / tiered-autonomy gate — considered, rejected for v1.
- Reusable example-mining workflow (`/gsd2:mine-examples`) — carried from Phase 8.

</user_constraints>

---

## Summary

Phase 9 delivers an **online, human-gated skill-evolution loop** for GSD's own prose. The loop: observe real failure → `/gsd2:teach` → advisor-critic reflects and proposes a bounded edit to the responsible artifact → user ratifies → committed to `agents/` or `get-shit-done/` source + recorded in `.planning/lessons/`. Skills evolve from real project experience, not static prompts.

The core intellectual debt to SkillOpt is the **bounded-edit discipline**: treat the skill document as trainable state; confine every edit to a single artifact and a single add/delete/replace action; hold an accept-gate before any edit lands. SkillOpt's offline benchmark gate (held-out accuracy strictly improving) is replaced by human ratification — weaker guarantee, but the only feasible one on GSD's small-N data. The advisor tool (already in GSD) serves as the reflection/critic step.

The trickiest engineering problem is **attribution**: the telemetry log (`agent-trace.jsonl`) records `agent_type` and a `description` hash but carries no direct artifact→source-file link. Attribution must be resolved by a two-step heuristic: (1) match failure description to a recent telemetry record by agent_type; (2) map agent_type to the known source prose file via a fixed table. The user confirms or redirects before any edit is proposed. This keeps attribution lightweight and honest about its limits.

**Primary recommendation:** Implement Phase 9 as three deliverables: (1) the `/gsd2:teach` command (workflow + command registration); (2) a `gsd-tools lesson` subcommand backed by a JSONL ledger at `.planning/lessons/lessons.jsonl`; (3) a lightweight auto-miner script that scans the ledger + verify-work BLOCKER events and nominates recurring patterns.

---

## Proposed Requirement IDs

REQUIREMENTS.md has a reserved ID `LEARN-01` (Learning Loop — "extract-learnings + per-project intel store"). Phase 9 is the materialization of that intent. Proposed IDs aligned to the `TEACH-` namespace (avoiding collision with prior `LEARN-01` which was a different scope):

| ID | Description |
|----|-------------|
| TEACH-01 | A `/gsd2:teach` command exists: accepts a failure description, reads telemetry to propose an attribution target, invokes advisor-critic for a bounded edit proposal, and presents a diff for ratification before any write. |
| TEACH-02 | Ratified edits are committed to `agents/` or `get-shit-done/` source only (not `.claude/` runtime); each ratified edit also writes a record to `.planning/lessons/lessons.jsonl` with disposition=applied. |
| TEACH-03 | The lessons ledger supports the full lifecycle: proposed → ratified/rejected → applied, with a recurrence counter the auto-miner reads. |
| TEACH-04 | The auto-miner nominates recurring failures (recurrence ≥ threshold) but NEVER edits without manual ratification; every nomination routes through the `/teach` gate. |
| TEACH-05 | The loop is git-reversible: a bad ratified edit can be undone with `git revert <commit>` and `npm run dev` to propagate the revert. |

---

## SkillOpt Discipline — What Transfers

**Source:** GitHub README (`github.com/microsoft/SkillOpt`) — verified via WebFetch (MEDIUM confidence). arXiv abstract confirms high-level claims (MEDIUM); exact bounds not in either source (unresolved — see Open Questions).

### What transfers to GSD's no-benchmark, human-gated online loop

| SkillOpt discipline | GSD Phase 9 equivalent | Notes |
|---------------------|------------------------|-------|
| Treat skill doc as trainable external state | `agents/*.md`, `get-shit-done/references/*.md`, `get-shit-done/workflows/*.md` are the "trainable" docs | Same concept |
| Bounded add/delete/replace edit on a **single** skill document per cycle | Each `/teach` invocation proposes one edit to one file | Critical — no multi-file edits per lesson |
| "Textual learning-rate budget" — scope limit per edit | GSD defines its own: **one contiguous section (or ≤ ~20 lines)** changed per ratification (see Open Questions) | Exact SkillOpt limit not published; GSD must define |
| Accept-gate before edit lands | Human ratification — user sees diff, types y/N | Replaces held-out accuracy gate |
| Rollout → reflect → edit → gate cycle | observe failure → `/teach` → advisor critic → diff + [y/N] → commit | One-shot (no epoch loop) |
| Per-step artifact logging | `.planning/lessons/lessons.jsonl` — each lesson entry is the "artifact" | Analogous; no batch scoring |
| Reversibility via version control | `git revert <commit>` on the source commit + `npm run dev` to repropagate | SkillOpt does per-step patches; GSD uses git |

### What does NOT transfer

| SkillOpt feature | Why dropped |
|------------------|-------------|
| Held-out validation split (hard/soft/mixed gate) | GSD has ~7 phases — no split is possible |
| Automatic accept/reject (`slow_update_gate_with_selection`) | Replaced entirely by human ratification |
| Epoch-based optimization loop (many rollouts per skill) | GSD runs one pass per real failure; not batch |
| SkillOpt-Sleep nightly consolidation cycle | Delegated to future `/gsd2:doctor` |
| Benchmark-specific reward scorers | No eval substrate; real failure is the only signal |

**Confidence on SkillOpt section:** MEDIUM. The GitHub README provided concrete architectural details (hard/soft/mixed gate, slow-update mode, per-step artifacts) that were not fed to the fetcher — treating as reliable. arXiv abstract corroborates bounded add/delete/replace + single-doc-per-cycle. Exact line/token budget: LOW (not found in either source).

---

## Standard Stack

### Core — unchanged from GSD's existing infrastructure

| Asset | Location | Purpose | Status |
|-------|----------|---------|--------|
| `gsd-tools.cjs` | `get-shit-done/bin/gsd-tools.cjs` | CLI host for `lesson` subcommand | Extend |
| `trace.cjs` | `get-shit-done/bin/lib/trace.cjs` | `readTrace` + `filterTrace` for attribution | Reuse as-is |
| `core.cjs` | `get-shit-done/bin/lib/core.cjs` | `cmdCommit`, file utilities | Reuse as-is |
| `advisor` tool | Built-in to Claude Code | Reflection/critic step | Invoke inline |
| git | system | Reversible source edits | `git revert` |

### New artifacts this phase must create

| Artifact | Path | Purpose |
|----------|------|---------|
| Lessons ledger | `.planning/lessons/lessons.jsonl` | Persistent lesson store |
| `lesson.cjs` | `get-shit-done/bin/lib/lesson.cjs` | JSONL read/write for the ledger |
| `teach` workflow | `get-shit-done/workflows/teach.md` | Full `/teach` loop prose |
| `teach` command | `commands/gsd2/teach.md` | Slash-command registration |
| `auto-mine.cjs` | `get-shit-done/bin/lib/auto-mine.cjs` | Auto-miner (nominates only) |

**Installation note:** `commands/gsd2/teach.md` is the source; `install.js` propagates it to `.claude/commands/gsd2/teach.md` at `npm run dev`. No manual copy step needed — follows the same path-replacement flow as every other command.

### No new external npm packages needed
All required capabilities exist: `fs`, `path`, `crypto` (already in hooks), git CLI. No new dependencies.

---

## Architecture Patterns

### Recommended Project Structure
```
get-shit-done/
├── workflows/teach.md          # /teach loop prose
├── bin/lib/lesson.cjs          # ledger CRUD
├── bin/lib/auto-mine.cjs       # auto-miner (nominate-only)
commands/gsd2/
└── teach.md                    # slash-command registration
.planning/
└── lessons/
    └── lessons.jsonl           # append-only lesson ledger
agents/
├── gsd-executor.md             # editable target (highest blast radius)
├── gsd-planner.md              # editable target
├── gsd-verifier.md             # editable target
get-shit-done/
├── references/*.md             # editable target (lowest blast radius)
└── workflows/*.md              # editable target (medium blast radius)
```

### Pattern 1: The `/teach` Command Loop

**What:** A workflow + command that takes a failure description, attributes it to a prose artifact, drafts a bounded edit via advisor-critic, presents a diff, and commits on ratification.

**Structure (mirrors `note.md` + `add-todo.md` patterns):**

```
# commands/gsd2/teach.md
---
name: gsd2:teach
description: Teach GSD a lesson from a real failure. Proposes a bounded edit to the responsible artifact.
argument-hint: "<failure description>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---
<execution_context>
@~/.claude/get-shit-done/workflows/teach.md
</execution_context>
<context>
$ARGUMENTS
</context>
```

**Workflow steps (prose in `teach.md`):**

1. **Init** — load init context, read recent telemetry (`gsd-tools trace --last 20 --raw`)
2. **Attribution** — match failure description to recent agent_type via keyword heuristic; present proposed target artifact + "is this the right file?" [y/redirect]
3. **Reflect** — invoke `advisor` (or inline advisor-style prompt): "Was this a skill fault? What minimal prose change prevents recurrence?"
4. **Draft bounded edit** — produce add/delete/replace diff for ONE section of ONE file
5. **Present for ratification** — show diff, ask [y/N]
6. **Apply or discard** — if y: `gsd-tools commit`, write lesson to ledger, propagate (`npm run dev`); if N: write lesson as rejected disposition
7. **Confirm** — `Lesson recorded: .planning/lessons/lessons.jsonl (ID: LSN-{n})`

### Pattern 2: Lessons Ledger (JSONL)

**What:** Append-only JSONL file, one record per lesson. Follows the `agent-trace.jsonl` convention already in the project.

**Schema:**
```json
{
  "id": "LSN-001",
  "ts": "2026-06-08T14:00:00.000Z",
  "description": "executor missed endpoint — did not verify API contract",
  "attributed_agent": "gsd-executor",
  "attributed_file": "agents/gsd-executor.md",
  "disposition": "applied",
  "recurrence": 1,
  "edit_summary": "Added: ## API Contract Verification step in executor prose",
  "commit": "abc1234",
  "session_id": "dd74ec26-..."
}
```

**Disposition lifecycle:** `proposed` → `ratified` → `applied` | `rejected`

**`gsd-tools lesson` subcommand pattern** (mirrors `gsd-tools trace`):
- `gsd-tools lesson list [--agent gsd-executor] [--disposition applied]` — filtered table
- `gsd-tools lesson append <json>` — append a record (used by `/teach` workflow)
- `gsd-tools lesson bump-recurrence <id>` — increment recurrence counter (used by auto-miner)

### Pattern 3: Attribution Heuristic

**What:** Two-step mapping: failure description → agent_type → source file.

**Step 1 — match description to telemetry:**
```javascript
// Naive: use most-recent gsd-executor/gsd-planner/gsd-verifier entry
// Better: keyword match failure_description against description field of recent records
const recentRecords = filterTrace(readTrace(cwd), { last: 50 });
// Filter to execution agents only (exclude planner-checkers, researchers — they don't produce artifacts)
const executionAgents = ['gsd-executor', 'gsd-planner', 'gsd-verifier'];
const candidates = recentRecords.filter(r => executionAgents.includes(r.agent_type));
```

**Step 2 — agent_type → source prose file (static table):**

| agent_type | Source file | Blast radius |
|------------|-------------|--------------|
| `gsd-executor` | `agents/gsd-executor.md` | HIGH |
| `gsd-planner` | `agents/gsd-planner.md` | HIGH |
| `gsd-verifier` | `agents/gsd-verifier.md` | HIGH |
| `gsd-plan-checker` | `agents/gsd-plan-checker.md` | MEDIUM |
| `gsd-phase-researcher` | `agents/gsd-phase-researcher.md` | MEDIUM |
| `gsd-debugger` | `agents/gsd-debugger.md` | MEDIUM |
| `gsd-fixer` | `agents/gsd-fixer.md` | MEDIUM |
| (no agent — pattern failure) | `get-shit-done/references/common-bug-patterns.md` | LOW |
| (workflow/process failure) | `get-shit-done/workflows/{relevant}.md` | LOW-MEDIUM |

**Important notes on the static table:**
- Source files are in repo-root `agents/` directory (NOT `get-shit-done/agents/` which does not exist, and NOT `.claude/agents/` which is gitignored runtime).
- Agent prose has a **path-token rule** (from STATE.md Phase 03 decision): source agent files use `~/.claude/` tokens in their prose; apply edits with awareness that the content references runtime paths.
- There is a **`gsd-local-patches/` layer** (`/home/cleversol/gsd2/mine/.claude/gsd-local-patches/agents/gsd-planner.md`) — only for the `gsd-planner`. Local patches override source at runtime but live in gitignored `.claude/`. The loop edits only repo-root `agents/` source, not the local-patches layer.

### Pattern 4: Bounded Edit Definition

**What GSD uses** (since SkillOpt does not publish exact bounds):

A **bounded edit** is:
- Targets **one contiguous section** (delimited by a `##` or `###` header) within one file
- Operation type: add, delete, or replace (never more than one type per lesson)
- Size limit: **≤ 20 lines changed** (added + removed combined)
- No cross-file edits in a single ratification step

The advisor-critic must enforce this: if a proposed change exceeds the bound, split into multiple lessons or narrow the scope.

### Pattern 5: Bounded Edit Application + Reversibility

**Apply sequence (after ratification):**
1. Use `Edit` tool (not `Write`) — preserves the file, makes a surgical change
2. `gsd-tools commit "teach(agent): <summary>" --files <source_file> .planning/lessons/lessons.jsonl`
3. `npm run dev` — triggers `build:hooks && install.js --local`; propagates source change to `.claude/` runtime
4. `/teach` confirms: "Applied. Commit: <hash>. Run `npm run dev` to propagate."

**Reversibility:**
- `git revert <commit>` reverts the source edit
- `npm run dev` propagates the revert to runtime
- The lesson record stays in ledger with `disposition: reverted` — it is NOT deleted (doctor inherits it)

**Why commit source only:**
- `agents/*.md` → source; `.claude/agents/*.md` → runtime (gitignored, propagated by install)
- `get-shit-done/references/*.md` → source; `.claude/get-shit-done/references/*.md` → runtime
- `get-shit-done/workflows/*.md` → source; same pattern
- `commands/gsd2/*.md` → source; `.claude/commands/gsd2/*.md` → runtime

### Pattern 6: The Auto-Miner (Secondary Path)

**What:** A read-only scanner that harvests recurrence signals and NOMINATES. Never proposes a diff; never calls `/teach` automatically. Outputs: "seen this failure pattern 3×, consider teaching it."

**Cheapest first version — three signal sources:**

1. **Lessons ledger** — `recurrence` field; bump when `/teach` is invoked for an already-known pattern
2. **verify-work BLOCKERs** — scan `*-VERIFICATION.md` for repeated BLOCKER lines across phases
3. **telemetry confidence dips** — scan `agent-trace.jsonl` for `confidence: null` or `confidence: LOW` entries that cluster around similar descriptions

**Recurrence threshold:** 3 occurrences = nominate. Configurable via `.planning/config.json` key `teach.recurrence_threshold` (default: 3).

**Output:** Plain-text suggestion appended to session or emitted via `/gsd2:teach scan`:
```
Auto-miner nominations:
  1. [gsd-executor] "missing endpoint" — seen 3×. Run: /gsd2:teach "missing endpoint"
```

**Where recurrence count lives:** In the JSONL ledger's `recurrence` field. Auto-miner reads ledger + signals; `/teach` bumps the counter when it matches an existing lesson.

### Anti-Patterns to Avoid

- **Multi-file edits per lesson:** One lesson = one file. If a failure spans two agents, create two lessons.
- **Editing `.claude/` runtime directly:** All edits go to source (`agents/`, `get-shit-done/`); install propagates.
- **Auto-applying on auto-miner nomination:** The auto-miner nominates only. `/teach` gate is mandatory.
- **Editing `gsd-local-patches/`:** That layer is for user overrides, not phase-taught lessons.
- **Large rewrites disguised as lessons:** If the advisor drafts > 20 lines changed, narrow the scope or defer to doctor.
- **Consolidation in this phase:** dedup/merge/prune is doctor's job; lessons ledger is append-only here.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSONL append | Custom parser | `fs.appendFileSync` + `JSON.stringify` | Same pattern as `agent-trace.js` |
| Telemetry read | New reader | `readTrace` + `filterTrace` from `trace.cjs` | Already exports these |
| Git commit | Custom git call | `gsd-tools commit <msg> --files` | Handles `commit_docs`, gitignore, amend |
| Diff display | Custom differ | Show the edit inline as before/after lines | `advisor` draft already produces this in prose |
| Source→runtime propagation | Custom copy | `npm run dev` (= `build:hooks && install.js --local`) | Install.js is the canonical propagator |

---

## Editable-Artifact Map (Complete)

This is the map that attribution resolves TO. Source of truth is repo root; runtime is `.claude/` (gitignored).

### Agent prose (highest blast radius)
All live in repo-root `agents/` directory:
```
agents/gsd-executor.md          ← agent_type: gsd-executor
agents/gsd-planner.md           ← agent_type: gsd-planner
agents/gsd-verifier.md          ← agent_type: gsd-verifier
agents/gsd-plan-checker.md      ← agent_type: gsd-plan-checker
agents/gsd-phase-researcher.md  ← agent_type: gsd-phase-researcher
agents/gsd-debugger.md          ← agent_type: gsd-debugger
agents/gsd-fixer.md             ← agent_type: gsd-fixer
agents/gsd-document-mapper.md   ← agent_type: gsd-document-mapper
agents/gsd-document-updater.md  ← agent_type: gsd-document-updater
(+ other gsd-*.md in agents/)
```
Runtime: `.claude/agents/*.md` (install propagates). Also `.claude/gsd-local-patches/agents/gsd-planner.md` — user-specific override for planner; loop does NOT touch this.

### Reference docs (lowest blast radius — start here)
```
get-shit-done/references/universal-anti-patterns.md
get-shit-done/references/common-bug-patterns.md
get-shit-done/references/tdd.md
get-shit-done/references/artifact-authoring.md
get-shit-done/references/verification-patterns.md
get-shit-done/references/resolution-loop.md
(+ others in get-shit-done/references/)
```

### Workflow prose (medium blast radius)
```
get-shit-done/workflows/execute-phase.md
get-shit-done/workflows/plan-phase.md
get-shit-done/workflows/verify-work.md
(+ any workflow that steers the failure)
```

### Slash-command registrations (low blast radius — rarely the fault)
```
commands/gsd2/execute-phase.md
commands/gsd2/plan-phase.md
(etc.)
```

---

## Common Pitfalls

### Pitfall 1: Attribution Hallucination
**What goes wrong:** The advisor-critic proposes an edit to the wrong file because the description is ambiguous.
**Why it happens:** `agent-trace.jsonl` stores `description` (a free-text spawn description) + `agent_type`, but no artifact path. Attribution is inference.
**How to avoid:** Always show the proposed attribution ("Looks like a gsd-executor issue — edit `agents/gsd-executor.md`?") and require user confirmation before drafting a diff. The user confirms or redirects.
**Warning signs:** User says "that's the wrong file" more than once — means the attribution heuristic is noisy; improve keyword matching.

### Pitfall 2: Scope Creep in the Bounded Edit
**What goes wrong:** The advisor-critic drafts a "refactor" that rewrites half the agent prose.
**Why it happens:** LLMs tend toward comprehensive responses; bounded-edit is a discipline that must be enforced.
**How to avoid:** The `/teach` workflow must instruct the critic with explicit size limits (≤ 20 lines, one section). If the first draft exceeds the bound, the workflow asks the critic to narrow it.
**Warning signs:** Draft diff > 20 lines or touches > 1 section header.

### Pitfall 3: Runtime Edit Instead of Source Edit
**What goes wrong:** The apply step edits `.claude/agents/gsd-executor.md` (runtime) instead of `agents/gsd-executor.md` (source). The edit is gitignored and lost at next `npm run dev`.
**Why it happens:** Many tool calls operate relative to cwd; `.claude/` is visible and writable.
**How to avoid:** Apply step always resolves to the source path (repo root `agents/` or `get-shit-done/`) before calling `Edit`. Assert the target path does NOT start with `.claude/`.

### Pitfall 4: Lesson Accumulation Without Recurrence Signal
**What goes wrong:** 20 one-off lessons land in the ledger; none are meaningful patterns; doctor eventually prunes all.
**Why it happens:** Every user invocation of `/teach` appends a lesson, even for truly one-off bugs.
**How to avoid:** The auto-miner surfaces recurrence; human ratification at `/teach` invocation is the primary guard (the user should ask "is this worth a permanent rule?"). The `/teach` workflow should include a reflection prompt: "Is this a recurring pattern or a one-off?"
**Warning signs:** Ledger grows > 30 entries with recurrence = 1 across all of them.

### Pitfall 5: Forgetting the Propagation Step
**What goes wrong:** Edit is committed to source but the running session still uses the old runtime copy.
**Why it happens:** `.claude/` is only updated when `npm run dev` runs.
**How to avoid:** The final confirmation step in `/teach` always includes: "Run `npm run dev` to propagate this edit to the current runtime."
**Warning signs:** User invokes `/teach`, ratifies, but the executor still exhibits the old behavior in the same session.

### Pitfall 6: Local-Patches Confusion
**What goes wrong:** Loop proposes an edit to `gsd-planner.md` and the executor writes to `.claude/gsd-local-patches/agents/gsd-planner.md` instead of `agents/gsd-planner.md`.
**Why it happens:** The local-patches layer overrides source at runtime; it is visible to file tools.
**How to avoid:** Attribution table explicitly maps `gsd-planner` to `agents/gsd-planner.md` (source). The `/teach` workflow must document that local-patches are NOT edited by the loop.

---

## `/teach` Command Structure — Recommendation

**Recommendation:** Standalone command (`/gsd2:teach`), not a flag on `fix` or `verify-work`. Rationale:
1. Distinct lifecycle (failure capture → attribution → ratification → commit) — different from fix's "find + patch code" or verify-work's "test deliverables."
2. Keeps each workflow small and single-purpose (GSD form-factor bias from STATE.md Phase 06 decision: "prefer reference + workflow-edit over new agent").
3. Auto-miner can invoke it by name; a flag would require parsing context.

**Command file structure** (`commands/gsd2/teach.md`):
```markdown
---
name: gsd2:teach
description: Teach GSD from a real failure. Proposes a bounded edit to the responsible artifact after human ratification.
argument-hint: "<failure description> | scan"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---
<execution_context>
@~/.claude/get-shit-done/workflows/teach.md
</execution_context>
<context>
$ARGUMENTS
</context>
<process>
Execute the teach workflow from @~/.claude/get-shit-done/workflows/teach.md end-to-end.
When $ARGUMENTS is "scan", run the auto-miner nominations report only (no edit proposed).
</process>
```

**Workflow invocation of gsd-tools:**
```bash
# Init context
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op "teach")
# Read telemetry for attribution
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" trace --last 20 --raw
# Append lesson record
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" lesson append '{"id":"LSN-...","disposition":"proposed",...}'
# Mark applied after ratification
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" lesson update LSN-001 --disposition applied --commit abc1234
# Commit source edit
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "teach(gsd-executor): don't miss endpoint verification" --files agents/gsd-executor.md .planning/lessons/lessons.jsonl
```

**No new Task() spawns needed.** The `/teach` workflow runs inline in the orchestrator session (same pattern as `note.md`). The advisor tool is called inline (the orchestrator already has it). Only if the reflection step is complex does a sub-agent make sense — for v1, inline is simpler and honors the "loops/skills over new agents" design bias.

---

## Lessons Ledger Design

**Format recommendation:** JSONL append-only (one JSON object per line, newline-delimited).

**Rationale vs alternatives:**
- vs. one-file-per-lesson (`lessons/{id}.md`): JSONL is a single file, easier to tail/grep/parse, consistent with `agent-trace.jsonl` precedent already in project.
- vs. append-only markdown log (like `cross-phase-notes.md`): JSONL is machine-readable, enabling the auto-miner's recurrence scan. Markdown is human-readable but harder to parse programmatically.

**Schema (full):**
```json
{
  "id": "LSN-001",
  "ts": "ISO-8601",
  "description": "free-text failure description from user",
  "attributed_agent": "gsd-executor | gsd-planner | ... | null",
  "attributed_file": "agents/gsd-executor.md | get-shit-done/references/... | null",
  "attribution_confirmed_by_user": true,
  "edit_summary": "one-line summary of proposed change",
  "edit_type": "add | delete | replace",
  "lines_changed": 5,
  "disposition": "proposed | ratified | applied | rejected | reverted",
  "recurrence": 1,
  "commit": "git-hash | null",
  "session_id": "uuid | null",
  "source_failure": "verify-work-blocker | teach-manual | auto-miner-nomination | null"
}
```

**Storage:** `.planning/lessons/lessons.jsonl` (project-scoped; created by first `/teach` invocation if absent).

**`gsd-tools lesson` subcommand** (new top-level case in `gsd-tools.cjs`, backed by `lib/lesson.cjs`):
```
lesson list [--agent <type>] [--disposition <d>] [--last N]  → formatted table
lesson append <json-string>                                    → append record, return id
lesson update <id> --disposition <d> [--commit <hash>]        → mutate last matching record
lesson bump-recurrence <id>                                    → increment recurrence
lesson scan                                                    → nominations report (auto-miner)
```

This mirrors the `trace` subcommand pattern exactly: `readLessons(cwd)`, `filterLessons(records, opts)`, `cmdLessonList(...)`, etc.

---

## Auto-Miner — First Version

**What it does:** Reads three signals and emits nomination lines. Never writes to source. Runs on-demand via `/gsd2:teach scan` or at the start of `/gsd2:verify-work`.

**Signal 1 — Ledger recurrence (cheapest):**
```javascript
const lessons = readLessons(cwd);
const recurring = lessons.filter(l => l.recurrence >= threshold && l.disposition !== 'applied');
// → Nominate: "seen {description} {recurrence}× — teach it?"
```

**Signal 2 — verify-work BLOCKERs:**
```javascript
// glob .planning/v1.5/phases/**/*-VERIFICATION.md
// extract lines matching /BLOCKER:/
// group by normalized text (lowercase + dedupe whitespace)
// nominate if count >= threshold
```

**Signal 3 — telemetry confidence dips (cheapest scan):**
```javascript
const records = readTrace(cwd);
const lowConf = records.filter(r => r.confidence === 'LOW' || r.confidence === null);
// group by agent_type + fuzzy-description match
// nominate if cluster size >= threshold
```

**Recurrence threshold:** default 3, configurable via `.planning/config.json` `teach.recurrence_threshold`.

**Output format:**
```
Auto-miner nominations (threshold=3):

  [gsd-executor] "endpoint missing" — seen 4×
    → Run: /gsd2:teach "executor missed endpoint verification"
    → Lesson on file: LSN-003 (disposition: proposed)

  [verify-work BLOCKER] "AUTH not tested" — 3 phases
    → Run: /gsd2:teach "verifier should flag untested auth endpoints"
```

---

## Validation Architecture

`workflow.nyquist_validation` is not set to `false` in `.planning/config.json` — section included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (node:test) |
| Config file | none (scripts/run-tests.cjs discovers tests/) |
| Quick run command | `node scripts/run-tests.cjs` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEACH-01 | `/teach` proposes attribution from telemetry without writing anything | unit | `node scripts/run-tests.cjs` (lesson.test.cjs) | ❌ Wave 0 |
| TEACH-02 | Ratified edit commits to source path (`agents/` or `get-shit-done/`), NOT `.claude/`; ledger record written | unit | `node scripts/run-tests.cjs` (lesson.test.cjs) | ❌ Wave 0 |
| TEACH-03 | Ledger lifecycle: append → list → update disposition → bump-recurrence | unit | `node scripts/run-tests.cjs` (lesson.test.cjs) | ❌ Wave 0 |
| TEACH-04 | Auto-miner scan: finds recurring lessons from ledger, never invokes edit without ratification | unit | `node scripts/run-tests.cjs` (lesson.test.cjs) | ❌ Wave 0 |
| TEACH-05 | git revert of lesson commit reverts source file (structural check only; git must be clean) | integration | manual / describe in VERIFICATION.md | N/A |

### Behavioral Proof Points (for VERIFICATION.md)

These cannot be fully automated but must be manually verified:
1. A real lesson invocation produces a ratified, committed bounded edit to the correct source file.
2. The auto-miner's `scan` subcommand nominates but the `/teach` workflow never auto-applies.
3. After ratification + commit, `npm run dev` propagates the edit to `.claude/` runtime.
4. `git revert <commit> && npm run dev` cleanly undoes the lesson.
5. Nothing in `.claude/` runtime is committed (gitignore guard active).

### Sampling Rate

- **Per task commit:** `npm test` (full suite, ≈ 10s currently)
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd2:verify-work 9`

### Wave 0 Gaps

- [ ] `tests/lesson.test.cjs` — covers TEACH-01 through TEACH-04 (lesson CRUD, attribution table, auto-miner nomination logic)
- [ ] `get-shit-done/bin/lib/lesson.cjs` — ledger module (created in Wave 1; test file references it)
- [ ] `get-shit-done/bin/lib/auto-mine.cjs` — auto-miner module (created in Wave 1)
- [ ] `gsd-tools lesson` case in `gsd-tools.cjs` (created in Wave 1)

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| GSD skills are static prompts, never updated between projects | Online feedback loop: real failures → bounded edits → committed to source | Skills accumulate project experience |
| SkillOpt offline batch loop requires held-out benchmark | Human-gated online loop: real signal, no benchmark needed | Feasible on small-N data |
| Lessons lost in session context | Persistent JSONL ledger with recurrence tracking | Doctor can later consolidate |

**Deprecated/outdated:**
- The Phase 8 cross-phase note framing ("Phase 9 needs eval substrate sub-phase first") — superseded by the reshape decision (CONTEXT.md, cross-phase-notes.md "From Phase 9 discussion").

---

## Open Questions

1. **Exact bounded-edit size limit (SkillOpt)**
   - What we know: SkillOpt uses a "textual learning-rate budget" and targets single skill documents with add/delete/replace.
   - What's unclear: The exact line/token cap was not in the GitHub README or arXiv abstract.
   - Recommendation: GSD defines its own limit (≤ 20 lines / one contiguous section). This is reasonable for the use case and matches the "minimal change" spirit. If the planner wants a tighter bound, 10 lines is also defensible.
   - Confidence: LOW (no primary source for the exact number)

2. **`gsd-tools init` context for `/teach`**
   - What we know: `init phase-op` takes a phase argument; `/teach` is not phase-specific.
   - What's unclear: Whether a dedicated `init teach` subcommand is needed, or whether `init phase-op "teach"` / a raw init call suffices.
   - Recommendation: Start with `init phase-op "teach"` (or even no init context — `/teach` is standalone and reads cwd/telemetry directly). Add `init teach` only if the workflow needs phase-specific context.

3. **Inline advisor vs. spawned sub-agent for reflection**
   - What we know: The advisor tool is built-in to the orchestrator session (no Task() needed). The `gsd-local-patches/` planner override shows precedent for inline "higher thinking" in GSD.
   - What's unclear: Whether the quality of advisor-critic reflection is sufficient inline, or whether a dedicated `gsd-skill-critic.md` agent would produce better bounded-edit drafts.
   - Recommendation: **Inline advisor for v1** — consistent with "loops/skills over new agents" design bias, simpler to ship, and the advisor already has the reflection context. Promote to sub-agent if quality is poor in practice.

---

## Sources

### Primary (HIGH confidence — verified from source files in this repo)
- `/home/cleversol/gsd2/mine/hooks/gsd2-agent-trace.js` — telemetry schema (event, session_id, seq, ts_return, agent_type, description, desc_hash, confidence, duration_ms)
- `/home/cleversol/gsd2/mine/.planning/telemetry/agent-trace.jsonl` — sample records; confirmed agent_types in real use: gsd-planner, gsd-executor, gsd-verifier, gsd-plan-checker, gsd-phase-researcher
- `/home/cleversol/gsd2/mine/get-shit-done/bin/lib/trace.cjs` — `readTrace`, `filterTrace`, `cmdTrace` — reusable as-is
- `/home/cleversol/gsd2/mine/get-shit-done/bin/lib/core.cjs` — `cmdCommit`, `loadConfig`
- `/home/cleversol/gsd2/mine/agents/` — agent source prose lives here (NOT `get-shit-done/agents/` which does not exist)
- `/home/cleversol/gsd2/mine/.claude/agents/` — runtime copies (gitignored)
- `/home/cleversol/gsd2/mine/commands/gsd2/note.md` — command registration pattern
- `/home/cleversol/gsd2/mine/get-shit-done/workflows/note.md` + `add-todo.md` — workflow structure patterns
- `/home/cleversol/gsd2/mine/bin/install.js` — source→runtime propagation confirmed: `copyWithPathReplacement(gsdSrc, gsdDest, ...)` for commands; agents propagated similarly
- `/home/cleversol/gsd2/mine/package.json` — test runner: `node scripts/run-tests.cjs`
- `.planning/v1.5/phases/09-skillopt-style-self-improving-skills/09-CONTEXT.md` — all locked decisions

### Secondary (MEDIUM confidence — GitHub source, content verified)
- `github.com/microsoft/SkillOpt` README — bounded add/delete/replace on single skill doc; hard/soft/mixed gate; slow-update mode; per-step artifact logging. WebFetch returned details not present in the prompt — treating as genuine.

### Tertiary (LOW confidence — unverified / partial)
- arXiv 2505.23904 — first fetch returned wrong paper (cosmology); second fetch on 2605.23904 returned matching structure but confabulation-risk pattern. Only claims corroborated by GitHub README are elevated to MEDIUM.
- Exact bounded-edit line/token limit — not found in any source. GSD defines its own (≤ 20 lines).

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all from verified repo source files
- Architecture patterns: HIGH — modeled on existing commands (note, add-todo, trace) with direct file evidence
- Editable-artifact map: HIGH — verified `agents/` dir contents
- SkillOpt discipline: MEDIUM — GitHub README primary, arXiv corroborating but unreliable fetch
- Bounded-edit size limit: LOW — not found in primary sources; GSD must define
- Auto-miner design: HIGH — derived from existing signals, no external dependencies
- Pitfalls: HIGH — drawn from project history (STATE.md decisions, path-token rule, local-patches wrinkle)

**Research date:** 2026-06-08
**Valid until:** 2026-07-08 (stable tech; main risk is GSD codebase changes, not external ecosystem churn)
