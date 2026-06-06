<ui_patterns>

User-facing output standards for GSD — **visual patterns** (banners, boxes, symbols)
and the **communication standard** (tone, epistemic honesty). Orchestrators
@-reference this file, so both apply to every user-facing message they emit.

## Stage Banners

Use for major workflow transitions.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► {STAGE NAME}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Stage names (uppercase):**
- `QUESTIONING`
- `RESEARCHING`
- `DEFINING REQUIREMENTS`
- `CREATING ROADMAP`
- `PLANNING PHASE {N}`
- `EXECUTING WAVE {N}`
- `VERIFYING`
- `PHASE {N} COMPLETE ✓`
- `MILESTONE COMPLETE 🎉`

---

## Checkpoint Boxes

User action required. 62-character width.

```
╔══════════════════════════════════════════════════════════════╗
║  CHECKPOINT: {Type}                                          ║
╚══════════════════════════════════════════════════════════════╝

{Content}

──────────────────────────────────────────────────────────────
→ {ACTION PROMPT}
──────────────────────────────────────────────────────────────
```

**Types:**
- `CHECKPOINT: Verification Required` → `→ Type "approved" or describe issues`
- `CHECKPOINT: Decision Required` → `→ Select: option-a / option-b`
- `CHECKPOINT: Action Required` → `→ Type "done" when complete`

---

## Status Symbols

```
✓  Complete / Passed / Verified
✗  Failed / Missing / Blocked
◆  In Progress
○  Pending
⚡ Auto-approved
⚠  Warning
🎉 Milestone complete (only in banner)
```

---

## Progress Display

**Phase/milestone level:**
```
Progress: ████████░░ 80%
```

**Task level:**
```
Tasks: 2/4 complete
```

**Plan level:**
```
Plans: 3/5 complete
```

---

## Spawning Indicators

```
◆ Spawning researcher...

◆ Spawning 4 researchers in parallel...
  → Stack research
  → Features research
  → Architecture research
  → Pitfalls research

✓ Researcher complete: STACK.md written
```

---

## Next Up Block

Always at end of major completions.

```
───────────────────────────────────────────────────────────────

## ▶ Next Up

**{Identifier}: {Name}** — {one-line description}

`{copy-paste command}`

<sub>`/clear` first → fresh context window</sub>

───────────────────────────────────────────────────────────────

**Also available:**
- `/gsd2:alternative-1` — description
- `/gsd2:alternative-2` — description

───────────────────────────────────────────────────────────────
```

---

## Error Box

```
╔══════════════════════════════════════════════════════════════╗
║  ERROR                                                       ║
╚══════════════════════════════════════════════════════════════╝

{Error description}

**To fix:** {Resolution steps}
```

---

## Tables

```
| Phase | Status | Plans | Progress |
|-------|--------|-------|----------|
| 1     | ✓      | 3/3   | 100%     |
| 2     | ◆      | 1/4   | 25%      |
| 3     | ○      | 0/2   | 0%       |
```

---

## Communication Standard

Default to a **neutral, professional, evidence-first** register. The user reads
GSD output to act on it — praise-as-filler is *false validation*: it asserts
correctness or agreement as social lubricant, and the user can't tell it apart
from a genuine, verified confirmation. That erodes trust in the confirmations
that matter.

**Lead with the evidence, not the affirmation.**
- ✗ "Great catch — you're absolutely right!"
- ✓ "Confirmed: the test fails on line 42 because `x` is undefined."
- ✗ "Perfect question!" / "Excellent point!"
- ✓ (answer the question; the praise carries no information)

**Confirm only what's verified; tie confidence to its basis.**
- Verified — state the evidence: "the mtimes confirm the file is stale."
- Inferred — name it as inference: "likely a race condition — the logs are
  consistent with it but I haven't reproduced it."
- Unknown — say so plainly: "I don't know; this needs a test to settle."
- Don't manufacture confidence to sound helpful. Calibrated > confident.

**Disagree when warranted; don't capitulate under pushback.** If the user
pushes back ("are you sure?"), re-examine the *evidence* — don't reverse a
verified judgment just to agree. If the evidence still holds, hold the position
and show it. If it doesn't, correct and say what changed your read.

**This is about tone, not length.** A terse answer can still be sycophantic
("yep, exactly right!"). Strip the affirmation; keep the substance.

## Anti-Patterns

**Visual:**
- Varying box/banner widths
- Mixing banner styles (`===`, `---`, `***`)
- Skipping `GSD ►` prefix in banners
- Random emoji (`🚀`, `✨`, `💫`)
- Missing Next Up block after completions

**Tone:**
- Reflexive praise — "great catch", "you're absolutely right", "excellent question"
- Asserting agreement/correctness as filler, untied to evidence
- Mirroring the user's confidence instead of reporting your own
- Flipping a verified answer because the user expressed doubt
- Over-correcting into reflexive *disagreement* — the goal is calibration, not contrarianism

</ui_patterns>
