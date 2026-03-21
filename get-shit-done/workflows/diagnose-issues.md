<purpose>
Orchestrate parallel debug agents to investigate UAT gaps and find root causes. Parse gaps → spawn one agent per gap → collect causes → update UAT.md → hand off to plan-phase --gaps.
</purpose>

<paths>
DEBUG_DIR=.planning/debug
</paths>

<core_principle>
UAT finds WHAT is broken (symptoms). Debug agents find WHY (root cause). plan-phase --gaps then targets actual causes, not guesses.
</core_principle>

<process>

<step name="parse_gaps">
Read UAT.md "Gaps" section (YAML). For each failed gap, also read its corresponding test entry for full context.

```yaml
# Gap shape:
- truth: "Comment appears immediately after submission"
  status: failed
  reason: "User reported: works but doesn't show until I refresh the page"
  severity: major
  test: 2
  artifacts: []
  missing: []
```

Build: `gaps = [{truth, severity, test_num, reason}, ...]`
</step>

<step name="report_plan">
```
## Diagnosing {N} Gaps

Spawning parallel debug agents:

| Gap (Truth) | Severity |
|-------------|----------|
| {truth}     | {severity} |
...

Each agent: creates DEBUG-{slug}.md, investigates autonomously, returns root cause. Runs in parallel.
```
</step>

<step name="spawn_agents">
For each gap, fill `debug-subagent-prompt` template and spawn — **all in a single message** (parallel execution):

```
Task(
  prompt=filled_debug_subagent_prompt + "\n\n<files_to_read>\n- {phase_dir}/{phase_num}-UAT.md\n- .planning/STATE.md\n</files_to_read>",
  subagent_type="gsd-debugger",
  description="Debug: {truth_short}"
)
```

Template placeholders:
- `{truth}` / `{expected}`: expected behavior that failed
- `{actual}`: verbatim reason field from UAT
- `{errors}`: error messages or "None reported"
- `{reproduction}`: "Test {test_num} in UAT"
- `{timeline}`: "Discovered during UAT"
- `{goal}`: `find_root_cause_only`
- `{slug}`: generated from truth
</step>

<step name="collect_results">
Each agent returns:
```
## ROOT CAUSE FOUND
**Debug Session:** ${DEBUG_DIR}/{slug}.md
**Root Cause:** {specific cause with evidence}
**Evidence Summary:** {key findings}
**Files Involved:** {file}: {what's wrong}
**Suggested Fix Direction:** {hint for plan-phase --gaps}
```

Extract per agent: `root_cause`, `files`, `debug_path`, `suggested_fix`.

If `## INVESTIGATION INCONCLUSIVE`: set root_cause = "Investigation inconclusive - manual review needed", record remaining possibilities.
</step>

<step name="update_uat">
Add diagnosis fields to each gap in UAT.md:

```yaml
- truth: "Comment appears immediately after submission"
  status: failed
  reason: "User reported: works but doesn't show until I refresh the page"
  severity: major
  test: 2
  root_cause: "useEffect in CommentList.tsx missing commentCount dependency"
  artifacts:
    - path: "src/components/CommentList.tsx"
      issue: "useEffect missing dependency"
  missing:
    - "Add commentCount to useEffect dependency array"
    - "Trigger re-render when new comment added"
  debug_session: .planning/debug/comment-not-refreshing.md
```

Update frontmatter status to "diagnosed". Commit:
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs({phase_num}): add root causes from diagnosis" --files ".planning/phases/XX-name/{phase_num}-UAT.md"
```
</step>

<step name="report_results">
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► DIAGNOSIS COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Gap (Truth) | Root Cause | Files |
|-------------|------------|-------|
| {truth}     | {cause}    | {files} |

Debug sessions: ${DEBUG_DIR}/

Proceeding to plan fixes...
```

Return to verify-work orchestrator. NEVER offer manual next steps — verify-work handles continuation.
</step>

</process>

<failure_handling>
- Agent inconclusive → mark gap "needs manual review", continue others, report incomplete
- Agent times out → check DEBUG-{slug}.md for partial progress; resume with /gsd2:debug
- All agents fail → report for manual investigation; fall back to plan-phase --gaps without root causes (less precise)
</failure_handling>

<success_criteria>
- [ ] Gaps parsed from UAT.md
- [ ] Debug agents spawned in parallel
- [ ] Root causes collected from all agents
- [ ] UAT.md gaps updated with artifacts, missing, root_cause
- [ ] Debug sessions saved to ${DEBUG_DIR}/
- [ ] Hand off to verify-work for automatic planning
</success_criteria>
