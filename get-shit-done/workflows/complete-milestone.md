<purpose>

Mark a shipped version (v1.0, v1.1, v2.0) as complete. Creates MILESTONES.md entry, performs PROJECT.md evolution review, reorganizes ROADMAP.md, archives milestone artifacts, and tags the release.

</purpose>

<required_reading>

1. templates/milestone.md
2. templates/milestone-archive.md
3. `.planning/ROADMAP.md`
4. `.planning/REQUIREMENTS.md`
5. `.planning/PROJECT.md`

</required_reading>

<archival_behavior>

On milestone completion:

1. Extract milestone details to `.planning/milestones/v[X.Y]-ROADMAP.md`
2. Archive requirements to `.planning/milestones/v[X.Y]-REQUIREMENTS.md`
3. Replace milestone details in ROADMAP.md with one-line summary
4. Delete REQUIREMENTS.md (fresh for next milestone)
5. Full PROJECT.md evolution review
6. Offer to create next milestone
7. Archive UI artifacts (`*-UI-SPEC.md`, `*-UI-REVIEW.md`) alongside phase docs
8. Clean up `.planning/ui-reviews/` screenshot files (binary assets, never archived)

Archives keep ROADMAP.md constant-size and REQUIREMENTS.md milestone-scoped.

**ROADMAP archive** uses `templates/milestone-archive.md` — includes milestone header, full phase details, milestone summary.

**REQUIREMENTS archive** contains completed requirements with outcomes, traceability table with final status, notes on changed requirements.

</archival_behavior>

<process>

<step name="verify_readiness">

```bash
ROADMAP=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap analyze)
```

Verify from result:
- Which phases belong to this milestone
- All phases complete (`disk_status === 'complete'`, `progress_percent` 100%)

**Requirements completion check (MUST do before presenting):** Parse REQUIREMENTS.md traceability table — count total vs checked-off (`[x]`) requirements.

Present:

```
Milestone: [Name, e.g., "v1.0 MVP"]

Includes:
- Phase 1: Foundation (2/2 plans complete)
- Phase 2: Authentication (2/2 plans complete)

Total: {phase_count} phases, {total_plans} plans, all complete
Requirements: {N}/{M} v1 requirements checked off
```

If requirements incomplete (N < M), show unchecked items and present 3 options:
1. **Proceed anyway** — mark complete with known gaps (record in MILESTONES.md under `### Known Gaps`)
2. **Run audit first** — `/gsd2:audit-milestone`
3. **Abort** — return to development

<config-check>

```bash
cat .planning/config.json 2>/dev/null
```

</config-check>

<if mode="yolo">

Auto-approve scope verification, show summary, proceed to gather_stats.

</if>

<if mode="interactive" OR="custom with gates.confirm_milestone_scope true">

```
Ready to mark this milestone as shipped?
(yes / wait / adjust scope)
```

- "adjust scope": Ask which phases to include.
- "wait": Stop, user returns when ready.

</if>

</step>

<step name="gather_stats">

```bash
git log --oneline --grep="feat(" | head -20
git diff --stat FIRST_COMMIT..LAST_COMMIT | tail -1
find . -name "*.swift" -o -name "*.ts" -o -name "*.py" | xargs wc -l 2>/dev/null
git log --format="%ai" FIRST_COMMIT | tail -1
git log --format="%ai" LAST_COMMIT | head -1
```

Present:

```
Milestone Stats:
- Phases: [X-Y]
- Plans: [Z] total
- Tasks: [N] total (from phase summaries)
- Files modified: [M]
- Lines of code: [LOC] [language]
- Timeline: [Days] days ([Start] → [End])
- Git range: feat(XX-XX) → feat(YY-YY)
```

</step>

<step name="extract_accomplishments">

```bash
for summary in .planning/phases/*-*/*-SUMMARY.md; do
  node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" summary-extract "$summary" --fields one_liner | jq -r '.one_liner'
done
```

Extract 4-6 key accomplishments and present as numbered list.

</step>

<step name="create_milestone_entry">

MILESTONES.md entry is created automatically by `gsd-tools milestone complete` in archive_milestone step. If additional details are needed (user-provided summary, git range, LOC stats), add them manually after.

</step>

<step name="evolve_project_full_review">

Read all phase summaries:

```bash
cat .planning/phases/*-*/*-SUMMARY.md
```

**Full review checklist — update PROJECT.md inline:**

1. **"What This Is"** — compare description to what was built, update if meaningfully changed
2. **Core Value** — still the right priority? Update if shifted
3. **Requirements audit:**
   - Shipped requirements → move to Validated (`- ✓ [Requirement] — v[X.Y]`)
   - Remove from Active, add new requirements for next milestone
   - Out of Scope — review reasoning, remove irrelevant, add invalidated items
4. **Context** — current codebase state (LOC, stack), user feedback themes, known issues/debt
5. **Key Decisions** — extract from milestone summaries, add to table with outcomes (✓ Good / ⚠️ Revisit / — Pending)
6. **Constraints** — update any that changed during development

Update "Last updated" footer:

```markdown
---
*Last updated: [date] after v[X.Y] milestone*
```

Step complete when: "What This Is" reviewed, Core Value verified, shipped requirements validated, new Active requirements added, Out of Scope audited, Context updated, Key Decisions added, footer updated.

</step>

<step name="reorganize_roadmap">

Update `.planning/ROADMAP.md` — group completed milestone phases under collapsible details, keep active/planned phases visible. Include progress table with milestone column.

```markdown
# Roadmap: [Project Name]

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped YYYY-MM-DD)
- 🚧 **v1.1 Security** — Phases 5-6 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED YYYY-MM-DD</summary>

- [x] Phase 1: Foundation (2/2 plans) — completed YYYY-MM-DD
- [x] Phase 2: Authentication (2/2 plans) — completed YYYY-MM-DD

</details>

### 🚧 v[Next] [Name] (In Progress / Planned)

- [ ] Phase 5: [Name] ([N] plans)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
| ----- | --------- | -------------- | ------ | --------- |
| 1. Foundation | v1.0 | 2/2 | Complete | YYYY-MM-DD |
```

</step>

<step name="archive_milestone">

```bash
ARCHIVE=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" milestone complete "v[X.Y]" --name "[Milestone Name]")
```

CLI handles: creating `.planning/milestones/`, archiving ROADMAP.md and REQUIREMENTS.md, moving audit file, creating MILESTONES.md entry, updating STATE.md.

Extract from result: `version`, `date`, `phases`, `plans`, `tasks`, `accomplishments`, `archived`.

**Phase archival:** Ask user whether to move phase directories to `milestones/v[X.Y]-phases/` or keep in place (can use `/gsd2:cleanup` later).

If yes:
```bash
mkdir -p .planning/milestones/v[X.Y]-phases
mv .planning/phases/{phase-dir} .planning/milestones/v[X.Y]-phases/
```

After archival, AI still handles (requires judgment, not delegated to CLI):
- Reorganizing ROADMAP.md with milestone grouping
- Full PROJECT.md evolution review
- Deleting original ROADMAP.md and REQUIREMENTS.md

</step>

<step name="reorganize_roadmap_and_delete_originals">

Reorganize ROADMAP.md with milestone groupings (same format as reorganize_roadmap step), then delete originals:

```bash
rm .planning/ROADMAP.md
rm .planning/REQUIREMENTS.md
```

</step>

<step name="write_retrospective">

```bash
ls .planning/RETROSPECTIVE.md 2>/dev/null
```

If exists: append new milestone section before "## Cross-Milestone Trends".
If not: create from `~/.claude/get-shit-done/templates/retrospective.md`.

**Gather data from:** SUMMARY.md (deliverables, decisions), VERIFICATION.md (scores, gaps), UAT.md (test results), git log (commits, timeline).

**Write milestone section:**

```markdown
## Milestone: v{version} — {name}

**Shipped:** {date}
**Phases:** {phase_count} | **Plans:** {plan_count}

### What Was Built
{From SUMMARY.md one-liners}

### What Worked
{Patterns that led to smooth execution}

### What Was Inefficient
{Rework, bottlenecks, missed opportunities}

### Patterns Established
{New conventions from this milestone}

### Key Lessons
{Specific, actionable takeaways}

### Cost Observations
- Model mix: {X}% opus, {Y}% sonnet, {Z}% haiku
- Sessions: {count}
- Notable: {efficiency observation}
```

Update cross-milestone trends if section exists.

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs: update retrospective for v${VERSION}" --files .planning/RETROSPECTIVE.md
```

</step>

<step name="update_state">

Verify STATE.md fields not handled by `milestone complete`:

- **Project Reference:** point to PROJECT.md with update date, current core value, current focus (next milestone or "Planning next milestone")
- **Accumulated Context:** clear decisions summary and resolved blockers, keep open blockers for next milestone

</step>

<step name="handle_branches">

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init execute-phase "1")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Extract `branching_strategy`, `phase_branch_template`, `milestone_branch_template`, `commit_docs`.

If "none": skip to git_tag.

Find branches matching template prefix:

```bash
# For phase strategy:
BRANCH_PREFIX=$(echo "$PHASE_BRANCH_TEMPLATE" | sed 's/{.*//')
PHASE_BRANCHES=$(git branch --list "${BRANCH_PREFIX}*" 2>/dev/null | sed 's/^\*//' | tr -d ' ')

# For milestone strategy:
BRANCH_PREFIX=$(echo "$MILESTONE_BRANCH_TEMPLATE" | sed 's/{.*//')
MILESTONE_BRANCH=$(git branch --list "${BRANCH_PREFIX}*" 2>/dev/null | sed 's/^\*//' | tr -d ' ' | head -1)
```

If no branches found: skip to git_tag.

If branches exist, present options: Squash merge (recommended), Merge with history, Delete without merging, Keep branches.

**Squash merge:**

```bash
CURRENT_BRANCH=$(git branch --show-current)
git checkout main

# For phase strategy: loop over PHASE_BRANCHES
# For milestone strategy: use MILESTONE_BRANCH
git merge --squash "$branch"
if [ "$COMMIT_DOCS" = "false" ]; then
  git reset HEAD .planning/ 2>/dev/null || true
fi
git commit -m "feat: $branch for v[X.Y]"

git checkout "$CURRENT_BRANCH"
```

**Merge with history:** Same flow but use `git merge --no-ff --no-commit "$branch"` instead of `--squash`.

**Delete without merging:**

```bash
# Use -d, fall back to -D
git branch -d "$branch" 2>/dev/null || git branch -D "$branch"
```

**Keep branches:** Report "Branches preserved for manual handling"

</step>

<step name="git_tag">

```bash
git tag -a v[X.Y] -m "v[X.Y] [Name]

Delivered: [One sentence]

Key accomplishments:
- [Item 1]
- [Item 2]
- [Item 3]

See .planning/MILESTONES.md for full details."
```

Ask: "Push tag to remote? (y/n)"

If yes:
```bash
git push origin v[X.Y]
```

</step>

<step name="git_commit_milestone">

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "chore: complete v[X.Y] milestone" --files .planning/milestones/v[X.Y]-ROADMAP.md .planning/milestones/v[X.Y]-REQUIREMENTS.md .planning/milestones/v[X.Y]-MILESTONE-AUDIT.md .planning/MILESTONES.md .planning/PROJECT.md .planning/STATE.md
```

</step>

<step name="offer_next">

```
✅ Milestone v[X.Y] [Name] complete

Shipped:
- [N] phases ([M] plans, [P] tasks)
- [One sentence of what shipped]

Archived:
- milestones/v[X.Y]-ROADMAP.md
- milestones/v[X.Y]-REQUIREMENTS.md

Summary: .planning/MILESTONES.md
Tag: v[X.Y]

---

## ▶ Next Up

**Start Next Milestone** — `/gsd2:new-milestone`

<sub>`/clear` first → fresh context window</sub>

---
```

</step>

</process>

<milestone_naming>

- **v1.0** — Initial MVP
- **v1.1, v1.2** — Minor updates, new features, fixes
- **v2.0, v3.0** — Major rewrites, breaking changes

Names: Short 1-2 words (v1.0 MVP, v1.1 Security, v2.0 Redesign).

</milestone_naming>

<what_qualifies>

Create milestones for: initial release, public releases, major feature sets shipped, before archiving planning.

Don't create for: every phase completion, work in progress, internal dev iterations.

Heuristic: "Is this deployed/usable/shipped?" Yes → milestone. No → keep working.

</what_qualifies>

<success_criteria>

- [ ] MILESTONES.md entry created with stats and accomplishments
- [ ] PROJECT.md full evolution review completed (requirements validated, decisions updated)
- [ ] ROADMAP.md reorganized with milestone grouping
- [ ] Archives created (milestones/v[X.Y]-ROADMAP.md, v[X.Y]-REQUIREMENTS.md)
- [ ] REQUIREMENTS.md deleted
- [ ] STATE.md updated
- [ ] Git tag created (v[X.Y])
- [ ] Milestone commit made
- [ ] Requirements completion checked; incomplete requirements surfaced with proceed/audit/abort options
- [ ] RETROSPECTIVE.md updated with milestone section and cross-milestone trends
- [ ] User knows next step (/gsd2:new-milestone)

</success_criteria>
