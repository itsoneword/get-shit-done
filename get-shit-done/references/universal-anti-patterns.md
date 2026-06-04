# Universal Anti-Patterns

Rules that apply to ALL workflows and agents. Individual workflows may have additional specific anti-patterns.

---

## Context Budget Rules

1. **Never** read agent definition files (`agents/*.md`) -- `subagent_type` auto-loads them. Reading agent definitions into the orchestrator wastes context for content automatically injected into subagent sessions.
2. **Never** inline large files into subagent prompts -- tell agents to read files from disk instead. Agents have their own context windows.
3. **Read depth scales with context window** -- read summaries/frontmatter when context is tight, full bodies when budget allows.
4. **Delegate** heavy work to subagents -- the orchestrator routes, it does not build, analyze, research, investigate, or verify.
5. **Proactive pause warning**: If you have already consumed significant context (large file reads, multiple subagent results), warn the user: "Context budget is getting heavy. Consider checkpointing progress."

## File Reading Rules

6. **SUMMARY.md read depth scales with context window** -- read frontmatter only from prior phase SUMMARYs when context is tight; full body reads are permitted for direct-dependency phases when budget allows. Transitive dependencies (2+ phases back) remain frontmatter-only regardless.
7. **Never** read full PLAN.md files from other phases -- only current phase plans.
8. **Never** read `.planning/logs/` files -- only the health workflow reads these.
9. **Do not** re-read full file contents when frontmatter is sufficient -- frontmatter contains status, key_files, commits, and provides fields.

## Subagent Rules

10. **NEVER** use non-GSD agent types (`general-purpose`, `Explore`, `Plan`, `Bash`, `feature-dev`, etc.) -- ALWAYS use `subagent_type: "gsd-{agent}"` (e.g., `gsd-phase-researcher`, `gsd-executor`, `gsd-planner`). GSD agents have project-aware prompts, audit logging, and workflow context. Generic agents bypass all of this.
11. **Do not** re-litigate decisions that are already locked in CONTEXT.md (or PROJECT.md ## Context section) -- respect locked decisions unconditionally.

## Questioning Anti-Patterns

Reference: `references/questioning.md` for the full anti-pattern list.

12. **Do not** walk through checklists -- checklist walking (asking items one by one from a list) is the #1 anti-pattern. Instead, use progressive depth: start broad, dig where interesting.
13. **Do not** use corporate speak -- avoid jargon like "stakeholder alignment", "synergize", "deliverables". Use plain language.
14. **Do not** apply premature constraints -- don't narrow the solution space before understanding the problem. Ask about the problem first, then constrain.

## State Management Anti-Patterns

15. **No direct Write/Edit to STATE.md or ROADMAP.md for mutations.** Always use `gsd-tools query` for registered state/roadmap handlers (e.g. `state.update`, `state.advance-plan`, `roadmap.update-plan-progress`), or legacy `node …/gsd-tools.cjs` for CLI-only commands. Direct Write tool usage bypasses safe update logic and is unsafe in multi-session environments. Exception: first-time creation of STATE.md from template is allowed.

## Behavioral Rules

16. **Do not** create artifacts the user did not approve -- always confirm before writing new planning documents.
17. **Do not** modify files outside the workflow's stated scope -- check the plan's files_modified list.
18. **Do not** suggest multiple next actions without clear priority -- one primary suggestion, alternatives listed secondary.
19. **Do not** use `git add .` or `git add -A` -- stage specific files only.
20. **Do not** include sensitive information (API keys, passwords, tokens) in planning documents or commits.

## Error Recovery Rules

21. **Git lock detection**: Before any git operation, if it fails with "Unable to create lock file", check for stale `.git/index.lock` and advise the user to remove it (do not remove automatically).
22. **Config fallback awareness**: Config loading returns `null` silently on invalid JSON. If your workflow depends on config values, check for null and warn the user: "config.json is invalid or missing -- running with defaults."
23. **Partial state recovery**: If STATE.md references a phase directory that doesn't exist, do not proceed silently. Warn the user and suggest diagnosing the mismatch.

## GSD-Specific Rules

24. **Do not** check for `mode === 'auto'` or `mode === 'autonomous'` -- GSD uses `yolo` config flag. Check `yolo: true` for autonomous mode, absence or `false` for interactive mode.
25. **Prefer `gsd-tools query`** for orchestration when a handler exists; when shelling out to the legacy CLI, use **`gsd-tools.cjs`** (not `gsd-tools.js` or any other filename) — GSD ships the programmatic API as CommonJS for Node.js CLI compatibility.
26. **Plan files MUST follow `{padded_phase}-{NN}-PLAN.md` pattern** (e.g., `01-01-PLAN.md`). Never use `PLAN-01.md`, `plan-01.md`, or any other variation -- gsd-tools detection depends on this exact pattern.
27. **Do not start executing the next plan before writing the SUMMARY.md for the current plan** -- downstream plans may reference it via `@` includes.

## iOS / Apple Platform Rules

28. **NEVER use `Package.swift` + `.executableTarget` (or `.target`) as the primary build system for iOS apps.** SPM executable targets produce macOS CLI binaries, not iOS `.app` bundles. They cannot be installed on iOS devices or submitted to the App Store. Use XcodeGen (`project.yml` + `xcodegen generate`) to create a proper `.xcodeproj`.
29. **Verify SwiftUI API availability before use.** Many SwiftUI APIs require a specific minimum iOS version (e.g., `NavigationSplitView` is iOS 16+, `List(selection:)` with multi-select and `@Observable` require iOS 17). If a plan uses an API that exceeds the declared `IPHONEOS_DEPLOYMENT_TARGET`, raise the deployment target or add `#available` guards.

## Planner Anti-Patterns

> Reference for gsd-planner agent. Loaded on-demand. For code-quality judgments, choosing implementation patterns, or flagging anti-patterns in plan tasks.

### Checkpoint Anti-Patterns

#### Bad — Asking human to automate

```xml
<task type="checkpoint:human-action">
  <action>Deploy to Vercel</action>
  <instructions>Visit vercel.com, import repo, click deploy...</instructions>
</task>
```

**Why bad:** Vercel has a CLI. Claude should run `vercel --yes`. Never ask the user to do what Claude can automate via CLI/API.

#### Bad — Too many checkpoints

```xml
<task type="auto">Create schema</task>
<task type="checkpoint:human-verify">Check schema</task>
<task type="auto">Create API</task>
<task type="checkpoint:human-verify">Check API</task>
```

**Why bad:** Verification fatigue. Users should not be asked to verify every small step. Combine into one checkpoint at the end of meaningful work.

#### Good — Single verification checkpoint

```xml
<task type="auto">Create schema</task>
<task type="auto">Create API</task>
<task type="auto">Create UI</task>
<task type="checkpoint:human-verify">
  <what-built>Complete auth flow (schema + API + UI)</what-built>
  <how-to-verify>Test full flow: register, login, access protected page</how-to-verify>
</task>
```

#### Bad — Mixing checkpoints with implementation

A plan should not interleave multiple checkpoint types with implementation tasks. Checkpoints belong at natural verification boundaries, not scattered throughout.

### Specificity Examples

| TOO VAGUE | JUST RIGHT |
|-----------|------------|
| "Add authentication" | "Add JWT auth with refresh rotation using jose library, store in httpOnly cookie, 15min access / 7day refresh" |
| "Create the API" | "Create POST /api/projects endpoint accepting {name, description}, validates name length 3-50 chars, returns 201 with project object" |
| "Style the dashboard" | "Add Tailwind classes to Dashboard.tsx: grid layout (3 cols on lg, 1 on mobile), card shadows, hover states on action buttons" |
| "Handle errors" | "Wrap API calls in try/catch, return {error: string} on 4xx/5xx, show toast via sonner on client" |
| "Set up the database" | "Add User and Project models to schema.prisma with UUID ids, email unique constraint, createdAt/updatedAt timestamps, run prisma db push" |

**Specificity test:** Could a different Claude instance execute the task without asking clarifying questions? If not, add more detail.

### Context Section Anti-Patterns

#### Bad — Reflexive SUMMARY chaining

```markdown
<context>
@.planning/phases/01-foundation/01-01-SUMMARY.md
@.planning/phases/01-foundation/01-02-SUMMARY.md  <!-- Does Plan 02 actually need Plan 01's output? -->
@.planning/phases/01-foundation/01-03-SUMMARY.md  <!-- Chain grows, context bloats -->
</context>
```

**Why bad:** Plans are often independent. Reflexive chaining (02 refs 01, 03 refs 02...) wastes context. Only reference prior SUMMARY files when the plan genuinely uses types/exports from that prior plan or a decision from it affects the current plan.

#### Good — Selective context

```markdown
<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/01-foundation/01-01-SUMMARY.md  <!-- Uses User type defined in Plan 01 -->
</context>
```

### Scope Reduction Anti-Patterns

**Prohibited language in task actions:**
- "v1", "v2", "simplified version", "static for now", "hardcoded for now"
- "future enhancement", "placeholder", "basic version", "minimal implementation"
- "will be wired later", "dynamic in future phase", "skip for now"

If a decision from CONTEXT.md says "display cost calculated from billing table in impulses", the plan must deliver exactly that. Not "static label /min" as a "v1". If the phase is too complex, recommend a phase split instead of silently reducing scope.

## Python Anti-Patterns and Good Practices

### Anti-Patterns

- **Bare `except`**: `except:` catches `KeyboardInterrupt` and `SystemExit` — use `except Exception:` at minimum, or name the specific exception. Bare `except` swallows signals and makes debugging impossible.
- **Modifying a list while iterating it**: Produces skipped elements or `RuntimeError`. Iterate over a copy (`list(items)`) or build a new list with a comprehension.
- **`range(len(...))` indexing**: `for i in range(len(items)): items[i]` is the C idiom in Python clothing. Use `enumerate(items)` for index+value pairs or `zip(a, b)` for parallel iteration.
- **String concatenation in loops**: `result += chunk` in a loop is O(n²) due to repeated allocation. Use `"".join(parts)` where `parts` is built in the loop.
- **Mutable default arguments**: `def f(x=[])` shares `x` across ALL calls — mutations persist. Use `def f(x=None): if x is None: x = []`.

### Idioms (What Good Python Looks Like)

- **Comprehensions over imperative loops** when readable: `[x * 2 for x in items if x > 0]` is clearer than a three-line `for`/`append` loop.
- **`with` for resource management**: file handles, locks, connections — anything that needs cleanup. Never rely on reference counting or `finally`/`close` chains.
- **`enumerate()` and `zip()`**: `for i, val in enumerate(items)` and `for a, b in zip(xs, ys)` eliminate index arithmetic and its associated off-by-one bugs.
- **`dataclasses` and `NamedTuple` for structured data**: avoid raw `dict` for data that crosses function boundaries — named fields catch typos at definition time, not at runtime.
- **`pathlib.Path` over `os.path`**: `Path(p) / "subdir" / "file.txt"` is readable and cross-platform; `os.path.join(p, "subdir", "file.txt")` is not.

### Typing Conventions

- **Annotate all public signatures**: every public function's parameters and return type must have annotations. Unannotated public APIs force callers to read the implementation.
- **`Optional[X]` or `X | None` (Python 3.10+)**: never use a bare `None` default without annotating it. `from typing import Optional` provides `Optional[X]` for older Python; `X | None` is preferred in 3.10+.
- **`Sequence[X]` and `Mapping[K, V]` in signatures**: prefer these over `list` and `dict` — they accept any compatible type (tuple, OrderedDict, etc.) and signal read-only intent to callers.
- **`TypedDict` for structured dicts crossing module boundaries**: plain `dict[str, Any]` loses the schema at the boundary. `TypedDict` keeps it visible to type checkers and readers.
- **`from __future__ import annotations`**: add to any file using forward references (class referring to itself, or mutual imports). Makes all annotations strings at runtime — avoids `NameError` on Python 3.7–3.9.
