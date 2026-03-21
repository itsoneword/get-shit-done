<purpose>
Orchestrate parallel codebase mapper agents to analyze codebase and produce 7 structured documents in .planning/codebase/. Agents write directly; orchestrator only summarizes.
</purpose>

<process>

<step name="init_context" priority="first">
```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init map-codebase)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Extract from init JSON: `mapper_model`, `commit_docs`, `codebase_dir`, `existing_maps`, `has_maps`, `codebase_dir_exists`.
</step>

<step name="check_existing">
If `codebase_dir_exists` is true:
```bash
ls -la .planning/codebase/
```

Present options and wait for response:
```
.planning/codebase/ already exists with these documents:
[List files found]

1. Refresh - Delete existing and remap
2. Update - Keep existing, update specific documents
3. Skip - Use existing as-is
```

- Refresh → delete .planning/codebase/, continue to create_structure
- Update → ask which documents, continue to spawn_agents (filtered)
- Skip → exit workflow

If doesn't exist: continue to create_structure.
</step>

<step name="create_structure">
```bash
mkdir -p .planning/codebase
```

Output files: STACK.md, INTEGRATIONS.md (tech mapper), ARCHITECTURE.md, STRUCTURE.md (arch mapper), CONVENTIONS.md, TESTING.md (quality mapper), CONCERNS.md (concerns mapper).

Continue to detect_runtime_capabilities.
</step>

<step name="detect_runtime_capabilities">
Check if `Task` tool is available.

- Has Task tool → proceed to spawn_agents
- No Task tool → skip to sequential_mapping

**NEVER** use `browser_subagent` or `Explore` as a Task substitute — they cannot analyze code.
</step>

<step name="spawn_agents" condition="Task tool is available">
Spawn 4 parallel gsd-codebase-mapper agents with `run_in_background=true`. Use `model="{mapper_model}"`.

**Agent 1: Tech**
```
Task(subagent_type="gsd-codebase-mapper", model="{mapper_model}", run_in_background=true,
  description="Map codebase tech stack",
  prompt="Focus: tech
Analyze this codebase for technology stack and external integrations.
Write to .planning/codebase/:
- STACK.md - Languages, runtime, frameworks, dependencies, configuration
- INTEGRATIONS.md - External APIs, databases, auth providers, webhooks
Explore thoroughly. Write documents directly using templates. Return confirmation only.")
```

**Agent 2: Architecture**
```
Task(subagent_type="gsd-codebase-mapper", model="{mapper_model}", run_in_background=true,
  description="Map codebase architecture",
  prompt="Focus: arch
Analyze this codebase architecture and directory structure.
Write to .planning/codebase/:
- ARCHITECTURE.md - Pattern, layers, data flow, abstractions, entry points
- STRUCTURE.md - Directory layout, key locations, naming conventions
Explore thoroughly. Write documents directly using templates. Return confirmation only.")
```

**Agent 3: Quality**
```
Task(subagent_type="gsd-codebase-mapper", model="{mapper_model}", run_in_background=true,
  description="Map codebase conventions",
  prompt="Focus: quality
Analyze this codebase for coding conventions and testing patterns.
Write to .planning/codebase/:
- CONVENTIONS.md - Code style, naming, patterns, error handling
- TESTING.md - Framework, structure, mocking, coverage
Explore thoroughly. Write documents directly using templates. Return confirmation only.")
```

**Agent 4: Concerns**
```
Task(subagent_type="gsd-codebase-mapper", model="{mapper_model}", run_in_background=true,
  description="Map codebase concerns",
  prompt="Focus: concerns
Analyze this codebase for technical debt, known issues, and areas of concern.
Write to .planning/codebase/:
- CONCERNS.md - Tech debt, bugs, security, performance, fragile areas
Explore thoroughly. Write document directly using template. Return confirmation only.")
```

Continue to collect_confirmations.
</step>

<step name="collect_confirmations">
Call TaskOutput for all 4 task_ids in parallel (single message, block=true, timeout=300000).

Expected per-agent confirmation:
```
## Mapping Complete
**Focus:** {focus}
**Documents written:**
- `.planning/codebase/{DOC}.md` ({N} lines)
Ready for orchestrator summary.
```

You receive file paths and line counts only — not document contents. If any agent failed, note it and continue with successful documents.

Continue to verify_output.
</step>

<step name="sequential_mapping" condition="Task tool is NOT available">
Use only filesystem tools (Read, Bash, Write, Grep, Glob, or runtime equivalents). Perform 4 passes:

**Pass 1: Tech** — explore package.json/Cargo.toml/go.mod/requirements.txt, config files
- Write STACK.md, INTEGRATIONS.md

**Pass 2: Architecture** — explore directory structure, entry points, module boundaries
- Write ARCHITECTURE.md, STRUCTURE.md

**Pass 3: Quality** — explore code style, error handling, test files, CI config
- Write CONVENTIONS.md, TESTING.md

**Pass 4: Concerns** — explore TODOs, known issues, fragile areas, security patterns
- Write CONCERNS.md

Use gsd-codebase-mapper document templates. Include actual file paths in backticks.

Continue to verify_output.
</step>

<step name="verify_output">
```bash
ls -la .planning/codebase/
wc -l .planning/codebase/*.md
```

All 7 documents must exist and have >20 lines each. Note any missing or empty documents.

Continue to scan_for_secrets.
</step>

<step name="scan_for_secrets">
**MUST scan before committing** — leaked credentials in committed docs are a security incident.

```bash
grep -E '(sk-[a-zA-Z0-9]{20,}|sk_live_[a-zA-Z0-9]+|sk_test_[a-zA-Z0-9]+|ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|glpat-[a-zA-Z0-9_-]+|AKIA[A-Z0-9]{16}|xox[baprs]-[a-zA-Z0-9-]+|-----BEGIN.*PRIVATE KEY|eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.)' .planning/codebase/*.md 2>/dev/null && SECRETS_FOUND=true || SECRETS_FOUND=false
```

If SECRETS_FOUND=true:
```
⚠️  SECURITY ALERT: Potential secrets detected in codebase documents!

Found patterns that look like API keys or tokens in:
[show grep output]

Review flagged content. Remove real secrets before committing.
Reply "safe to proceed" if flagged content is not sensitive.
```
Wait for confirmation before continuing.

If SECRETS_FOUND=false: continue to commit_codebase_map.
</step>

<step name="commit_codebase_map">
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs: map existing codebase" --files .planning/codebase/*.md
```

Continue to offer_next.
</step>

<step name="offer_next">
```bash
wc -l .planning/codebase/*.md
```

```
Codebase mapping complete.

Created .planning/codebase/:
- STACK.md ([N] lines) - Technologies and dependencies
- ARCHITECTURE.md ([N] lines) - System design and patterns
- STRUCTURE.md ([N] lines) - Directory layout and organization
- CONVENTIONS.md ([N] lines) - Code style and patterns
- TESTING.md ([N] lines) - Test structure and practices
- INTEGRATIONS.md ([N] lines) - External services and APIs
- CONCERNS.md ([N] lines) - Technical debt and issues

---

## ▶ Next Up

**Initialize project** — use codebase context for planning

`/gsd2:new-project`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- Re-run mapping: `/gsd2:map-codebase`
- Review specific file: `cat .planning/codebase/STACK.md`
- Edit any document before proceeding

---
```
</step>

</process>

<success_criteria>
- .planning/codebase/ created with all 7 documents (each >20 lines)
- Task available → 4 parallel gsd-codebase-mapper agents with run_in_background=true
- Task unavailable → 4 sequential inline passes (NEVER browser_subagent)
- Secrets scan passed before commit
- Completion summary with line counts and next steps presented
</success_criteria>
