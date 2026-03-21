<purpose>
Create all phases needed to close gaps from `/gsd2:audit-milestone`. Reads MILESTONE-AUDIT.md, groups gaps into logical phases, adds them to ROADMAP.md, and offers to plan each. One command creates all fix phases.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

## 1. Load Audit Results

```bash
ls -t .planning/v*-MILESTONE-AUDIT.md 2>/dev/null | head -1
```

Parse YAML frontmatter gaps: `gaps.requirements`, `gaps.integration`, `gaps.flows`.

If no audit file or no gaps: error `No audit gaps found. Run /gsd2:audit-milestone first.`

## 2. Prioritize Gaps

| Priority | Action |
|----------|--------|
| `must` | Create phase, blocks milestone |
| `should` | Create phase, recommended |
| `nice` | Ask user: include or defer? |

For integration/flow gaps, infer priority from affected requirements.

## 3. Group Gaps into Phases

Cluster related gaps — same affected phase, same subsystem (auth/API/UI), or dependency order. Keep phases focused: 2-4 tasks each.

Example:
```
Gap: DASH-01 (Dashboard doesn't fetch) + Integration Phase 1→3 (no auth header) + Flow "View dashboard" broken
→ Phase 6: "Wire Dashboard to API" — fetch, auth header, state, render
```

## 4. Determine Phase Numbers

```bash
PHASES=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" phases list)
HIGHEST=$(printf '%s\n' "$PHASES" | jq -r '.directories[-1]')
# New phases continue from HIGHEST+1
```

## 5. Present Gap Closure Plan

```markdown
## Gap Closure Plan

**Milestone:** {version}
**Gaps to close:** {N} requirements, {M} integration, {K} flows

### Proposed Phases

**Phase {N}: {Name}**
Closes:
- {REQ-ID}: {description}
- Integration: {from} → {to}
Tasks: {count}

**Phase {N+1}: {Name}**
Closes:
- {REQ-ID}: {description}
- Flow: {flow name}
Tasks: {count}

{If nice-to-have gaps exist:}
### Deferred (nice-to-have)
Include these optional gaps?
- {gap description}

---
Create these {X} phases? (yes / adjust / defer all optional)
```

Wait for user confirmation.

## 6. Update ROADMAP.md

```markdown
### Phase {N}: {Name}
**Goal:** {derived from gaps being closed}
**Requirements:** {REQ-IDs being satisfied}
**Gap Closure:** Closes gaps from audit
```

## 7. Update REQUIREMENTS.md Traceability (REQUIRED)

- Update Phase column for each REQ-ID assigned to a gap closure phase; set Status to `Pending`
- Reset `[x]` → `[ ]` for any requirement the audit found unsatisfied
- Update coverage count at top of file

```bash
grep -c "Pending" .planning/REQUIREMENTS.md
```

## 8. Create Phase Directories

```bash
mkdir -p ".planning/phases/{NN}-{name}"
```

## 9. Commit

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(roadmap): add gap closure phases {N}-{M}" --files .planning/ROADMAP.md .planning/REQUIREMENTS.md
```

## 10. Offer Next Steps

```markdown
## ✓ Gap Closure Phases Created

**Phases added:** {N} - {M}
**Gaps addressed:** {count} requirements, {count} integration, {count} flows

---

## ▶ Next Up

`/gsd2:plan-phase {N}`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `/gsd2:execute-phase {N}` — if plans already exist
- `cat .planning/ROADMAP.md` — see updated roadmap

**After all gap phases complete:**
`/gsd2:audit-milestone` — re-audit | `/gsd2:complete-milestone {version}` — archive when audit passes
```

</process>

<gap_to_phase_mapping>

## How Gaps Become Tasks

**Requirement gap:**
```yaml
gap: { id: DASH-01, reason: "Dashboard exists but doesn't fetch from API",
  missing: [useEffect with fetch, useState for data, render JSX] }
→ phase: "Wire Dashboard Data"
  tasks: [Add data fetching, Add state management, Render user data]
  files: [src/components/Dashboard.tsx]
```

**Integration gap:**
```yaml
gap: { from_phase: 1, to_phase: 3, connection: "Auth token → API calls",
  missing: [auth header in fetch, token refresh on 401] }
→ phase: "Add Auth to Dashboard API Calls"
  tasks: [Add auth header to fetches, Handle 401 responses]
  files: [src/components/Dashboard.tsx, src/lib/api.ts]
```

**Flow gap:** Usually maps to the same phase as overlapping requirement/integration gaps.

</gap_to_phase_mapping>

<success_criteria>
- [ ] MILESTONE-AUDIT.md loaded and gaps parsed
- [ ] Gaps prioritized (must/should/nice)
- [ ] Gaps grouped into logical phases
- [ ] User confirmed phase plan
- [ ] ROADMAP.md updated with new phases
- [ ] REQUIREMENTS.md traceability table updated with gap closure phase assignments
- [ ] Unsatisfied requirement checkboxes reset (`[x]` → `[ ]`)
- [ ] Coverage count updated in REQUIREMENTS.md
- [ ] Phase directories created
- [ ] Changes committed (includes REQUIREMENTS.md)
- [ ] User knows to run `/gsd2:plan-phase` next
</success_criteria>
