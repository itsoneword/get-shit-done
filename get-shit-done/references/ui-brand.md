<ui_patterns>
User-facing output standards — visual patterns + communication standard. Extended examples: `ui-brand-guide.md` (reference only, not @-included).

## Stage Banners
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► {STAGE NAME}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
Names: QUESTIONING, RESEARCHING, DEFINING REQUIREMENTS, CREATING ROADMAP, PLANNING PHASE {N}, EXECUTING WAVE {N}, VERIFYING, PHASE {N} COMPLETE ✓, MILESTONE COMPLETE 🎉

## Checkpoint Boxes (62-char width)
```
╔══════════════════════════════════════════════════════════════╗
║  CHECKPOINT: {Type}                                          ║
╚══════════════════════════════════════════════════════════════╝
{Content}
──────────────────────────────────────────────────────────────
→ {ACTION PROMPT}
──────────────────────────────────────────────────────────────
```
Types: `Verification Required`→`Type "approved" or describe issues` | `Decision Required`→`Select: option-a / option-b` | `Action Required`→`Type "done" when complete`

## Status Symbols & Progress
✓ Complete/Passed/Verified · ✗ Failed/Missing/Blocked · ◆ In Progress · ○ Pending · ⚡ Auto-approved · ⚠ Warning · 🎉 Milestone (banner only)
`Progress: ████████░░ 80%` · `Tasks: 2/4 complete` · `Plans: 3/5 complete`

## Next Up Block (end of major completions)
```
───────────────────────────────────────────────────────────────
## ▶ Next Up
**{Identifier}: {Name}** — {one-line description}
`{copy-paste command}`
<sub>`/clear` first → fresh context window</sub>
───────────────────────────────────────────────────────────────
```
## Error Box
```
╔══════════════════════════════════════════════════════════════╗
║  ERROR                                                       ║
╚══════════════════════════════════════════════════════════════╝
{Error description}
**To fix:** {Resolution steps}
```

## Tables
```
| Phase | Status | Plans | Progress |
|-------|--------|-------|----------|
| 1     | ✓      | 3/3   | 100%     |
```

## Communication Standard
Neutral, professional, evidence-first — lead with evidence not affirmation, no reflexive praise as filler. Confirm only what's verified, tie confidence to basis (verified/inferred/unknown). Don't capitulate under pushback if evidence holds; don't over-correct into contrarianism. Tone, not length.

## Anti-Patterns
- Visual: inconsistent widths, mixed banner styles, missing `GSD ►` prefix, random emoji, missing Next Up block
- Tone: reflexive praise, filler agreement, mirroring user confidence, flipping verified answers under doubt, over-correcting into contrarianism
</ui_patterns>
