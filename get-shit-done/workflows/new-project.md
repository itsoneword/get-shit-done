<purpose>
Initialize a new project: questioning, research (optional), requirements, roadmap. From idea to ready-for-planning in one workflow.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<auto_mode>
## Auto Mode Detection

Check if `--auto` flag is present in $ARGUMENTS.

**If auto mode:**
- Skip brownfield mapping (assume greenfield), skip deep questioning (extract from document)
- YOLO implicit; ask granularity/git/agents FIRST (Step 2a)
- After config: run Steps 6-9 with smart defaults (research=yes, auto-approve requirements + roadmap)

**Document requirement:** Auto mode requires an idea document — file reference or pasted text.

If no document provided, error:
```
Error: --auto requires an idea document.

Usage:
  /gsd2:new-project --auto @your-idea.md
  /gsd2:new-project --auto [paste or write your idea here]

The document should describe what you want to build.
```
</auto_mode>

<process>

## 1. Setup

**MANDATORY FIRST STEP — Execute before ANY user interaction:**

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init new-project)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON for: `researcher_model`, `synthesizer_model`, `roadmapper_model`, `commit_docs`, `project_exists`, `has_codebase_map`, `planning_exists`, `has_existing_code`, `has_package_file`, `is_brownfield`, `needs_codebase_map`, `has_git`, `project_path`.

- **If `project_exists`:** Error — already initialized. Use `/gsd2:progress`.
- **If `has_git` is false:** `git init`

## 2. Brownfield Offer

**If auto mode:** Skip to Step 4.

**If `needs_codebase_map`** (existing code, no map):

AskUserQuestion: header="Codebase", question="I detected existing code. Map codebase first?"
- "Map codebase first" — Run `/gsd2:map-codebase`, then exit.
- "Skip mapping" — Continue to Step 3.

## 2a. Auto Mode Config (auto mode only)

YOLO implicit. Ask remaining config in 2 rounds:

**Round 1 — Core settings:**

**Granularity (AI-recommended):** Analyze the provided document's scope and complexity, then recommend a granularity with brief reasoning (same approach as Step 5 manual mode). Present as plain text recommendation, let user confirm or adjust.

```
AskUserQuestion([
  { header: "Execution", question: "Run plans in parallel?", multiSelect: false,
    options: [
      { label: "Parallel (Recommended)", description: "Independent plans run simultaneously" },
      { label: "Sequential", description: "One plan at a time" }
    ] },
  { header: "Git Tracking", question: "Commit planning docs to git?", multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Planning docs tracked in version control" },
      { label: "No", description: "Keep .planning/ local-only (add to .gitignore)" }
    ] }
])
```

**Round 2 — Workflow agents:**

```
AskUserQuestion([
  { header: "Research", question: "Research before planning each phase? (adds tokens/time)", multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Investigate domain, find patterns, surface gotchas" },
      { label: "No", description: "Plan directly from requirements" }
    ] },
  { header: "Plan Check", question: "Verify plans will achieve their goals? (adds tokens/time)", multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Catch gaps before execution starts" },
      { label: "No", description: "Execute plans without verification" }
    ] },
  { header: "Verifier", question: "Verify work satisfies requirements after each phase? (adds tokens/time)", multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Confirm deliverables match phase goals" },
      { label: "No", description: "Trust execution, skip verification" }
    ] },
  { header: "AI Models", question: "Which AI models for planning agents?", multiSelect: false,
    options: [
      { label: "Balanced (Recommended)", description: "Sonnet for most agents — good quality/cost ratio" },
      { label: "Quality", description: "Opus for research/roadmap — higher cost, deeper analysis" },
      { label: "Budget", description: "Haiku where possible — fastest, lowest cost" },
      { label: "Inherit", description: "Use the current session model for all agents (OpenCode /model)" }
    ] }
])
```

Create `.planning/config.json`:
```json
{
  "mode": "yolo",
  "granularity": "[selected]",
  "parallelization": true|false,
  "commit_docs": true|false,
  "model_profile": "quality|balanced|budget|inherit",
  "workflow": {
    "research": true|false,
    "plan_check": true|false,
    "verifier": true|false,
    "nyquist_validation": depth !== "quick",
    "auto_advance": true
  }
}
```

If commit_docs=No: add `.planning/` to `.gitignore`.

```bash
mkdir -p .planning
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "chore: add project config" --files .planning/config.json
```

Persist auto-advance flag (survives context compaction):
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-set workflow._auto_chain_active true
```

Proceed to Step 4 (skip Steps 3, 5).

## 3. Deep Questioning

**If auto mode:** Skip — extract from document, proceed to Step 4.

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► QUESTIONING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Ask inline (freeform, NOT AskUserQuestion): "What do you want to build?"

Wait for response, then follow threads with AskUserQuestion probes.

**Research-before-questions:** If `research_questions` enabled in config, do brief web searches and weave findings into questions naturally.

**Follow threads:** Each answer opens new threads. Probe excitement, problem origin, vague terms, concrete examples, what's decided. Consult `questioning.md` for techniques (challenge vagueness, surface assumptions, find edges, reveal motivation).

**Context check (internal):** Track `questioning.md` checklist mentally. Weave gaps into conversation naturally.

**Decision gate:** When you could write PROJECT.md, AskUserQuestion: header="Ready?", "Create PROJECT.md" / "Keep exploring". Loop until "Create PROJECT.md".

## 4. Write PROJECT.md

**If auto mode:** Synthesize from document directly, no gate.

Write `.planning/PROJECT.md` using `templates/project.md`.

**Greenfield:**
```markdown
## Requirements

### Validated
(None yet — ship to validate)

### Active
- [ ] [Requirement 1]
- [ ] [Requirement 2]

### Out of Scope
- [Exclusion 1] — [why]
```

**Brownfield (codebase map exists):** Read `.planning/codebase/ARCHITECTURE.md` and `STACK.md`, infer Validated from existing capabilities:
```markdown
### Validated
- ✓ [Existing capability 1] — existing

### Active
- [ ] [New requirement 1]

### Out of Scope
- [Exclusion 1] — [why]
```

**Key Decisions:** Initialize from questioning:
```markdown
## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| [Choice] | [Why] | — Pending |
```

**Footer:** `*Last updated: [date] after initialization*`

**Evolution section** (end of PROJECT.md, before footer):
```markdown
## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd2:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd2:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state
```

Do not compress. Capture everything gathered.

```bash
mkdir -p .planning
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs: initialize project" --files .planning/PROJECT.md
```

## 5. Workflow Preferences

**If auto mode:** Skip — config collected in Step 2a. Go to Step 5.5.

**Check `~/.gsd/defaults.json`:** If exists, offer to use saved defaults:
```
AskUserQuestion([
  { question: "Use your saved default settings? (from ~/.gsd/defaults.json)", header: "Defaults", multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Use saved defaults, skip settings questions" },
      { label: "No", description: "Configure settings manually" }
    ] }
])
```
If "Yes": use those values, skip to **Commit config.json** below.

**Round 1 — Core settings:**

**Step 1: Mode**
```
AskUserQuestion([
  { header: "Mode", question: "How do you want to work?", multiSelect: false,
    options: [
      { label: "YOLO (Recommended)", description: "Auto-approve, just execute" },
      { label: "Interactive", description: "Confirm at each step" }
    ] }
])
```

**Step 2: Granularity (AI-recommended)**

Based on what you learned about the project during questioning (scope, complexity, number of features, technical domains involved), recommend a granularity level with reasoning:

```
"Based on what we discussed, I'd recommend **[Coarse/Standard/Fine]** granularity for this project.

**Why:** [1-2 sentences explaining the reasoning — e.g., "This is a focused project with 3 main features and a single technical domain, so fewer broader phases will avoid overhead" or "This has multiple independent subsystems (auth, API, UI, data pipeline) that benefit from dedicated phases"]

- **Coarse** — 3-5 phases, 1-3 plans each (best for focused projects, single domain)
- **Standard** — 5-8 phases, 3-5 plans each (balanced, multiple features)
- **Fine** — 8-12 phases, 5-10 plans each (complex systems, many independent parts)

Does that work, or would you prefer a different level?"
```

Let the user confirm or pick differently via plain text. Don't use AskUserQuestion for this — the reasoning context matters more than a quick menu pick.

**Step 3: Execution + Git**
```
AskUserQuestion([
  { header: "Execution", question: "Run plans in parallel?", multiSelect: false,
    options: [
      { label: "Parallel (Recommended)", description: "Independent plans run simultaneously" },
      { label: "Sequential", description: "One plan at a time" }
    ] },
  { header: "Git Tracking", question: "Commit planning docs to git?", multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Planning docs tracked in version control" },
      { label: "No", description: "Keep .planning/ local-only (add to .gitignore)" }
    ] }
])
```

**Round 2 — Workflow agents:**

```
questions: [
  { header: "Research", question: "Research before planning each phase? (adds tokens/time)", multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Investigate domain, find patterns, surface gotchas" },
      { label: "No", description: "Plan directly from requirements" }
    ] },
  { header: "Plan Check", question: "Verify plans will achieve their goals? (adds tokens/time)", multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Catch gaps before execution starts" },
      { label: "No", description: "Execute plans without verification" }
    ] },
  { header: "Verifier", question: "Verify work satisfies requirements after each phase? (adds tokens/time)", multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Confirm deliverables match phase goals" },
      { label: "No", description: "Trust execution, skip verification" }
    ] },
  { header: "AI Models", question: "Which AI models for planning agents?", multiSelect: false,
    options: [
      { label: "Balanced (Recommended)", description: "Sonnet for most agents — good quality/cost ratio" },
      { label: "Quality", description: "Opus for research/roadmap — higher cost, deeper analysis" },
      { label: "Budget", description: "Haiku where possible — fastest, lowest cost" },
      { label: "Inherit", description: "Use the current session model for all agents (OpenCode /model)" }
    ] }
]
```

Create `.planning/config.json`:
```json
{
  "mode": "yolo|interactive",
  "granularity": "coarse|standard|fine",
  "parallelization": true|false,
  "commit_docs": true|false,
  "model_profile": "quality|balanced|budget|inherit",
  "workflow": {
    "research": true|false,
    "plan_check": true|false,
    "verifier": true|false,
    "nyquist_validation": depth !== "quick"
  }
}
```

If commit_docs=No: add `.planning/` to `.gitignore`.

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "chore: add project config" --files .planning/config.json
```

Run `/gsd2:settings` anytime to update.

## 5.5. Resolve Model Profile

Use models from init: `researcher_model`, `synthesizer_model`, `roadmapper_model`.

## 6. Research Decision

**If auto mode:** Default to "Research first" without asking.

AskUserQuestion: header="Research", question="Research the domain ecosystem before defining requirements?"
- "Research first (Recommended)" — Discover stacks, features, architecture patterns
- "Skip research" — Go straight to requirements

**If "Research first":**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► RESEARCHING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Researching [domain] ecosystem...
```

```bash
mkdir -p .planning/research
```

**Milestone context:** No Validated requirements in PROJECT.md → greenfield; otherwise → subsequent milestone.

```
◆ Spawning 4 researchers in parallel...
  → Stack / Features / Architecture / Pitfalls
```

Spawn 4 parallel gsd-project-researcher agents. Each receives:
- `<research_type>` identifying its dimension (Stack/Features/Architecture/Pitfalls)
- `<milestone_context>` with greenfield vs subsequent framing
- `<question>` with the core research question
- `<files_to_read>` pointing to `{project_path}`
- `<downstream_consumer>` explaining how output feeds into later steps
- `<quality_gate>` with verification checklist
- `<output>` with write path and template reference

**Stack researcher:**
```
Task(prompt="<research_type>Project Research — Stack dimension for [domain].</research_type>
<milestone_context>[greenfield OR subsequent] context</milestone_context>
<question>What's the standard 2025 stack for [domain]?</question>
<files_to_read>- {project_path}</files_to_read>
<downstream_consumer>Your STACK.md feeds into roadmap creation. Be prescriptive: specific libraries with versions, clear rationale, what NOT to use.</downstream_consumer>
<quality_gate>- [ ] Versions current (verify with Context7/docs) - [ ] Rationale explains WHY - [ ] Confidence levels assigned</quality_gate>
<output>Write to: .planning/research/STACK.md
Use template: ~/.claude/get-shit-done/templates/research-project/STACK.md</output>
", subagent_type="gsd-project-researcher", model="{researcher_model}", description="Stack research")
```

**Features researcher:**
```
Task(prompt="<research_type>Project Research — Features dimension for [domain].</research_type>
<milestone_context>[greenfield OR subsequent] context</milestone_context>
<question>What features do [domain] products have? Table stakes vs differentiating?</question>
<files_to_read>- {project_path}</files_to_read>
<downstream_consumer>Your FEATURES.md feeds into requirements. Categorize: table stakes, differentiators, anti-features.</downstream_consumer>
<quality_gate>- [ ] Categories clear - [ ] Complexity noted - [ ] Dependencies identified</quality_gate>
<output>Write to: .planning/research/FEATURES.md
Use template: ~/.claude/get-shit-done/templates/research-project/FEATURES.md</output>
", subagent_type="gsd-project-researcher", model="{researcher_model}", description="Features research")
```

**Architecture researcher:**
```
Task(prompt="<research_type>Project Research — Architecture dimension for [domain].</research_type>
<milestone_context>[greenfield OR subsequent] context</milestone_context>
<question>How are [domain] systems structured? Major components?</question>
<files_to_read>- {project_path}</files_to_read>
<downstream_consumer>Your ARCHITECTURE.md informs phase structure. Include: component boundaries, data flow, suggested build order.</downstream_consumer>
<quality_gate>- [ ] Components defined with boundaries - [ ] Data flow explicit - [ ] Build order noted</quality_gate>
<output>Write to: .planning/research/ARCHITECTURE.md
Use template: ~/.claude/get-shit-done/templates/research-project/ARCHITECTURE.md</output>
", subagent_type="gsd-project-researcher", model="{researcher_model}", description="Architecture research")
```

**Pitfalls researcher:**
```
Task(prompt="<research_type>Project Research — Pitfalls dimension for [domain].</research_type>
<milestone_context>[greenfield OR subsequent] context</milestone_context>
<question>What do [domain] projects commonly get wrong?</question>
<files_to_read>- {project_path}</files_to_read>
<downstream_consumer>Your PITFALLS.md prevents mistakes. For each: warning signs, prevention strategy, which phase should address it.</downstream_consumer>
<quality_gate>- [ ] Domain-specific (not generic) - [ ] Prevention actionable - [ ] Phase mapping included</quality_gate>
<output>Write to: .planning/research/PITFALLS.md
Use template: ~/.claude/get-shit-done/templates/research-project/PITFALLS.md</output>
", subagent_type="gsd-project-researcher", model="{researcher_model}", description="Pitfalls research")
```

After all 4 complete, spawn synthesizer:

```
Task(prompt="<task>Synthesize research outputs into SUMMARY.md.</task>
<files_to_read>
- .planning/research/STACK.md
- .planning/research/FEATURES.md
- .planning/research/ARCHITECTURE.md
- .planning/research/PITFALLS.md
</files_to_read>
<output>Write to: .planning/research/SUMMARY.md
Use template: ~/.claude/get-shit-done/templates/research-project/SUMMARY.md
Commit after writing.</output>
", subagent_type="gsd-research-synthesizer", model="{synthesizer_model}", description="Synthesize research")
```

Display completion:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► RESEARCH COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Key Findings

**Stack:** [from SUMMARY.md]
**Table Stakes:** [from SUMMARY.md]
**Watch Out For:** [from SUMMARY.md]

Files: `.planning/research/`
```

**If "Skip research":** Continue to Step 7.

## 7. Define Requirements

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► DEFINING REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Read PROJECT.md — extract core value, constraints, scope boundaries.
If research exists: read FEATURES.md for feature categories.

**If auto mode:** Auto-include table stakes + document-mentioned features, defer unmentioned differentiators, skip all interactive gates, generate and commit REQUIREMENTS.md directly.

**Interactive mode — present features by category:**

```
Here are the features for [domain]:

## Authentication
**Table stakes:** [list]
**Differentiators:** [list]
**Research notes:** [notes]

## [Next Category]
...
```

**If no research:** Gather through conversation — "What are the main things users need to do?" Clarify, probe related capabilities, group into categories.

**Scope each category** via AskUserQuestion (multiSelect=true):
- header: "[Category]" (max 12 chars)
- question: "Which [category] features are in v1?"
- Selected → v1 requirements; unselected table stakes → v2; unselected differentiators → out of scope

**Identify gaps:** AskUserQuestion: "Any requirements research missed?" — "No" / "Yes, let me add some"

**Validate core value:** Cross-check requirements against Core Value. Surface gaps.

**Generate REQUIREMENTS.md** with: v1 grouped by category (checkboxes, REQ-IDs), v2 deferred, Out of Scope with reasoning, empty Traceability section.

**REQ-ID format:** `[CATEGORY]-[NUMBER]` (AUTH-01, CONTENT-02)

**MUST: Requirements must be specific/testable, user-centric, atomic, independent.** WHY: Vague requirements cascade into vague plans and wasted execution cycles.

**Present full list (interactive only):** Show every requirement for confirmation. If "adjust": loop back.

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs: define v1 requirements" --files .planning/REQUIREMENTS.md
```

## 8. Create Roadmap

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► CREATING ROADMAP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning roadmapper...
```

```
Task(prompt="
<planning_context>
<files_to_read>
- .planning/PROJECT.md
- .planning/REQUIREMENTS.md
- .planning/research/SUMMARY.md (if exists)
- .planning/config.json
</files_to_read>
</planning_context>

<instructions>
Create roadmap:
1. Derive phases from requirements (don't impose structure)
2. Map every v1 requirement to exactly one phase
3. Derive 2-5 success criteria per phase (observable user behaviors)
4. Validate 100% coverage
5. Write files immediately (ROADMAP.md, STATE.md, update REQUIREMENTS.md traceability)
6. Return ROADMAP CREATED with summary

Write files first, then return — ensures artifacts persist if context is lost.
</instructions>
", subagent_type="gsd-roadmapper", model="{roadmapper_model}", description="Create roadmap")
```

**If `## ROADMAP BLOCKED`:** Present blockers, resolve with user, re-spawn.

**If `## ROADMAP CREATED`:** Read ROADMAP.md and present inline:

```
## Proposed Roadmap

**[N] phases** | **[X] requirements mapped** | All v1 requirements covered ✓

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | [Name] | [Goal] | [REQ-IDs] | [count] |
...

### Phase Details

**Phase 1: [Name]**
Goal: [goal]
Requirements: [REQ-IDs]
Success criteria:
1. [criterion]
...
```

**If auto mode:** Skip approval, commit directly.

**Interactive — MUST ask approval before committing:** WHY: Roadmap structure drives all downstream execution.

AskUserQuestion: header="Roadmap", "Does this structure work?"
- "Approve" — commit
- "Adjust phases" — get notes, re-spawn roadmapper with revision context, loop until approved
- "Review full file" — show raw ROADMAP.md, re-ask

**Generate CLAUDE.md before final commit:**
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" generate-claude-md
```

**Commit roadmap:**
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs: create roadmap ([N] phases)" --files .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md CLAUDE.md
```

## 9. Done

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PROJECT INITIALIZED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**[Project Name]**

| Artifact       | Location                    |
|----------------|-----------------------------|
| Project        | `.planning/PROJECT.md`      |
| Config         | `.planning/config.json`     |
| Research       | `.planning/research/`       |
| Requirements   | `.planning/REQUIREMENTS.md` |
| Roadmap        | `.planning/ROADMAP.md`      |
| Project guide  | `CLAUDE.md`                 |

**[N] phases** | **[X] requirements** | Ready to build ✓
```

**If auto mode:**
```
╔══════════════════════════════════════════╗
║  AUTO-ADVANCING → DISCUSS PHASE 1        ║
╚══════════════════════════════════════════╝
```
Exit skill and invoke SlashCommand("/gsd2:discuss-phase 1 --auto")

**If interactive:**
```
───────────────────────────────────────────────────────────────

## ▶ Next Up

**Phase 1: [Phase Name]** — [Goal from ROADMAP.md]

/gsd2:discuss-phase 1 — gather context and clarify approach

<sub>/clear first → fresh context window</sub>

---

**Also available:**
- /gsd2:plan-phase 1 — skip discussion, plan directly

───────────────────────────────────────────────────────────────
```

</process>

<output>
- `.planning/PROJECT.md`
- `.planning/config.json`
- `.planning/research/` (if research selected): STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md, SUMMARY.md
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `CLAUDE.md`
</output>

<success_criteria>
- [ ] Git repo initialized, .planning/ created
- [ ] Brownfield detection completed
- [ ] Deep questioning completed (threads followed, not rushed)
- [ ] PROJECT.md captures full context → **committed**
- [ ] config.json has mode, granularity, parallelization → **committed**
- [ ] Research completed if selected (4 parallel agents + synthesizer) → **committed**
- [ ] Requirements gathered, user scoped each category, REQUIREMENTS.md with REQ-IDs → **committed**
- [ ] Roadmapper spawned, files written immediately, user feedback incorporated
- [ ] ROADMAP.md with phases/mappings/criteria, STATE.md initialized, traceability updated
- [ ] CLAUDE.md generated
- [ ] User knows next step: `/gsd2:discuss-phase 1`

**MUST: Atomic commits — each step commits its artifacts immediately.** WHY: If context is lost, artifacts persist.
</success_criteria>
