<purpose>
Orchestrate developer profiling: consent, session analysis (or questionnaire fallback), profile generation, display, and artifact creation via gsd-tools.cjs subcommands and gsd-user-profiler agent.
</purpose>

<required_reading>
Read execution_context files first. Key refs:
- @$HOME/.claude/get-shit-done/references/ui-brand.md
- @$HOME/.claude/get-shit-done/agents/gsd-user-profiler.md
- @$HOME/.claude/get-shit-done/references/user-profiling.md
</required_reading>

<process>

## 1. Initialize

Parse $ARGUMENTS for `--questionnaire` (skip sessions) and `--refresh` (rebuild existing).

```bash
PROFILE_PATH="$HOME/.claude/get-shit-done/USER-PROFILE.md"
[ -f "$PROFILE_PATH" ] && echo "EXISTS" || echo "NOT_FOUND"
```

// if EXISTS && !--refresh && !--questionnaire:
AskUserQuestion header:"Existing Profile" question:"You already have a profile. What would you like to do?"
  - "View it" -> read USER-PROFILE.md, display as summary card, exit
  - "Refresh it" -> set --refresh, continue
  - "Cancel" -> display "No changes made.", exit

// if EXISTS && --refresh:
```bash
cp "$HOME/.claude/get-shit-done/USER-PROFILE.md" "$HOME/.claude/get-shit-done/USER-PROFILE.backup.md"
```
Display: "Re-analyzing your sessions to update your profile." -> step 2

// if NOT_FOUND: -> step 2

---

## 2. Consent Gate (ACTV-06)

If `--questionnaire`: skip to step 4b (no JSONL reading).

If `--refresh`, show abbreviated consent:
```
Re-analyzing your sessions to update your profile.
Your existing profile has been backed up to USER-PROFILE.backup.md.
```
AskUserQuestion header:"Refresh" question:"Continue with profile refresh?"
  - "Continue" -> step 3
  - "Cancel" -> exit

If default path, display consent screen:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD > PROFILE YOUR CODING STYLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Claude starts every conversation generic. A profile teaches Claude
how YOU actually work -- not how you think you work.

## What We'll Analyze

Your recent Claude Code sessions across 8 behavioral dimensions:

| Dimension            | What It Measures                            |
|----------------------|---------------------------------------------|
| Communication Style  | How you phrase requests (terse vs. detailed) |
| Decision Speed       | How you choose between options               |
| Explanation Depth    | How much explanation you want with code      |
| Debugging Approach   | How you tackle errors and bugs               |
| UX Philosophy        | How much you care about design vs. function  |
| Vendor Philosophy    | How you evaluate libraries and tools         |
| Frustration Triggers | What makes you correct Claude                |
| Learning Style       | How you prefer to learn new things           |

## Data Handling

✓ Reads session files locally (read-only, nothing modified)
✓ Analyzes message patterns (not content meaning)
✓ Stores profile at $HOME/.claude/get-shit-done/USER-PROFILE.md
✗ Nothing is sent to external services
✗ Sensitive content (API keys, passwords) is automatically excluded
```

AskUserQuestion header:"Ready?" question:"Ready to analyze your sessions?"
  - "Let's go" -> step 3
  - "Use questionnaire instead" -> step 4b
  - "Not now" -> display "No worries. Run /gsd2:profile-user when ready.", exit

---

## 3. Session Scan

Display: "◆ Scanning sessions..."

```bash
SCAN_RESULT=$(node $HOME/.claude/get-shit-done/bin/gsd-tools.cjs scan-sessions --json 2>/dev/null)
```

Parse JSON for session count (N) and project count (M).
Display: "✓ Found N sessions across M projects"

// if 0 sessions: display "No sessions found. Switching to questionnaire." -> step 4b
// else: -> step 4a

---

## 4a. Session Analysis Path

Display: "◆ Sampling messages..."

```bash
SAMPLE_RESULT=$(node $HOME/.claude/get-shit-done/bin/gsd-tools.cjs profile-sample --json 2>/dev/null)
```

Parse JSON for temp_dir path and message count.
Display: "✓ Sampled N messages from M projects"
Display: "◆ Analyzing patterns..."

Spawn `gsd-user-profiler` agent via Task tool with:
```
Read the profiling reference document and the sampled session messages, then analyze the developer's behavioral patterns across all 8 dimensions.

Reference: @$HOME/.claude/get-shit-done/references/user-profiling.md
Session data: @{temp_dir}/profile-sample.jsonl

Analyze these messages and return your analysis in the <analysis> JSON format specified in the reference document.
```

Extract `<analysis>` JSON from agent response. Write to `{temp_dir}/analysis.json`.

```bash
ANALYSIS_PATH="{temp_dir}/analysis.json"
```

Display: "✓ Analysis complete (N dimensions scored)"

// if < 50 messages analyzed: display "Note: Limited session data (N messages). Results may have lower confidence."

-> step 5

---

## 4b. Questionnaire Path

Display: "Using questionnaire to build your profile."

```bash
QUESTIONS=$(node $HOME/.claude/get-shit-done/bin/gsd-tools.cjs profile-questionnaire --json 2>/dev/null)
```

For each of 8 questions, AskUserQuestion with header=dimension name, question=text, options=answers.
Collect answers into JSON mapping dimension keys to selected values.

```bash
ANSWERS_PATH=$(mktemp /tmp/gsd-profile-answers-XXXXXX.json)
```
Write answers JSON to $ANSWERS_PATH.

```bash
ANALYSIS_RESULT=$(node $HOME/.claude/get-shit-done/bin/gsd-tools.cjs profile-questionnaire --answers "$ANSWERS_PATH" --json 2>/dev/null)
```

```bash
ANALYSIS_PATH=$(mktemp /tmp/gsd-profile-analysis-XXXXXX.json)
```
Write analysis JSON to $ANALYSIS_PATH.

-> step 5 (skip split resolution -- questionnaire handles ambiguity internally)

---

## 5. Split Resolution

Skip if questionnaire path.

Read analysis JSON from $ANALYSIS_PATH. For each dimension with `cross_project_consistent: false`:

AskUserQuestion header:dimension_name question:"Your sessions show different patterns: {split context}"
  - Rating option A
  - Rating option B
  - "Context-dependent (keep both)"

// specific rating: update dimension's `rating` field
// "Context-dependent": keep dominant rating, add `context_note` describing the split

Write updated analysis JSON back to $ANALYSIS_PATH.

---

## 6. Profile Write

Display: "◆ Writing profile..."

```bash
node $HOME/.claude/get-shit-done/bin/gsd-tools.cjs write-profile --input "$ANALYSIS_PATH" --json 2>/dev/null
```

Display: "✓ Profile written to $HOME/.claude/get-shit-done/USER-PROFILE.md"

---

## 7. Result Display

Read analysis JSON from $ANALYSIS_PATH.

Show report card (populate from actual analysis values):
```
## Your Profile

| Dimension            | Rating               | Confidence |
|----------------------|----------------------|------------|
| Communication Style  | detailed-structured  | HIGH       |
| Decision Speed       | deliberate-informed  | MEDIUM     |
| Explanation Depth    | concise              | HIGH       |
| Debugging Approach   | hypothesis-driven    | MEDIUM     |
| UX Philosophy        | pragmatic            | LOW        |
| Vendor Philosophy    | thorough-evaluator   | HIGH       |
| Frustration Triggers | scope-creep          | MEDIUM     |
| Learning Style       | self-directed        | HIGH       |
```

Show 3-4 highlights from highest-confidence dimensions using `evidence` and `summary` fields:
```
## Highlights

- **Communication (HIGH):** You consistently provide structured context with
  headers and problem statements before making requests
- **Vendor Choices (HIGH):** You research alternatives thoroughly -- comparing
  docs, GitHub activity, and bundle sizes before committing
- **Frustrations (MEDIUM):** You correct Claude most often for doing things
  you didn't ask for -- scope creep is your primary trigger
```
Format each as "You tend to..." or "You consistently..." with evidence attribution.

AskUserQuestion header:"Profile" question:"Want to see the full profile?"
  - "Yes" -> read and display USER-PROFILE.md, then step 8
  - "Continue to artifacts" -> step 8

---

## 8. Artifact Selection (ACTV-05)

AskUserQuestion multiSelect header:"Artifacts" question:"Which artifacts should I generate?" (all pre-selected):
  - "/gsd2:dev-preferences command file" -- "Load your preferences in any session"
  - "CLAUDE.md profile section" -- "Add profile to this project's CLAUDE.md"
  - "Global CLAUDE.md" -- "Add profile to $HOME/.claude/CLAUDE.md for all projects"

If none selected: display "No artifacts generated. Your profile is saved at $HOME/.claude/get-shit-done/USER-PROFILE.md" -> step 10

---

## 9. Artifact Generation

Generate selected artifacts sequentially. On failure: AskUserQuestion "Retry" / "Skip this artifact".

```bash
# /gsd2:dev-preferences (if selected)
node $HOME/.claude/get-shit-done/bin/gsd-tools.cjs generate-dev-preferences --analysis "$ANALYSIS_PATH" --json 2>/dev/null
# -> "✓ Generated /gsd2:dev-preferences at $HOME/.claude/commands/gsd/dev-preferences.md"

# CLAUDE.md profile section (if selected)
node $HOME/.claude/get-shit-done/bin/gsd-tools.cjs generate-claude-profile --analysis "$ANALYSIS_PATH" --json 2>/dev/null
# -> "✓ Added profile section to CLAUDE.md"

# Global CLAUDE.md (if selected)
node $HOME/.claude/get-shit-done/bin/gsd-tools.cjs generate-claude-profile --analysis "$ANALYSIS_PATH" --global --json 2>/dev/null
# -> "✓ Added profile section to $HOME/.claude/CLAUDE.md"
```

---

## 10. Summary & Cleanup

If --refresh: read backup at `$HOME/.claude/get-shit-done/USER-PROFILE.backup.md`, compare dimensions. Show diff of changed dimensions only:
```
## Changes

| Dimension       | Before                      | After                        |
|-----------------|-----------------------------|-----------------------------|
| Communication   | terse-direct (LOW)          | detailed-structured (HIGH)  |
| Debugging       | fix-first (MEDIUM)          | hypothesis-driven (MEDIUM)  |
```
If nothing changed: "No changes detected -- your profile is already up to date."

Display final summary:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD > PROFILE COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your profile:    $HOME/.claude/get-shit-done/USER-PROFILE.md
```

List only generated artifacts:
```
Artifacts:
  ✓ /gsd2:dev-preferences   $HOME/.claude/commands/gsd/dev-preferences.md
  ✓ CLAUDE.md section       ./CLAUDE.md
  ✓ Global CLAUDE.md        $HOME/.claude/CLAUDE.md
```

Clean up temp files created during this run:
```bash
rm -rf "$TEMP_DIR"
rm -f "$ANSWERS_PATH" "$ANALYSIS_PATH" 2>/dev/null
```

</process>

<success_criteria>
- [ ] Init detects existing profile; handles view/refresh/cancel
- [ ] Consent gate shown for session path, skipped for questionnaire
- [ ] Session scan reports statistics; 0 sessions falls back to questionnaire
- [ ] Session path: samples, spawns profiler agent, extracts analysis JSON
- [ ] Questionnaire path: 8 questions, answers converted to analysis JSON
- [ ] Split resolution resolves cross-project inconsistencies
- [ ] Profile written via write-profile subcommand
- [ ] Result display: report card table + highlight reel with evidence
- [ ] Artifact selection uses multiSelect, all pre-selected
- [ ] Artifacts generated sequentially via gsd-tools.cjs
- [ ] Refresh diff shows changed dimensions
- [ ] Temp files cleaned up
</success_criteria>
