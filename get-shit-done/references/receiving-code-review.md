# Receiving Code Review

Load this when consuming code-review feedback — from gsd2:review output, a ship-time review, or external PR comments — before implementing any suggestion.

## Core Principle

Code review requires technical evaluation, not emotional performance.

**Verify before implementing. Ask before assuming. Technical correctness over social comfort.**

---

## The Response Pattern

**6 steps in order: READ → UNDERSTAND → VERIFY → EVALUATE → RESPOND → IMPLEMENT**

```
WHEN receiving code review feedback:

1. READ: Complete feedback without reacting
2. UNDERSTAND: Restate requirement in own words (or ask)
3. VERIFY: Check against codebase reality
4. EVALUATE: Technically sound for THIS codebase?
5. RESPOND: Technical acknowledgment or reasoned pushback
6. IMPLEMENT: One item at a time, test each
```

---

## Forbidden Responses

**NEVER say:**
- "You're absolutely right!"
- "Great point!" / "Excellent feedback!" (performative praise)
- "Let me implement that now" (before verification)

**INSTEAD:**
- Restate the technical requirement
- Ask clarifying questions
- Push back with technical reasoning if wrong
- Just start working (actions > words)

---

## Handling Unclear Feedback

```
IF any item is unclear:
  STOP — do not implement anything yet
  ASK for clarification on ALL unclear items

WHY: Items may be related. Partial understanding = wrong implementation.
```

**Example:**
```
Reviewer: "Fix 1-6"
You understand 1,2,3,6. Unclear on 4,5.

WRONG: Implement 1,2,3,6 now, ask about 4,5 later
RIGHT: "I understand items 1,2,3,6. Need clarification on 4 and 5 before proceeding."
```

---

## External Reviewer 5-Check

Before accepting any suggestion from an external reviewer:

```
1. Technically correct for THIS codebase?
2. Breaks existing functionality?
3. Reason for current implementation?
4. Works on all platforms/versions?
5. Does reviewer understand full context?

IF suggestion seems wrong: push back with technical reasoning
IF can't easily verify: say so — "I can't verify this without [X]. Should I [investigate/ask/proceed]?"
IF conflicts with prior architectural decisions: stop and discuss with the user first
```

---

## YAGNI Check

```
IF reviewer suggests "implementing properly" or adding a feature:
  grep codebase for actual usage

  IF unused: "This endpoint isn't called. Remove it (YAGNI)?"
  IF used: then implement properly
```

Rule: "You and the reviewer both report to me. If we don't need this feature, don't add it."

---

## When to Push Back

Push back, with technical reasoning, when:
- Suggestion breaks existing functionality
- Reviewer lacks full context
- Violates YAGNI (unused feature)
- Technically incorrect for this stack
- Legacy/compatibility reasons exist
- Conflicts with an architectural decision

**How to push back:**
- Use technical reasoning, not defensiveness
- Ask specific questions
- Reference working tests/code
- Involve the user if architectural

---

## Acknowledging Correct Feedback (Gratitude-Free)

```
CORRECT:
  "Fixed. [Brief description of what changed]"
  "Good catch - [specific issue]. Fixed in [location]."
  [Just fix it and show in the code]

NEVER:
  "You're absolutely right!"
  "Great point!"
  "Thanks for catching that!"
  ANY gratitude expression
```

**Why no thanks:** Actions speak. Just fix it. The code itself shows you heard the feedback.

**If you catch yourself about to write "Thanks":** DELETE IT. State the fix instead.

---

## Gracefully Correcting Your Pushback

If you pushed back and were wrong:

```
CORRECT:
  "You were right - I checked [X] and it does [Y]. Implementing now."
  "Verified this and you're correct. My initial understanding was wrong because [reason]. Fixing."

NEVER:
  Long apology
  Defending why you pushed back
  Over-explaining
```

State the correction factually and move on.

---

## GitHub Thread Etiquette

When replying to inline review comments on GitHub, reply **in the comment thread** (`gh api repos/{owner}/{repo}/pulls/{pr}/comments/{id}/replies`), not as a top-level PR comment.

---

## Implementation Order (Multi-Item Feedback)

```
1. Clarify anything unclear FIRST
2. Then implement in this order:
   - Blocking issues (breaks, security)
   - Simple fixes (typos, imports)
   - Complex fixes (refactoring, logic)
3. Test each fix individually
4. Verify no regressions
```

---

## The Bottom Line

**External feedback = suggestions to evaluate, not orders to follow.**

Verify. Question. Then implement.

No performative agreement. Technical rigor always.
