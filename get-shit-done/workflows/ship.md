<purpose>
Create a PR from completed phase/milestone work, generate a rich PR body from planning artifacts, optionally run code review, and prepare for merge. Closes the plan → execute → verify → ship loop.
</purpose>

<process>

<step name="initialize">
```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
CONFIG=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state load)
```
Parse from INIT: `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `padded_phase`, `commit_docs`.
Parse from CONFIG: `branching_strategy`, `branch_name`.
</step>

<step name="preflight_checks">
```bash
VERIFICATION=$(cat ${PHASE_DIR}/*-VERIFICATION.md 2>/dev/null)
git status --short
CURRENT_BRANCH=$(git branch --show-current)
git remote -v | head -2
which gh && gh auth status 2>&1
```

# Evaluate in order — abort on unresolved blockers:
# 1. VERIFICATION: status must be `passed` or `human_needed` (with approval); else warn+confirm
# 2. Working tree: uncommitted changes → ask user to commit or stash
# 3. Branch: on main/master → warn; branching_strategy=none → offer to create branch
# 4. Remote: no `origin` → MUST error and exit (can't create PR without remote)
# 5. gh CLI: not found or unauthenticated → provide setup instructions and exit
</step>

<step name="push_branch">
```bash
git push origin ${CURRENT_BRANCH} 2>&1 || git push --set-upstream origin ${CURRENT_BRANCH} 2>&1
```
Report: "Pushed `{branch}` to origin ({commit_count} commits ahead of main)"
</step>

<step name="generate_pr_body">
Read `ROADMAP.md` for phase goal, `VERIFICATION.md` for status, `SUMMARY.md` files for changes, plan frontmatter for REQ-IDs, `STATE.md` for key decisions.

Build PR body:
```markdown
## Summary
**Phase {N}: {Name}**
**Goal:** {goal from ROADMAP.md}
**Status:** Verified ✓

{One paragraph synthesized from SUMMARY.md — what was built}

## Changes
### Plan {plan_id}: {plan_name}
{one_liner from SUMMARY.md frontmatter}
**Key files:** {key-files.created and key-files.modified}

## Requirements Addressed
{REQ-IDs linked to REQUIREMENTS.md descriptions}

## Verification
- [x] Automated verification: {pass/fail from VERIFICATION.md}
- {human verification items, if any}

## Key Decisions
{Decisions from STATE.md relevant to this phase}
```
Title: `Phase {phase_number}: {phase_name}` (or `Milestone {version}: {name}` for milestones)
</step>

<step name="create_pr">
```bash
gh pr create \
  --title "Phase ${PHASE_NUMBER}: ${PHASE_NAME}" \
  --body "${PR_BODY}" \
  --base main
# Add --draft if --draft flag was passed
```
Report: "PR #{number} created: {url}"
</step>

<step name="optional_review">
```
AskUserQuestion:
  question: "PR created. Run a code review before merge?"
  options:
    - label: "Skip review"
      description: "PR is ready — merge when CI passes"
    - label: "Self-review"
      description: "I'll review the diff in the PR myself"
    - label: "Request review"
      description: "Request review from a teammate"
```
# If "Request review": gh pr edit ${PR_NUMBER} --add-reviewer "${REVIEWER}"
# If "Self-review": report PR URL, suggest reviewing at {url}/files
</step>

<step name="track_shipping">
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state update "Last Activity" "$(date +%Y-%m-%d)"
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state update "Status" "Phase ${PHASE_NUMBER} shipped — PR #${PR_NUMBER}"
```
If `commit_docs` is true:
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(${padded_phase}): ship phase ${PHASE_NUMBER} — PR #${PR_NUMBER}" --files .planning/STATE.md
```
</step>

<step name="report">
```
───────────────────────────────────────────────────────────────

## ✓ Phase {X}: {Name} — Shipped

PR: #{number} ({url})
Branch: {branch} → main
Commits: {count}
Verification: ✓ Passed
Requirements: {N} REQ-IDs addressed

Next steps:
- Review/approve PR
- Merge when CI passes
- /gsd2:complete-milestone (if last phase in milestone)
- /gsd2:progress (to see what's next)

───────────────────────────────────────────────────────────────
```
</step>

</process>

<offer_next>
- /gsd2:complete-milestone — if all phases in milestone are done
- /gsd2:progress — see overall project state
- /gsd2:execute-phase {next} — continue to next phase
</offer_next>

<success_criteria>
- [ ] Preflight checks passed (verification, clean tree, branch, remote, gh)
- [ ] Branch pushed to remote
- [ ] PR created with rich auto-generated body
- [ ] STATE.md updated with shipping status
- [ ] User knows PR number and next steps
</success_criteria>
