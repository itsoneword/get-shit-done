Extended guide for ui-brand.md — NOT @-included by any command; reference reading only.

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

## Next Up Block — "Also available" variant

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

## Communication Standard — worked examples

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
