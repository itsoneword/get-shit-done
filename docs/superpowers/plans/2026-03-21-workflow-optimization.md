# GSD Workflow Optimization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce workflow file token load by 20-40% through redundancy compression, boilerplate extraction, and targeted language cleanup — without changing procedural correctness.

**Architecture:** Each workflow file is rewritten by a sub-agent that receives (1) the research context explaining WHY to change things, (2) the specific optimization principles, and (3) the file to rewrite. Sub-agent produces complete rewritten file. Files are batched into waves by priority (largest files = most token savings first).

**Key constraint:** Workflows are procedural orchestration scripts, NOT behavioral agent prompts. Step-by-step structure is validated and stays. We're compressing, not simplifying.

---

## Optimization Principles (provided to each rewriter agent)

These principles come from `docs/RESEARCH-workflow-optimization.md`:

1. **Cut redundancy, keep essential steps.** For each line ask: "Would removing this cause the orchestrator to execute incorrectly?" If not, cut it.
2. **Don't flatten to goals.** Step-by-step procedural structure stays. "Prefer general instructions" applies to reasoning tasks, not orchestration.
3. **MUST/NEVER: keep for control flow, add WHY.** "MUST execute bash before config reads" is sequencing — keep it but explain why. "You MUST present a table" is over-prompting — remove emphasis.
4. **Compress shared boilerplate.** Init blocks, runtime compatibility, agent type lists — tighten, don't repeat explanations.
5. **Critical instructions at END.** The 30% quality improvement from end-positioned instructions means success_criteria and final output steps go last.
6. **Pseudocode-with-comments for conditionals.** If/else with natural language annotations outperforms prose for conditional logic.
7. **Resolve conflicts explicitly.** When two rules can conflict, add explicit resolution rather than hoping the model infers priority.
8. **Cap emphasized constraints at ~3-5 per file.** Reserve emphasis budget for genuine control flow.
9. **Remove meta-commentary.** Lines explaining why the workflow is structured a certain way are for humans reading the source, not for the orchestrator executing it.
10. **Pass context between steps, don't repeat it.** If step 1 loaded data, step 3 shouldn't re-explain what was loaded.

### What NOT to change
- XML tag structure (`<purpose>`, `<step>`, `<process>`, `<success_criteria>`)
- Bash command blocks and their arguments
- gsd-tools.cjs CLI calls and JSON field names
- Sub-agent spawning patterns (Task/Agent calls)
- Output formatting templates shown to users
- Functional logic and branching decisions

---

## Wave 1: Heavy Hitters (700+ lines, 36% of total)

These 7 files account for 5,806 lines. Optimizing them has the highest token-savings ROI.

### Task 1: execute-phase.md (790 lines)

**Files:**
- Modify: `get-shit-done/workflows/execute-phase.md`
- Reference: `docs/RESEARCH-workflow-optimization.md`

- [ ] **Step 1: Read the current file fully**

Read `get-shit-done/workflows/execute-phase.md` end-to-end.

- [ ] **Step 2: Identify compression targets**

Key targets in this file:
- `<runtime_compatibility>` block (15 lines) — compress to essential if/else pseudocode
- `<available_agent_types>` block (16 lines) — tighten, remove "These are the valid..." preamble
- `REQUIRED — Sync chain flag with intent` block — keep constraint, add WHY, remove verbose explanation
- Copilot detection logic — consolidate with runtime_compatibility instead of separate paragraph
- Step commentary that re-explains earlier steps

- [ ] **Step 3: Spawn rewriter agent**

Spawn an Opus sub-agent with:
1. The optimization principles section from this plan
2. The full current file content
3. The research doc: `docs/RESEARCH-workflow-optimization.md`
4. Instruction: "Rewrite this workflow file applying the optimization principles. Produce the complete rewritten file. Preserve all functional behavior — every bash command, every conditional branch, every agent spawn. Compress prose, remove redundancy, add WHY to emphasized constraints, move success_criteria to end. Target 20-40% line reduction."

- [ ] **Step 4: Review rewritten file**

Verify:
- All bash commands preserved
- All conditional branches preserved
- Sub-agent spawning logic intact
- success_criteria at end
- Line count reduced 20-40%

- [ ] **Step 5: Write the rewritten file**

- [ ] **Step 6: Commit**

```bash
git add get-shit-done/workflows/execute-phase.md
git commit -m "optimize execute-phase workflow (-N%)"
```

### Task 2: new-project.md (1152 lines)

**Files:**
- Modify: `get-shit-done/workflows/new-project.md`

Same approach as Task 1. This is the largest file — likely has the most redundancy.

- [ ] **Step 1: Read file fully**
- [ ] **Step 2: Identify compression targets**
- [ ] **Step 3: Spawn rewriter agent** (same principles + research doc)
- [ ] **Step 4: Review rewritten file**
- [ ] **Step 5: Write the rewritten file**
- [ ] **Step 6: Commit**

### Task 3: discuss-phase.md (846 lines)

**Files:**
- Modify: `get-shit-done/workflows/discuss-phase.md`

Extra care: this file contains the specialist-in-the-loop feature (micro-research spawning). Preserve the `<question_triage>` logic and signal strength definitions exactly.

- [ ] **Step 1-6:** Same pattern as Task 1

### Task 4: plan-phase.md (778 lines)

**Files:**
- Modify: `get-shit-done/workflows/plan-phase.md`

Has 13 MUST/CRITICAL instances — highest aggressive language density. Good candidate for emphasis cleanup.

- [ ] **Step 1-6:** Same pattern as Task 1

### Task 5: complete-milestone.md (766 lines)

**Files:**
- Modify: `get-shit-done/workflows/complete-milestone.md`

- [ ] **Step 1-6:** Same pattern as Task 1

### Task 6: autonomous.md (743 lines)

**Files:**
- Modify: `get-shit-done/workflows/autonomous.md`

Has 10 gsd-tools.cjs references — likely has repeated init boilerplate.

- [ ] **Step 1-6:** Same pattern as Task 1

### Task 7: quick.md (731 lines)

**Files:**
- Modify: `get-shit-done/workflows/quick.md`

- [ ] **Step 1-6:** Same pattern as Task 1

### Wave 1 Checkpoint

- [ ] **Verify wave 1 results**

```bash
# Compare before/after line counts
wc -l get-shit-done/workflows/execute-phase.md get-shit-done/workflows/new-project.md get-shit-done/workflows/discuss-phase.md get-shit-done/workflows/plan-phase.md get-shit-done/workflows/complete-milestone.md get-shit-done/workflows/autonomous.md get-shit-done/workflows/quick.md
```

Expected: 20-40% reduction from 5,806 total → target 3,500-4,600 lines.

---

## Wave 2: Mid-Size (400-623 lines, 22% of total)

7 files, 3,537 lines. Same per-file approach.

### Task 8: verify-work.md (623 lines)
### Task 9: help.md (604 lines)
### Task 10: transition.md (584 lines)
### Task 11: execute-plan.md (495 lines)
### Task 12: profile-user.md (450 lines)
### Task 13: progress.md (438 lines)
### Task 14: new-milestone.md (437 lines)

Each task follows the same pattern: read → spawn rewriter agent → review → write → commit.

### Wave 2 Checkpoint

- [ ] **Verify wave 2 results** — target 2,100-2,800 from 3,537

---

## Wave 3: Small-to-Medium (200-400 lines)

13 files, 3,607 lines. These can be batched more aggressively — spawn 3-4 rewriter agents in parallel.

### Task 15-27: Batch rewrite

Files: `map-codebase.md` (370), `add-tests.md` (351), `audit-milestone.md` (332), `resume-project.md` (325), `update.md` (323), `ui-phase.md` (290), `discovery-phase.md` (289), `plan-milestone-gaps.md` (274), `settings.md` (272), `verify-phase.md` (254), `ship.md` (228), `review.md` (228), `diagnose-issues.md` (219)

- [ ] **Batch 3a:** 4 files in parallel (map-codebase, add-tests, audit-milestone, resume-project)
- [ ] **Batch 3b:** 4 files in parallel (update, ui-phase, discovery-phase, plan-milestone-gaps)
- [ ] **Batch 3c:** 5 files in parallel (settings, verify-phase, ship, review, diagnose-issues)

### Wave 3 Checkpoint

- [ ] **Verify wave 3 results** — target 2,200-2,900 from 3,607

---

## Wave 4: Small Files (under 200 lines)

22 files, 3,226 lines. Many of these are already lean. Light-touch pass only — don't over-optimize simple workflows.

### Task 28-49: Light-touch batch

Files: `health.md` (181), `list-phase-assumptions.md` (178), `check-todos.md` (177), `pause-work.md` (176), `plant-seed.md` (169), `validate-phase.md` (167), `add-todo.md` (158), `ui-review.md` (157), `note.md` (156), `remove-phase.md` (155), `cleanup.md` (152), `session-report.md` (146), `insert-phase.md` (130), `pr-branch.md` (129), `add-phase.md` (112), `audit-uat.md` (109), `fast.md` (105), `do.md` (104), `next.md` (97), `node-repair.md` (92), `research-phase.md` (74), `stats.md` (60)

**Approach:** Spawn 4 parallel agents, each handling ~5-6 files. Light-touch: remove obvious redundancy, add WHY to any emphasized constraints, but don't restructure files under 120 lines unless there's clear waste.

- [ ] **Batch 4a:** 6 files in parallel
- [ ] **Batch 4b:** 6 files in parallel
- [ ] **Batch 4c:** 5 files in parallel
- [ ] **Batch 4d:** 5 files in parallel

### Wave 4 Checkpoint

- [ ] **Verify wave 4 results** — target 2,400-2,900 from 3,226 (lighter reduction expected)

---

## Final Verification

- [ ] **Step 1: Total line count comparison**

```bash
wc -l get-shit-done/workflows/*.md | tail -1
```

Target: 10,000-12,500 from 16,176 (20-40% reduction)

- [ ] **Step 2: Verify no functional regression**

Check that key patterns are preserved across all files:
```bash
# All init blocks still present
grep -l "gsd-tools.cjs.*init" get-shit-done/workflows/*.md | wc -l

# All success_criteria blocks present
grep -l "success_criteria" get-shit-done/workflows/*.md | wc -l

# All process blocks present
grep -l "<process>" get-shit-done/workflows/*.md | wc -l
```

- [ ] **Step 3: Commit final batch and tag**

```bash
git commit -m "optimize all 49 workflow files (-N% total lines)"
```

- [ ] **Step 4: Update project memory**

Update `project_gsd_framework.md` memory file:
- Mark "workflow optimization" as done
- Record actual line reduction achieved
- Bump version reference to 1.2.0
