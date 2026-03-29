<purpose>
Generate unit and E2E tests for a completed phase. Classifies changed files into TDD/E2E/Skip, gets user approval, then generates and runs tests following RED-GREEN conventions.
</purpose>

<process>

<step name="parse_arguments">
Parse `$ARGUMENTS`: phase number → `$PHASE_ARG`, remaining text → `$EXTRA_INSTRUCTIONS` (optional).

If no phase number:
```
ERROR: Phase number required
Usage: /gsd2:add-tests <phase> [additional instructions]
```
Exit.
</step>

<step name="init_context">
```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Extract from init JSON: `phase_dir`, `phase_number`, `phase_name`. Exit with error if phase directory not found.

Read phase artifacts (priority order):
1. `${phase_dir}/*-SUMMARY.md` — implemented files (MUST exist; exit with error if missing)
2. `${phase_dir}/CONTEXT.md` — acceptance criteria
3. `${phase_dir}/*-VERIFICATION.md` — user-verified scenarios (if present)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► ADD TESTS — Phase ${phase_number}: ${phase_name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
</step>

<step name="analyze_implementation">
Extract changed files from SUMMARY.md. Read each file before classifying — do not classify by filename alone.

| Category | When to apply | Test type |
|----------|--------------|-----------|
| **TDD** | Pure functions: business logic, calculations, transformations, validators, parsers, state machines, utilities | Unit tests |
| **E2E** | UI behavior: keyboard shortcuts, navigation, form interactions, selection, drag-drop, modals, data grids | Playwright/E2E |
| **Skip** | CSS/layout, config files, glue code, migrations, simple CRUD, type definitions | None |
</step>

<step name="present_classification">
```
AskUserQuestion(
  header: "Test Classification",
  question: |
    ## Files classified for testing

    ### TDD (Unit Tests) — {N} files
    {file list with brief reason}

    ### E2E (Browser Tests) — {M} files
    {file list with brief reason}

    ### Skip — {K} files
    {file list with brief reason}

    {if $EXTRA_INSTRUCTIONS: "Additional instructions: ${EXTRA_INSTRUCTIONS}"}

    How would you like to proceed?
  options:
    - "Approve and generate test plan"
    - "Adjust classification (I'll specify changes)"
    - "Cancel"
)
```

If "Adjust": apply changes and re-present. If "Cancel": exit.
</step>

<step name="discover_test_structure">
```bash
find . -type d -name "*test*" -o -name "*spec*" -o -name "*__tests__*" 2>/dev/null | head -20
find . -type f \( -name "*.test.*" -o -name "*.spec.*" -o -name "*Tests.fs" -o -name "*Test.fs" \) 2>/dev/null | head -20
ls package.json *.sln 2>/dev/null
```

Identify: test directories, naming conventions, test runner commands, framework (Jest, xUnit, Playwright, etc.).

If location is ambiguous:
```
AskUserQuestion(
  header: "Test Structure",
  question: "I found multiple test locations. Where should I create tests?",
  options: [list discovered locations]
)
```
</step>

<step name="generate_test_plan">
For each approved file, plan tests using discovered structure.

- **TDD**: identify testable functions → list input/output/edge-case scenarios per function
- **E2E**: identify user scenarios from CONTEXT.md/VERIFICATION.md → describe action, expected outcome, assertions

```
AskUserQuestion(
  header: "Test Plan",
  question: |
    ## Test Generation Plan

    ### Unit Tests ({N} tests across {M} files)
    {file → test path, test case list}

    ### E2E Tests ({P} tests across {Q} files)
    {file → test path, scenario list}

    ### Test Commands
    - Unit: {command}
    - E2E: {command}

    Ready to generate?
  options:
    - "Generate all"
    - "Cherry-pick (I'll specify which)"
    - "Adjust plan"
)
```

If "Cherry-pick" or "Adjust": apply user input before proceeding.
</step>

<step name="execute_tdd_generation">
For each approved TDD test:

1. Create test file following project conventions (directory, naming, imports)
2. Write test with arrange/act/assert structure
3. Run: `{discovered test command}`
4. Evaluate:
   - **Passes** → verify it tests meaningful behavior, not just compilation
   - **Fails with assertion error** → flag as potential bug; NEVER fix the implementation (this command generates tests, not fixes):
     ```
     ⚠️ Potential bug found: {test name}
     Expected: {expected} / Actual: {actual} / File: {impl file}
     ```
   - **Fails with import/syntax error** → fix the test and re-run
</step>

<step name="execute_e2e_generation">
For each approved E2E test:

1. Check for existing coverage: `grep -r "{scenario keyword}" {e2e dir} 2>/dev/null` — extend rather than duplicate if found
2. Create test file targeting the scenario from CONTEXT.md/VERIFICATION.md
3. Run: `{discovered e2e command}`
4. Evaluate:
   - **GREEN** → record success
   - **RED** → determine if test error or app bug; flag bugs:
     ```
     ⚠️ E2E failure: {test name} / Scenario: {desc} / Error: {msg}
     ```
   - **Cannot run** → report blocker; NEVER mark as complete without actually running:
     ```
     🛑 E2E blocker: {reason}
     ```
</step>

<step name="summary_and_commit">
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► TEST GENERATION COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Results
| Category | Generated | Passing | Failing | Blocked |
|----------|-----------|---------|---------|---------|
| Unit     | {N}       | {n1}    | {n2}    | {n3}    |
| E2E      | {M}       | {m1}    | {m2}    | {m3}    |

## Files Created/Modified
{test file paths}

## Coverage Gaps
{areas that couldn't be tested and why}

## Bugs Discovered
{assertion failures indicating implementation bugs}
```

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state-snapshot
```

If passing tests exist:
```bash
git add {test files}
git commit -m "test(phase-${phase_number}): add unit and E2E tests from add-tests command"
```

```
## ▶ Next Up

{if bugs:}     Fix: `/gsd2:fix ${phase_number} fix the {N} test failures discovered`
{if blocked:}  Resolve blockers: {description}
{otherwise:}   All tests passing — phase ${phase_number} is fully tested.

- `/gsd2:add-tests {next_phase}` — test another phase
- `/gsd2:verify-work {phase_number}` — run UAT verification
```
</step>

</process>

<success_criteria>
- [ ] Phase artifacts loaded; SUMMARY.md present
- [ ] All changed files classified TDD/E2E/Skip (read before classifying)
- [ ] Classification approved by user
- [ ] Test structure discovered (dirs, conventions, runners)
- [ ] Test plan approved by user
- [ ] TDD tests generated with arrange/act/assert; E2E tests target user scenarios
- [ ] All tests executed — no test marked passing without running
- [ ] Bugs flagged (not fixed); coverage gaps documented
- [ ] Test files committed; next steps presented
</success_criteria>
