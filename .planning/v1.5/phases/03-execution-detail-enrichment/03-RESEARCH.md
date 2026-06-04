# Phase 3: Execution-Detail Enrichment - Research

**Researched:** 2026-06-04
**Domain:** Tooling / Reference-doc phase — new prose docs under `references/` + wiring into existing workflows
**Confidence:** HIGH

## Summary

Phase 3 is GUIDE-only (context-budget cluster reshaped out): create two reference docs (`universal-anti-patterns.md` and `common-bug-patterns.md`) and wire them into the planner and verifier via a hybrid loading scheme. The source docs exist on disk at `/home/cleversol/gsd2/core/gsd-core/references/` and have been read. This phase is a faithful port-plus-extend: the universal anti-patterns doc stays in the planner's on-demand path; the bug-patterns doc is eager-loaded by the verifier. Python content is added to both docs under a dedicated section.

**Primary recommendation:** Port the three gsd-core source docs faithfully, fold `planner-antipatterns.md` content into `universal-anti-patterns.md` as a subsection (not a third doc), add Python sections to each, and wire by (a) adding an on-demand pointer into `agents/gsd-planner.md` and (b) adding an eager `@`-load line into `workflows/verify-phase.md` — in BOTH source and runtime trees.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- Docs land in `.claude/get-shit-done/references/` (codebase convention; also mirrored in source tree `get-shit-done/references/`).
- Port from gsd-core: a universal anti-patterns doc + a common bug-patterns doc. Pure prose, no runtime deps.
- Python content covers idioms, anti-patterns, and typing conventions.
- **HYBRID loading:** Verifier eager-loads (`@/abs/path`) the bug-pattern doc. Planner references the anti-pattern doc on-demand ("Read /abs/path when relevant", mirroring `tdd.md`).

### Claude's Discretion

- Section ordering and exact prose within each doc.
- Target length per doc (must be concise for eager-load safety).
- Exact wording of the on-demand pointer in the planner agent.

### Deferred Ideas (OUT OF SCOPE)

- Context-budget cluster (CTX-01, CTX-02) — reshaped to "doctor" phase.
- Creating a third standalone `planner-antipatterns.md` doc — fold into universal-anti-patterns.md instead.
- Any runtime tooling (classifiers, CLI commands) — pure prose only.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GUIDE-01 | Anti-pattern / bug-pattern reference docs exist and are read by the planner/verifier ("what good and bad code looks like") | Source docs verified on disk; wiring points confirmed in both workflows; hybrid loading strategy documented below |
| GUIDE-02 | Good-practices guidance includes Python-specific content | Python section content scoped below: bug-patterns doc gets a tight Python-bug subsection; anti-patterns doc gets the fuller Python idioms + typing conventions section |

</phase_requirements>

---

## Source Doc Status

The gsd-core source docs are present on disk and have been read:

| Source file | Location | Lines | Will become |
|-------------|----------|-------|-------------|
| `universal-anti-patterns.md` | `/home/cleversol/gsd2/core/gsd-core/references/universal-anti-patterns.md` | 64 lines | `references/universal-anti-patterns.md` (extend with Python + fold planner-antipatterns content) |
| `common-bug-patterns.md` | `/home/cleversol/gsd2/core/gsd-core/references/common-bug-patterns.md` | 115 lines | `references/common-bug-patterns.md` (extend with Python bug subsection) |
| `planner-antipatterns.md` | `/home/cleversol/gsd2/core/gsd-core/references/planner-antipatterns.md` | 89 lines | Fold as `## Planner Anti-Patterns` subsection inside `universal-anti-patterns.md` — NOT a third file |

**Confidence:** HIGH — primary sources verified, content read directly.

---

## Wiring Points (Confirmed)

### Dual-tree rule (established, Phase 04-01 decision in STATE.md)

Every workflow/agent edit must be made in **both** trees and kept byte-identical. Only the source tree is committed; the runtime tree (`.claude/`) is gitignored.

| Tree | Path |
|------|------|
| Source | `get-shit-done/…` |
| Runtime | `.claude/get-shit-done/…` (gitignored) |

### Bug-pattern doc — Verifier eager-load (GUIDE-01)

**File:** `get-shit-done/workflows/verify-phase.md` **and** `.claude/get-shit-done/workflows/verify-phase.md`

Insertion point: inside the `<required_reading>` block. Current state of that block (lines 20-23):

```
<required_reading>
@/home/cleversol/gsd2/mine/.claude/get-shit-done/references/verification-patterns.md
@/home/cleversol/gsd2/mine/.claude/get-shit-done/templates/verification-report.md
</required_reading>
```

Add a third line:

```
@/home/cleversol/gsd2/mine/.claude/get-shit-done/references/common-bug-patterns.md
```

Result:

```
<required_reading>
@/home/cleversol/gsd2/mine/.claude/get-shit-done/references/verification-patterns.md
@/home/cleversol/gsd2/mine/.claude/get-shit-done/references/common-bug-patterns.md
@/home/cleversol/gsd2/mine/.claude/get-shit-done/templates/verification-report.md
</required_reading>
```

**Absolute path convention confirmed:** existing references use `/home/cleversol/gsd2/mine/.claude/get-shit-done/references/…`. New doc uses the same pattern.

### Anti-pattern doc — Planner on-demand pointer (GUIDE-01)

**File:** `agents/gsd-planner.md` **and** `.claude/agents/gsd-planner.md`

Do NOT add to `plan-phase.md` — the plan-phase.md file constructs a prompt for the gsd-planner agent; any text added outside the constructed `<planning_context>` block never reaches the agent. The `gsd-planner.md` agent definition is the agent's system prompt and is guaranteed to be in context on every spawn path (standard, `--gaps`, revision).

**Insertion point:** After `<discovery_levels>` block (around line 71 of `agents/gsd-planner.md`), before `<task_design>`. This is where planner behavioral rules naturally live. Add a new block:

```xml
<code_quality_reference>
When making code-quality judgments, choosing between patterns, or flagging anti-patterns in plans:
Read /home/cleversol/gsd2/mine/.claude/get-shit-done/references/universal-anti-patterns.md

Skip if the phase is trivial glue code with no design decisions.
</code_quality_reference>
```

**Why this location:** Sits between discovery rules and task design rules — the point where the planner is deciding HOW to design tasks, not yet writing them. Matches the on-demand idiom used by `execute-plan.md:194` for `tdd.md`.

**Why gsd-planner.md, not plan-phase.md:** The plan-phase.md prompt block (lines 460-481) passes `<files_to_read>` to the spawned agent. Adding the anti-pattern doc there would make it eager (loaded on every planning run), violating the hybrid strategy. The agent definition guarantees reach across all spawn paths without forcing the load.

### New doc file paths

| File | Source path | Runtime path | Absolute path for directives |
|------|-------------|--------------|------------------------------|
| `universal-anti-patterns.md` | `get-shit-done/references/universal-anti-patterns.md` | `.claude/get-shit-done/references/universal-anti-patterns.md` | `/home/cleversol/gsd2/mine/.claude/get-shit-done/references/universal-anti-patterns.md` |
| `common-bug-patterns.md` | `get-shit-done/references/common-bug-patterns.md` | `.claude/get-shit-done/references/common-bug-patterns.md` | `/home/cleversol/gsd2/mine/.claude/get-shit-done/references/common-bug-patterns.md` |

---

## Content Taxonomy

### Doc 1: `common-bug-patterns.md` (eager-loaded by verifier)

**Target length:** ~130-150 lines (port = 115 lines; add ~20 lines Python section). This doc is eager-loaded on every verify run — brevity is a hard constraint.

**Section outline:**

```
# Common Bug Patterns

[one-line purpose: checklist of frequent patterns before forming hypotheses]

## Null / Undefined Access          (port verbatim)
## Off-by-One / Boundary            (port verbatim)
## Async / Timing                   (port verbatim)
## State Management                 (port verbatim)
## Import / Module                  (port verbatim)
## Type / Coercion                  (port verbatim)
## Environment / Config             (port verbatim)
## Data Shape / API Contract        (port verbatim)
## Regex / String                   (port verbatim)
## Error Handling                   (port verbatim)
## Scope / Closure                  (port verbatim)

## Python-Specific Bugs             (NEW — ~20 lines)
  - Mutable default argument        (def f(x=[]) → shared state across calls)
  - Late-binding closures           (loop variable captured by reference)
  - `is` vs `==` for equality       (works for small ints, fails for strings)
  - Implicit `None` return          (missing return in a branch returns None silently)
  - Bare `except:` swallowing       (catches KeyboardInterrupt and SystemExit)
  - Generator exhaustion            (iterating a generator twice — second is empty)
  - Shallow copy vs deep copy       (list[:] / dict.copy() don't deep-copy nested)
  - Integer division in Python 2    (not applicable to new projects, skip or note as historical)

## How to Use This Checklist       (port verbatim — symptom-to-category quick map)
```

**Note:** The Python section covers Python-specific BUG patterns only — not idioms or typing conventions. Those go in the anti-patterns doc (GUIDE-02 coverage is split across both docs by design: bugs in bug-patterns.md, good-practices in anti-patterns.md).

### Doc 2: `universal-anti-patterns.md` (on-demand by planner)

**Target length:** ~150-200 lines (port = 64 lines + fold planner-antipatterns.md ~89 lines + Python section ~40 lines; expect overlap/dedup to keep this range). This doc is on-demand — slightly more content is acceptable, but still lean.

**Section outline:**

```
# Universal Anti-Patterns

[one-line purpose: rules for ALL workflows; planner reads on-demand for code-quality decisions]

## Context Budget Rules             (port verbatim — rules 1-5)
## File Reading Rules               (port verbatim — rules 6-9)
## Subagent Rules                   (port verbatim — rules 10-11)
## Questioning Anti-Patterns        (port verbatim — rules 12-14)
## State Management Anti-Patterns   (port verbatim — rule 15)
## Behavioral Rules                 (port verbatim — rules 16-20)
## Error Recovery Rules             (port verbatim — rules 21-23)
## GSD-Specific Rules               (port verbatim — rules 24-27)

## Planner Anti-Patterns            (NEW — fold from planner-antipatterns.md)
  ### Checkpoint anti-patterns      (bad: asking human to automate; bad: too many checkpoints; good: single verification)
  ### Specificity examples          (too-vague vs just-right table)
  ### Context section anti-patterns (bad: reflexive SUMMARY chaining; good: selective context)
  ### Scope reduction anti-patterns (prohibited language list — "v1", "placeholder", etc.)

## Python Anti-Patterns and Good Practices  (NEW — GUIDE-02)
  ### Anti-patterns
    - Using bare `except`
    - Modifying a list while iterating it
    - Nested loops over large datasets without early exit
    - String concatenation in loops (use .join())
    - Mixing `Optional[X]` with missing returns
  ### Idioms (what good Python looks like)
    - Prefer list/dict/set comprehensions over imperative loops when readable
    - Use `with` for resource management, not finally/close
    - Use `enumerate()` and `zip()` — avoid indexing with `range(len(…))`
    - `dataclasses` / `NamedTuple` for structured data over raw dicts
    - `pathlib.Path` over `os.path` string manipulation
  ### Typing conventions
    - Annotate all public function signatures (params + return type)
    - Use `Optional[X]` (or `X | None` in Python 3.10+) — no bare `None` defaults without annotation
    - Prefer `Sequence[X]` / `Mapping[K, V]` over `list` / `dict` in signatures (allows broader callers)
    - Use `TypedDict` for structured dicts that cross module boundaries
    - `from __future__ import annotations` at top of file for forward refs (Python 3.7-3.9)

## Platform-Specific Rules          (port iOS/Apple section verbatim — rules 28-29)
```

**Note on planner-antipatterns.md:** The COMPARISON.md names this as a third source doc but the locked decision is TWO new files. Folding it into `universal-anti-patterns.md` as `## Planner Anti-Patterns` is the right call — it avoids a third file to eager-load and keeps planner guidance co-located with the other universal rules.

---

## Tone and Format Conventions

Observed from existing reference docs (`verification-patterns.md`, `tdd.md`, `AGENTIC-PATTERNS.md`):

- XML tags (`<patterns>`, `<usage>`, `<overview>`, `<required_reading>`) are used in some docs but NOT required — `verification-patterns.md` uses plain markdown headers and `AGENTIC-PATTERNS.md` uses `---` section separators. Use whatever is most scannable for the content type.
- Numbered rules (as in universal-anti-patterns.md source) are good for reference lists; bullet patterns (as in common-bug-patterns.md) are better for checklists.
- `common-bug-patterns.md` source uses XML `<patterns>` and `<usage>` wrappers — preserve these in the port since they exist in the source and create clean structure.
- Prose is minimal. Each entry is a 1-2 line description — this is a reference, not a tutorial.
- No tables in bug-patterns source (except the symptom-to-category map) — preserve this structure.

---

## Architecture Patterns

### Pattern: Port-then-extend

The source docs are complete and high quality. Port them faithfully, then add the Python content at the end of each doc. Do NOT restructure the existing sections — executors will assume section headers match the gsd-core originals for future sync. Extend only.

### Pattern: Byte-identical dual-tree

After writing source tree files, copy to runtime tree. The executor must not diverge the two copies. Recommended: write source first, then write runtime as a second task (or use a single task that writes both).

### Anti-Pattern: Adding to plan-phase.md's `<files_to_read>` block

The `<files_to_read>` block in plan-phase.md's Step 8 prompt is evaluated at spawn time — anything listed there is loaded into the spawned agent's context immediately. This would make the anti-pattern doc eager, defeating the hybrid strategy. The correct home for on-demand references is in the agent's own definition file (`gsd-planner.md`).

### Anti-Pattern: Creating a third standalone doc

`planner-antipatterns.md` exists in gsd-core but is out of scope as a standalone file. The locked decision is two docs. A third file would need its own wiring decision (eager or on-demand) and adds fragmentation without proportional value. Fold its content as a subsection.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Loading docs into agent context | Custom prompt injection, config-driven loader | Existing `@path` eager and "Read path" on-demand idioms | Both idioms are already used and understood by all agents in this codebase |
| Tracking what docs exist | A registry file or manifest | The filesystem — `ls references/` | No need for indirection; agents read docs directly by path |

---

## Common Pitfalls

### Pitfall 1: Wiring only the runtime tree

**What goes wrong:** The source tree (`get-shit-done/…`) is the committed copy. If only the runtime (`.claude/…`) is updated, the change is lost after reinstall or when another dev runs `install.js`.

**How to avoid:** Every file write has two destinations. Both source and runtime paths are enumerated in the plan tasks' `files_modified` list.

**Warning signs:** `git status` shows no changes after "writing the file" — the file written was in the gitignored runtime tree.

### Pitfall 2: Putting the on-demand pointer in plan-phase.md outside the constructed prompt

**What goes wrong:** A pointer added to plan-phase.md but outside the `<planning_context>…</planning_context>` block (lines 460-481) is instructions to the orchestrator, not to the spawned gsd-planner agent. The agent never sees it.

**How to avoid:** Put the on-demand pointer inside `gsd-planner.md` (the agent definition), not in the orchestrating workflow.

### Pitfall 3: Making the bug-patterns doc too long

**What goes wrong:** `common-bug-patterns.md` is eager-loaded on every verify run. A 400-line doc adds significant token cost to every verification. The north-star is lean context.

**How to avoid:** Python bugs section targets ~20 lines (8-10 bullet patterns). Total doc target: under 150 lines. If content exceeds this, cut — the executor should prioritize the most frequent/highest-signal bugs.

### Pitfall 4: Referencing a relative path in workflow directives

**What goes wrong:** Relative paths (`@references/…`) break when the workflow is invoked from a different working directory.

**How to avoid:** All path directives use absolute paths (`/home/cleversol/gsd2/mine/.claude/…`) matching the existing convention in `verify-phase.md` and `execute-plan.md`.

---

## Validation Architecture

This is a docs-and-wiring phase. Validation is grep-checkable — no test framework needed.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None — grep-based verification only |
| Config file | None |
| Quick run command | See grep commands below |
| Full suite command | All grep commands pass |

### Phase Requirements → Verification Map

| Req ID | Behavior | Verification Type | Automated Command |
|--------|----------|-------------------|-------------------|
| GUIDE-01 | `universal-anti-patterns.md` exists in source tree | file existence | `test -f /home/cleversol/gsd2/mine/get-shit-done/references/universal-anti-patterns.md` |
| GUIDE-01 | `universal-anti-patterns.md` exists in runtime tree | file existence | `test -f /home/cleversol/gsd2/mine/.claude/get-shit-done/references/universal-anti-patterns.md` |
| GUIDE-01 | `common-bug-patterns.md` exists in source tree | file existence | `test -f /home/cleversol/gsd2/mine/get-shit-done/references/common-bug-patterns.md` |
| GUIDE-01 | `common-bug-patterns.md` exists in runtime tree | file existence | `test -f /home/cleversol/gsd2/mine/.claude/get-shit-done/references/common-bug-patterns.md` |
| GUIDE-01 | Verifier eager-loads bug-patterns doc | grep in source workflow | `grep -F 'common-bug-patterns.md' /home/cleversol/gsd2/mine/get-shit-done/workflows/verify-phase.md` |
| GUIDE-01 | Verifier eager-loads bug-patterns doc (runtime) | grep in runtime workflow | `grep -F 'common-bug-patterns.md' /home/cleversol/gsd2/mine/.claude/get-shit-done/workflows/verify-phase.md` |
| GUIDE-01 | Planner on-demand pointer exists in source | grep in source agent | `grep -F 'universal-anti-patterns.md' /home/cleversol/gsd2/mine/agents/gsd-planner.md` |
| GUIDE-01 | Planner on-demand pointer exists in runtime | grep in runtime agent | `grep -F 'universal-anti-patterns.md' /home/cleversol/gsd2/mine/.claude/agents/gsd-planner.md` |
| GUIDE-02 | `common-bug-patterns.md` has Python section | grep for section header | `grep -F '## Python' /home/cleversol/gsd2/mine/get-shit-done/references/common-bug-patterns.md` |
| GUIDE-02 | `universal-anti-patterns.md` has Python section | grep for section header | `grep -F '## Python' /home/cleversol/gsd2/mine/get-shit-done/references/universal-anti-patterns.md` |
| GUIDE-02 | Python typing conventions present | grep for "typing" | `grep -i 'typing\|TypedDict\|Optional' /home/cleversol/gsd2/mine/get-shit-done/references/universal-anti-patterns.md` |

### Wave 0 Gaps

None — this phase creates the docs from scratch; no pre-existing test infrastructure needs scaffolding.

---

## Sources

### Primary (HIGH confidence)

- `/home/cleversol/gsd2/core/gsd-core/references/universal-anti-patterns.md` — full source doc read
- `/home/cleversol/gsd2/core/gsd-core/references/common-bug-patterns.md` — full source doc read
- `/home/cleversol/gsd2/core/gsd-core/references/planner-antipatterns.md` — full source doc read
- `/home/cleversol/gsd2/mine/.claude/get-shit-done/workflows/verify-phase.md` — confirmed eager-load pattern and exact `<required_reading>` block (lines 20-23)
- `/home/cleversol/gsd2/mine/.claude/get-shit-done/workflows/plan-phase.md` — confirmed planner prompt construction block (lines 460-481); confirmed no existing anti-pattern/good-code reference
- `/home/cleversol/gsd2/mine/agents/gsd-planner.md` — confirmed agent structure; insertion point identified after `<discovery_levels>` (~line 71)
- `/home/cleversol/gsd2/mine/.planning/STATE.md` — dual-tree rule (Phase 04-01 decision) confirmed
- `.planning/v1.5/phases/03-execution-detail-enrichment/03-CONTEXT.md` — locked decisions read; used as authoritative

### Secondary (MEDIUM confidence)

- Python anti-pattern and idiom content (Python-Specific Bugs, idioms, typing conventions): based on well-established Python community consensus (PEP 484, PEP 526, PEP 544 for typing; common Python gotchas documented in official docs and PEPs). No Context7 or external source verified during this session — but content is stable and widely recognized.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no library dependencies; pure prose port from source docs on disk
- Wiring points: HIGH — exact file paths and line numbers confirmed by reading files
- Content taxonomy: HIGH (port sections) / MEDIUM (Python content) — port is direct from source; Python sections drawn from established community knowledge
- Dual-tree rule: HIGH — confirmed in STATE.md Phase 04-01 decision

**Research date:** 2026-06-04
**Valid until:** 2026-12-04 (stable tooling / prose phase — 6 months; no external deps to expire)

---

## RESEARCH COMPLETE

**Phase:** 3 - Execution-Detail Enrichment (GUIDE-only)
**Confidence:** HIGH

### Key Findings

- Source docs (`universal-anti-patterns.md`, `common-bug-patterns.md`, `planner-antipatterns.md`) are on disk at `/home/cleversol/gsd2/core/gsd-core/references/` and have been read in full. Port is faithful-and-extend, not author-fresh.
- Exact eager-load insertion: add `@/home/cleversol/gsd2/mine/.claude/get-shit-done/references/common-bug-patterns.md` inside `<required_reading>` in `verify-phase.md` (after the existing `verification-patterns.md` line, before the template line), in both trees.
- Exact on-demand insertion: add a `<code_quality_reference>` block in `agents/gsd-planner.md` after `<discovery_levels>` (~line 71), in both trees. Do NOT wire into `plan-phase.md` — text outside the constructed prompt block never reaches the spawned agent.
- `planner-antipatterns.md` content folds into `universal-anti-patterns.md` as `## Planner Anti-Patterns` — no third file.
- Python section for bug-patterns: ~20 lines of Python-specific bug bullets (mutable defaults, late-binding closures, `is` vs `==`, etc.). Python section for anti-patterns: ~40 lines covering anti-patterns, idioms, and typing conventions (GUIDE-02).
- All validation checks are grep-checkable; 11 check commands listed in Validation Architecture.

### File Created

`/home/cleversol/gsd2/mine/.planning/v1.5/phases/03-execution-detail-enrichment/03-RESEARCH.md`

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Wiring points | HIGH | Exact lines read from source files |
| Source doc content | HIGH | Source docs read directly |
| Python content | MEDIUM | Well-established community knowledge, not Context7-verified |
| Dual-tree requirement | HIGH | STATE.md decision confirmed |

### Open Questions

None — all blockers resolved by reading source files directly.

### Ready for Planning

Research complete. Planner can create PLAN.md files.
