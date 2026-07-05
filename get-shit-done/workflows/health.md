<purpose>
Validate `.planning/` directory integrity and report actionable issues. Checks for missing files, invalid configurations, inconsistent state, and orphaned plans. Optionally repairs auto-fixable issues.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="parse_args">
**Parse arguments:**

Check if `--repair` flag is present in the command arguments.

```
REPAIR_FLAG=""
if arguments contain "--repair"; then
  REPAIR_FLAG="--repair"
fi
```
</step>

<step name="run_health_check">
**Run health validation:**

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" validate health $REPAIR_FLAG
```

Parse JSON output:
- `status`: "healthy" | "degraded" | "broken"
- `errors[]`: Critical issues (code, message, fix, repairable)
- `warnings[]`: Non-critical issues
- `info[]`: Informational notes
- `repairable_count`: Number of auto-fixable issues
- `repairs_performed[]`: Actions taken if --repair was used
</step>

<step name="format_output">
**Format and display results:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD Health Check
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Status: HEALTHY | DEGRADED | BROKEN
Errors: N | Warnings: N | Info: N
```

**If repairs were performed:**
```
## Repairs Performed

- ✓ config.json: Created with defaults
- ✓ STATE.md: Regenerated from roadmap
```

**If errors exist:**
```
## Errors

- [E001] config.json: JSON parse error at line 5
  Fix: Run /gsd2:health --repair to reset to defaults

- [E002] PROJECT.md not found
  Fix: Run /gsd2:new-project to create
```

**If warnings exist:**
```
## Warnings

- [W002] STATE.md references phase 5, but only phases 1-3 exist
  Fix: Review STATE.md manually before changing it; repair will not overwrite an existing STATE.md

- [W005] Phase directory "1-setup" doesn't follow NN-name format
  Fix: Rename to match pattern (e.g., 01-setup)
```

**If info exists:**
```
## Info

- [I001] 02-implementation/02-01-PLAN.md has no SUMMARY.md
  Note: May be in progress
```

**Footer (if repairable issues exist and --repair was NOT used):**
```
---
N issues can be auto-repaired. Run: /gsd2:health --repair
```
</step>

<step name="offer_repair">
**If repairable issues exist and --repair was NOT used:**

Ask user if they want to run repairs:

```
Would you like to run /gsd2:health --repair to fix N issues automatically?
```

If yes, re-run with --repair flag and display results.
</step>

<step name="verify_repairs">
**If repairs were performed:**

Re-run health check without --repair to confirm issues are resolved:

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" validate health
```

Report final status.
</step>

</process>

<error_codes>

| Code | Severity | Description | Repairable |
|------|----------|-------------|------------|
| E001 | error | .planning/ directory not found | No |
| E002 | error | PROJECT.md not found | No |
| E003 | error | ROADMAP.md not found | No |
| E004 | error | STATE.md not found | Yes |
| E005 | error | config.json parse error | Yes |
| E-DRIFT | error | source↔runtime file-tree drift: a file in get-shit-done/ is missing or differs in .claude/get-shit-done/ | Yes |
| E-SETTINGS-DRIFT | error | settings.json parity drift: a required hook or statusLine registration is missing or changed | No |
| W001 | warning | PROJECT.md missing required section | No |
| W002 | warning | STATE.md references invalid phase | No |
| W003 | warning | config.json not found | Yes |
| W004 | warning | config.json invalid field value | No |
| W005 | warning | Phase directory naming mismatch | No |
| W006 | warning | Phase in ROADMAP but no directory | No |
| W007 | warning | Phase on disk but not in ROADMAP | No |
| W008 | warning | config.json: workflow.nyquist_validation absent (defaults to enabled but agents may skip) | Yes |
| W009 | warning | Phase has Validation Architecture in RESEARCH.md but no VALIDATION.md | No |
| I001 | info | Plan without SUMMARY (may be in progress) | No |
| I003 | info | .claude/get-shit-done/ not found — symmetry check skipped (not installed?) | No |
| I004 | info | .claude/settings.json not found — settings parity check skipped | No |
| E-GRAPH-CYCLE | error | Dependency cycle in depends_on edges (phase or plan) | No |
| E-GRAPH-DANGLING | error | Dangling structural edge (depends_on/satisfies) pointing to a nonexistent node | No |
| I-GRAPH-DANGLING | info | Dangling advisory edge (affects/provides/wires) pointing to a nonexistent node | No |
| I-GRAPH-CONTRADICTION | info | affects declaration contradicts (or is unsupported by) files_modified overlap | No |

</error_codes>

<symmetry_check>

## Check 9: Source↔Runtime Symmetry

`/gsd2:health` runs a structural symmetry-check in the same invocation as all other checks. It has two named parts:

**Part A — file-tree diff:** Compares `get-shit-done/` (source) vs `.claude/get-shit-done/` (runtime) recursively. Any file present in source but absent or byte-different in runtime is flagged as `E-DRIFT`. The check uses a Node.js file-walk, not an external `diff` command, so it is testable and reliable.

**PATH-TOKEN exclusion:** Files under `agents/` are deliberately excluded from the diff. Per the PATH-TOKEN RULE (decided in Phase 3), source agent files use the `~/.claude/` path token while runtime files use the absolute path — this difference is intentional and correct, not drift.

**Part B — settings.json hook/statusLine parity:** Reads `.claude/settings.json` and verifies that every hook registration the framework installs is present: `SessionStart` (`gsd2-check-update.js`), `PostToolUse` (`gsd2-context-monitor.js`, `gsd2-read-injection-scanner.js`, `gsd2-agent-trace.js`), `PreToolUse` (`gsd2-prompt-guard.js`, `gsd2-read-guard.js`), `PostToolUseFailure` (`gsd2-agent-trace.js`), and `statusLine` (`gsd2-statusline.js`). Missing or changed registrations are flagged as `E-SETTINGS-DRIFT`.

Both parts run in the same `validate health` invocation. The check skips cleanly (info, not error) when `.claude/get-shit-done/` or `.claude/settings.json` is absent (e.g., source checkout without install).

**`--repair` behavior:**
- `E-DRIFT` (file-tree): `--repair` copies each drifted source file to its runtime counterpart, excluding `agents/`. Re-syncable.
- `E-SETTINGS-DRIFT` (settings parity): NOT auto-repaired — settings.json is owned by the installer. Re-run the GSD installer to restore hook registrations.

**Note on `/gsd2:doctor`:** This check is the structural symmetry-check. The name `/gsd2:doctor` is reserved for a future *semantic stale-decision healer* (Phase 3 cross-phase note — a distinct, larger feature). This phase's check is structural only and is folded into `/gsd2:health`.

**Reuse by execute-phase:** `checkSourceRuntimeSymmetry` is exported from `verify.cjs` so Plan 07-06 can call it as a post-merge drift step without spawning a new health invocation.

</symmetry_check>

<graph_integrity_check>

## Check 10: Graph Integrity

`/gsd2:health` runs the same structural/advisory split `gsd-tools graph validate` uses, via `graph.cjs`'s shared `computeGraphIntegrity`. **Structural** findings (dependency cycles; dangling references on `depends_on`/`satisfies` edges) are `error` severity and flip overall health to `broken`. **Advisory** findings (dangling references on `affects`/`provides`/`wires` edges; `affects`-vs-`files_modified` contradictions) are `info` severity — visible in the report, never fail health, because this data is author-supplied and expected to carry some sloppiness (see `.planning/v1.7/phases/17-graph-algorithms-integrity-check/17-CONTEXT.md`).

**Not repairable:** graph findings are diagnostic only — `--repair` never touches them. Fixing a cycle or a dangling/contradictory reference means editing the source (ROADMAP.md, PLAN/SUMMARY frontmatter) by hand, or reviewing with `gsd-tools graph validate` for the full advisory list.

</graph_integrity_check>

<repair_actions>

| Action | Effect | Risk |
|--------|--------|------|
| createConfig | Create config.json with defaults | None |
| resetConfig | Delete + recreate config.json | Loses custom settings |
| regenerateState | Create STATE.md from ROADMAP structure when it is missing | Loses session history |
| addNyquistKey | Add workflow.nyquist_validation: true to config.json | None — matches existing default |

**Not repairable (too risky):**
- PROJECT.md, ROADMAP.md content
- Phase directory renaming
- Orphaned plan cleanup
- Graph-integrity findings (cycles, dangling refs, affects contradictions) — author-supplied data, review with gsd-tools graph validate

</repair_actions>

<stale_task_cleanup>
**Windows-specific:** Check for stale Claude Code task directories that accumulate on crash/freeze.
These are left behind when subagents are force-killed and consume disk space.

When `--repair` is active, detect and clean up:

```bash
# Check for stale task directories (older than 24 hours)
TASKS_DIR="$HOME/.claude/tasks"
if [ -d "$TASKS_DIR" ]; then
  STALE_COUNT=$(find "$TASKS_DIR" -maxdepth 1 -type d -mtime +1 2>/dev/null | wc -l)
  if [ "$STALE_COUNT" -gt 0 ]; then
    echo "⚠️  Found $STALE_COUNT stale task directories in ~/.claude/tasks/"
    echo "   These are leftover from crashed subagent sessions."
    echo "   Run: rm -rf ~/.claude/tasks/*  (safe — only affects dead sessions)"
  fi
fi
```

Report as info diagnostic: `I002 | info | Stale subagent task directories found | Yes (--repair removes them)`
</stale_task_cleanup>
