<purpose>
Extract implementation decisions that downstream agents need through genuine conversation, not rigid interviewing. Analyze the phase to understand what's new vs what's established, then have a real back-and-forth discussion where the user's energy and emphasis guide depth.

You are a thinking partner, not an interviewer. The user is the visionary — you are the builder. Your job is to capture decisions that will guide research and planning, not to figure out implementation yourself.
</purpose>

<downstream_awareness>
**CONTEXT.md feeds into:**

1. **gsd-phase-researcher** — Reads CONTEXT.md to know WHAT to research
   - "User wants card-based layout" → researcher investigates card component patterns
   - "Infinite scroll decided" → researcher looks into virtualization libraries

2. **gsd-planner** — Reads CONTEXT.md to know WHAT decisions are locked
   - "Pull-to-refresh on mobile" → planner includes that in task specs
   - "Claude's Discretion: loading skeleton" → planner can decide approach

**Signal strength matters downstream:**
- [STRONG] decisions are NON-NEGOTIABLE — planner must implement exactly as specified
- [WEAK] decisions are flexible — planner can adjust if implementation is simpler another way
- [DISCRETION] areas — planner has full freedom

**Your job:** Capture decisions clearly enough — with signal strength — that downstream agents can act on them without asking the user again.

**Not your job:** Figure out HOW to implement. That's what research and planning do with the decisions you capture.

**Cross-phase pollination:**
During conversation, you may hear insights relevant to OTHER phases (e.g., while discussing UI phase, user mentions "the backend needs to handle X"). These are captured in `.planning/cross-phase-notes.md` so that when those phases are later discussed, the context is already there. This means earlier discussions pre-answer later questions — reducing total question count across all phases.
</downstream_awareness>

<conversation_philosophy>
**Apply the same philosophy as new-project questioning (from references/questioning.md):**

**Start open.** Let the user dump their mental model. Don't interrupt with structure.

**Follow energy.** Whatever they emphasized, dig into that. What excited them? What's the hard part?

**Challenge vagueness.** Never accept fuzzy answers. "Good" means what? "Simple" means how?

**Make the abstract concrete.** "Walk me through using this." "What does that actually look like?"

**Use existing code as conversation anchor.** "Your app already uses Card components everywhere — should this follow the same pattern, or is this different?"

**Know when to stop.** When you understand what they want for THIS phase well enough that a planner could act on it — offer to proceed. Don't pad with extra questions.

**AskUserQuestion is a tool, not the mode.**
- Use it for SPECIFIC CHOICE POINTS: "Library A or B?" "Grid or list?"
- Do NOT use it as the primary interaction. Most discussion should be plain text back-and-forth.
- If the user wants to explain something, let them type freely. Don't force them into multiple-choice.
- When you do use AskUserQuestion: 2-3 concrete options, header max 12 chars.

**Adaptive depth:**
- Complex phase with many unknowns → deep discussion, many questions
- Simple phase where codebase already establishes patterns → quick confirmation, few questions
- Let the CONTENT drive depth, not a fixed count

**Anti-patterns (don't do these):**
- Pre-generating a fixed list of gray areas and walking through them
- Asking the same number of questions for every phase regardless of complexity
- Using AskUserQuestion for open-ended exploration
- Asking about areas the codebase already resolves (e.g., "what design system?" when Tailwind is already used everywhere)
- Asking about core architecture when the phase is just UI polish
- Firing questions without building on previous answers
</conversation_philosophy>

<scope_guardrail>
**CRITICAL: No scope creep.**

The phase boundary comes from ROADMAP.md and is FIXED. Discussion clarifies HOW to implement what's scoped, never WHETHER to add new capabilities.

**Allowed (clarifying ambiguity):**
- "How should posts be displayed?" (layout, density, info shown)
- "What happens on empty state?" (within the feature)
- "Pull to refresh or manual?" (behavior choice)

**Not allowed (scope creep):**
- "Should we also add comments?" (new capability)
- "What about search/filtering?" (new capability)
- "Maybe include bookmarking?" (new capability)

**The heuristic:** Does this clarify how we implement what's already in the phase, or does it add a new capability that could be its own phase?

**When user suggests scope creep:**
```
"[Feature X] would be a new capability — that's its own phase.
Want me to note it for the roadmap backlog?

For now, let's focus on [phase domain]."
```

Capture the idea in a "Deferred Ideas" section. Don't lose it, don't act on it.
</scope_guardrail>

<signal_strength_guide>
**Every decision in CONTEXT.md gets a signal strength annotation:**

**[STRONG]** — User specifically insisted, gave detailed reasoning, referenced examples, or showed strong preference.
- "I want it exactly like Pinterest's masonry grid" → [STRONG]
- User corrected your assumption or pushed back on a suggestion → [STRONG]

**[WEAK]** — User casually agreed, picked from a menu without elaboration, or said "probably" / "I guess" / "sure".
- "Yeah, cards are fine" → [WEAK]
- User picked option from AskUserQuestion without comment → [WEAK]

**[DISCRETION]** — User explicitly said "you decide" or "whatever works" or showed no preference.
- "I don't care about the loading state, just make it work" → [DISCRETION]

**How to assess:** Pay attention to:
- Length of response (long explanation = strong, one word = weak)
- Specificity (references examples = strong, generic = weak)
- Pushback (corrected you = strong about the correction)
- Enthusiasm ("yes! exactly!" = strong, "sure" = weak)
- Hedging ("probably", "maybe", "I think" = weak)

**Downstream impact:**
- Planner treats [STRONG] as non-negotiable
- Planner can adjust [WEAK] if implementation is simpler another way
- Planner has full freedom on [DISCRETION]
</signal_strength_guide>

<answer_validation>
**IMPORTANT: Answer validation** — After every AskUserQuestion call, check if the response is empty or whitespace-only. If so:
1. Retry the question once with the same parameters
2. If still empty, present the options as a plain-text numbered list and ask the user to type their choice number
Never proceed with an empty answer.

**Text mode (`workflow.text_mode: true` in config or `--text` flag):**
When text mode is active, **do not use AskUserQuestion at all**. Instead, present every
question as a plain-text numbered list and ask the user to type their choice number.
This is required for Claude Code remote sessions (`/rc` mode) where the Claude App
cannot forward TUI menu selections back to the host.

Enable text mode:
- Per-session: pass `--text` flag to any command (e.g., `/gsd:discuss-phase --text`)
- Per-project: `gsd-tools config-set workflow.text_mode true`

Text mode applies to ALL workflows in the session, not just discuss-phase.
</answer_validation>

<process>

**Express path available:** If you already have a PRD or acceptance criteria document, use `/gsd:plan-phase {phase} --prd path/to/prd.md` to skip this discussion and go straight to planning.

<step name="initialize" priority="first">
Phase number from argument (required).

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op "${PHASE}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON for: `commit_docs`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `has_research`, `has_context`, `has_plans`, `has_verification`, `plan_count`, `roadmap_exists`, `planning_exists`.

**If `phase_found` is false:**
```
Phase [X] not found in roadmap.

Use /gsd:progress to see available phases.
```
Exit workflow.

**If `phase_found` is true:** Continue to check_existing.

**Auto mode** — If `--auto` is present in ARGUMENTS:
- In `check_existing`: auto-select "Skip" (if context exists) or continue without prompting (if no context/plans)
- In `conversation`: for each discussion point, choose the recommended approach without using AskUserQuestion
- Log each auto-selected choice inline so the user can review decisions in the context file
- After discussion completes, auto-advance to plan-phase (existing behavior)
</step>

<step name="check_existing">
Check if CONTEXT.md already exists using `has_context` from init.

```bash
ls ${phase_dir}/*-CONTEXT.md 2>/dev/null
```

**If exists:**

**If `--auto`:** Auto-select "Update it" — load existing context and continue to build_understanding. Log: `[auto] Context exists — updating with auto-selected decisions.`

**Otherwise:** Use AskUserQuestion:
- header: "Context"
- question: "Phase [X] already has context. What do you want to do?"
- options:
  - "Update it" — Review and revise existing context
  - "View it" — Show me what's there
  - "Skip" — Use existing context as-is

If "Update": Load existing, continue to build_understanding
If "View": Display CONTEXT.md, then offer update/skip
If "Skip": Exit workflow

**If doesn't exist:**

Check `has_plans` and `plan_count` from init. **If `has_plans` is true:**

**If `--auto`:** Auto-select "Continue and replan after". Log: `[auto] Plans exist — continuing with context capture, will replan after.`

**Otherwise:** Use AskUserQuestion:
- header: "Plans exist"
- question: "Phase [X] already has {plan_count} plan(s) created without user context. Your decisions here won't affect existing plans unless you replan."
- options:
  - "Continue and replan after" — Capture context, then run /gsd:plan-phase {X} to replan
  - "View existing plans" — Show plans before deciding
  - "Cancel" — Skip discuss-phase

If "Continue and replan after": Continue to build_understanding.
If "View existing plans": Display plan files, then offer "Continue" / "Cancel".
If "Cancel": Exit workflow.

**If `has_plans` is false:** Continue to build_understanding.
</step>

<step name="build_understanding">
Build a grounded understanding of the phase BEFORE talking to the user. This determines what you need to ask about.

**Step 1: Read project-level files**
```bash
cat .planning/PROJECT.md 2>/dev/null
cat .planning/REQUIREMENTS.md 2>/dev/null
cat .planning/STATE.md 2>/dev/null
```

Extract: vision, principles, constraints, current progress.

**Step 2: Read all prior CONTEXT.md files**
```bash
find .planning/phases -name "*-CONTEXT.md" 2>/dev/null | sort
```

For each CONTEXT.md where phase number < current phase:
- Read `<decisions>` — these are locked preferences
- Read `<specifics>` — particular references or "I want it like X" moments
- Note patterns (e.g., "user consistently prefers minimal UI")

**Step 3: Read ROADMAP.md phase description**
Understand what this phase is supposed to deliver.

**Step 4: Scout the codebase**
This is CRITICAL — the codebase determines what's already decided and what's genuinely new.

Check for codebase maps first:
```bash
ls .planning/codebase/*.md 2>/dev/null
```

If maps exist, read the most relevant ones. Otherwise, do targeted exploration:

```bash
# Find files related to phase goal terms
grep -rl "{term1}\|{term2}" src/ app/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | head -10

# Find existing components/hooks/patterns
ls src/components/ 2>/dev/null
ls src/hooks/ 2>/dev/null
ls src/lib/ src/utils/ 2>/dev/null
```

Read 3-5 most relevant files.

**Step 5: Classify what's ESTABLISHED vs what's NEW**

This is the key insight that drives the conversation:

```
ESTABLISHED (don't ask about):
- Design system: Tailwind with shadcn/ui (used in 40+ components)
- State management: Zustand (3 existing stores)
- Data fetching: React Query (used in all API calls)
- Auth pattern: NextAuth with JWT (Phase 1 decided this)

NEW (need to discuss):
- Chart rendering: no existing pattern for data visualization
- Websocket integration: no real-time data patterns exist yet
- Mobile chart interactions: no touch gesture patterns
```

**Step 6: Cross-reference todos**
```bash
TODO_MATCHES=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" todo match-phase "${PHASE_NUMBER}")
```

If matches found, store for folding into discussion. If none, skip silently.

**Step 7: Load cross-phase notes**
```bash
cat .planning/cross-phase-notes.md 2>/dev/null
```

If this file exists, look for entries tagged with the current phase number. These are insights gathered during discussions of OTHER phases that are relevant here. They represent pre-gathered context — things the user already told you in a different conversation.

For each relevant note:
- Treat it as pre-answered context (don't re-ask what the user already said)
- Validate it during conversation: "From your Phase 2 discussion, you mentioned X. Is that still how you see it?"
- If the user confirms → becomes a [STRONG] or [WEAK] decision based on their response
- If the user contradicts → update the cross-phase note and use the new answer

**Step 8: Load discussion focus hints**
Check the ROADMAP.md phase detail section for a `**Discussion focus**:` line.

If present, this tells you what the roadmapper (or prior workflow) identified as the key areas needing user input for this phase. Use it to prioritize your conversation — but don't treat it as a rigid script. The user's energy still drives depth.

**Step 9: Initialize canonical refs accumulator**
Start building the `<canonical_refs>` list:
- Copy `Canonical refs:` from ROADMAP.md for this phase
- Check REQUIREMENTS.md and PROJECT.md for specs/ADRs referenced for this phase
- If codebase scout found docs referenced in code comments, add those
</step>

<step name="conversation">
Now have a genuine conversation with the user. This is NOT a structured interview — it's collaborative thinking.

**Opening:**

Present what you found and invite the user to talk:

```
## Phase {X}: {Name}

**What it delivers:** {from ROADMAP}

**What I found in the codebase:**
- {Established pattern 1} — already in use
- {Established pattern 2} — decided in Phase {N}
- ...

**What's new in this phase** (where I need your input):
- {New area 1} — no existing pattern
- {New area 2} — multiple approaches possible

{If prior decisions apply:}
**Carrying forward:** {Decision from Phase N}

{If todo matches found:}
**Related backlog items:** {todo titles} — should any of these fold into this phase?

---

Tell me about how you see this phase. What's the most important thing to get right?
```

**Then: Follow the conversation naturally.**

Guidelines for the discussion:
- **Build on their answers.** If they mention "charts", dig into charts. Don't pivot to something unrelated.
- **Use the codebase as anchor.** "Your app already does X for Y — should this follow the same pattern?"
- **Use AskUserQuestion ONLY for binary/ternary choices** where concrete options help. E.g., "Library A or B?" not "Tell me about your vision."
- **Track signal strength as you go.** Notice enthusiasm, hedging, pushback, specificity.
- **Don't re-ask decided things.** Prior phases decided infinite scroll? Don't ask about pagination.
- **Probe what matters, skip what doesn't.** If they light up about the chart interactions, go deep. If they shrug at color scheme, mark it [DISCRETION] and move on.
- **Accumulate canonical refs.** When the user says "check the spec" or "per the ADR", immediately read the doc and add to refs.

**Adaptive depth rules:**
- After each exchange, internally check: "Could a planner create tasks from what I know so far?"
- If YES for all new areas → offer to proceed
- If NO for some areas → continue discussing those areas
- Never ask more than needed. 3 questions might be enough. 15 might be needed. Let the content decide.

**When you have enough context:**

Use AskUserQuestion:
- header: "Ready?"
- question: "I think I have a good picture of what you want for this phase. Ready to capture it, or want to discuss more?"
- options:
  - "Capture it" — Write CONTEXT.md
  - "Keep discussing" — I want to share more
  - "Let me review first" — Show me what you'd capture

If "Keep discussing" → ask what they want to add, continue conversation
If "Let me review first" → show draft decisions, then offer capture/discuss
If "Capture it" → proceed to write_context

**Auto mode (`--auto`):** Skip the conversation entirely. Use the ROADMAP description + codebase scout + prior context to generate reasonable defaults for all decisions. Mark everything [WEAK] since no user input was gathered. Log: `[auto] Generated context from project state — all decisions marked [WEAK]`.

**Scope creep handling:**
If user mentions something outside the phase domain:
```
"[Feature] sounds like a new capability — that belongs in its own phase.
I'll note it as a deferred idea.

Back to [current area]: [return to current thread]"
```

Track deferred ideas internally.

**Cross-phase pollination — capture insights for other phases:**
During the conversation, watch for statements that are relevant to OTHER phases in the roadmap. Examples:
- Discussing UI phase, user says "the API needs to support pagination for this" → relevant to the API phase
- Discussing auth phase, user says "we'll need SSO for the enterprise dashboard too" → relevant to the dashboard phase
- Discussing data model, user mentions "charts will need real-time websocket data" → relevant to the charts phase

When you detect a cross-phase insight:
1. Don't interrupt the conversation flow — note it internally
2. After the conversation completes (before write_context), append to `.planning/cross-phase-notes.md`

Format for cross-phase notes:
```markdown
### From Phase {current} discussion ({date})

**For Phase {target_phase_number}: {target_phase_name}**
- {Insight}: "{what the user said, paraphrased}"
- Signal: [STRONG/WEAK] — {why: "user emphasized this" / "mentioned in passing"}
- Context: {brief context of how this came up}
```

Append, don't overwrite — this file accumulates across all discuss-phase sessions.

If no cross-phase insights emerged, don't create or modify the file.

**Track discussion log data internally:**
For each significant exchange, accumulate:
- Topic discussed
- User's input (paraphrased)
- Decision captured + signal strength
- Any follow-up or clarifications
</step>

<step name="write_context">
Create CONTEXT.md capturing decisions made.

**Also generate DISCUSSION-LOG.md** — a full audit trail of the discuss-phase Q&A.
This file is for human reference only (software audits, compliance reviews). It is NOT
consumed by downstream agents (researcher, planner, executor).

**Find or create phase directory:**

Use values from init: `phase_dir`, `phase_slug`, `padded_phase`.

If `phase_dir` is null (phase exists in roadmap but no directory):
```bash
mkdir -p ".planning/phases/${padded_phase}-${phase_slug}"
```

**File location:** `${phase_dir}/${padded_phase}-CONTEXT.md`

**Structure the content by what was discussed:**

```markdown
# Phase [X]: [Name] - Context

**Gathered:** [date]
**Status:** Ready for planning

<domain>
## Phase Boundary

[Clear statement of what this phase delivers — the scope anchor]

</domain>

<established>
## Established Patterns (from codebase)

[What the codebase already decides — planner should follow these without deviation]
- [Pattern]: [How it's used, where it's established]
- [Pattern]: [From Phase N decision]

</established>

<decisions>
## Implementation Decisions

### [Topic 1 from discussion]
- [Decision] [STRONG — user referenced Pinterest specifically, wants masonry grid]
- [Decision] [WEAK — user said "probably" without strong preference]

### [Topic 2 from discussion]
- [Decision] [STRONG — user pushed back on alternative, insisted on this approach]

### [Topic 3 from discussion]
- [Decision] [DISCRETION — user said "whatever works best"]

### Folded Todos
[If any todos were folded into scope from backlog, list them here.
Each entry should include the todo title, original problem, and how it fits this phase's scope.
If no todos were folded: omit this subsection entirely.]

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

[MANDATORY section. Write the FULL accumulated canonical refs list here.
Sources: ROADMAP.md refs + REQUIREMENTS.md refs + user-referenced docs during
discussion + any docs discovered during codebase scout. Group by topic area.
Every entry needs a full relative path — not just a name.]

### [Topic area 1]
- `path/to/adr-or-spec.md` — [What it decides/defines that's relevant]
- `path/to/doc.md` §N — [Specific section reference]

### [Topic area 2]
- `path/to/feature-doc.md` — [What this doc defines]

[If no external specs: "No external specs — requirements fully captured in decisions above"]

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- [Component/hook/utility]: [How it could be used in this phase]

### Established Patterns
- [Pattern]: [How it constrains/enables this phase]

### Integration Points
- [Where new code connects to existing system]

</code_context>

<specifics>
## Specific Ideas

[Any particular references, examples, or "I want it like X" moments from discussion]

[If none: "No specific requirements — open to standard approaches"]

</specifics>

<deferred>
## Deferred Ideas

[Ideas that came up but belong in other phases. Don't lose them.]

### Reviewed Todos (not folded)
[If any todos were reviewed but not folded into scope,
list them here so future phases know they were considered.
Each entry: todo title + reason it was deferred (out of scope, belongs in Phase Y, etc.)
If no reviewed-but-deferred todos: omit this subsection entirely.]

[If none: "None — discussion stayed within phase scope"]

</deferred>

---

*Phase: XX-name*
*Context gathered: [date]*
```

Write file.
</step>

<step name="confirm_creation">
Present summary and next steps:

```
Created: .planning/phases/${PADDED_PHASE}-${SLUG}/${PADDED_PHASE}-CONTEXT.md

## Decisions Captured

### [Topic] — [count] decisions
- [Key decision] [SIGNAL]

### [Topic] — [count] decisions
- [Key decision] [SIGNAL]

[Summary: X decisions total — Y strong, Z weak, W discretion]

[If deferred ideas exist:]
## Noted for Later
- [Deferred idea] — future phase

---

## ▶ Next Up

**Phase ${PHASE}: [Name]** — [Goal from ROADMAP.md]

`/gsd:plan-phase ${PHASE}`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `/gsd:plan-phase ${PHASE} --skip-research` — plan without research
- `/gsd:ui-phase ${PHASE}` — generate UI design contract before planning (if phase has frontend work)
- Review/edit CONTEXT.md before continuing

---
```
</step>

<step name="git_commit">
**Write DISCUSSION-LOG.md before committing:**

**File location:** `${phase_dir}/${padded_phase}-DISCUSSION-LOG.md`

```markdown
# Phase [X]: [Name] - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the conversation and reasoning.

**Date:** [ISO date]
**Phase:** [phase number]-[phase name]
**Discussion style:** Conversation-first
**Decisions captured:** [count] ([strong count] strong, [weak count] weak, [discretion count] discretion)

---

## Conversation Summary

[For each significant topic discussed:]

### [Topic]
**User's perspective:** [What they said, paraphrased — capture tone and emphasis]
**Decision:** [What was decided]
**Signal:** [STRONG/WEAK/DISCRETION] — [Why this signal level: "user gave detailed example" / "casual agreement" / "explicitly deferred"]

---

[Repeat for each topic]

## Established (Not Discussed)
[Patterns from codebase that were presented but not questioned — user implicitly accepted]

## Deferred Ideas
[Ideas mentioned during discussion that were noted for future phases]
```

Write file.

**Write cross-phase notes (if any):**
If cross-phase insights were gathered during conversation, append them to `.planning/cross-phase-notes.md`.
If the file doesn't exist, create it with a header:
```markdown
# Cross-Phase Notes

> Insights gathered during phase discussions that are relevant to other phases.
> Each discuss-phase session appends here. Later discussions read this for pre-gathered context.

---
```

Then append the notes for this session.

Commit phase context, discussion log, and cross-phase notes:

```bash
# Build file list for commit
COMMIT_FILES="${phase_dir}/${padded_phase}-CONTEXT.md ${phase_dir}/${padded_phase}-DISCUSSION-LOG.md"
if [ -f .planning/cross-phase-notes.md ]; then
  COMMIT_FILES="$COMMIT_FILES .planning/cross-phase-notes.md"
fi
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(${padded_phase}): capture phase context" --files $COMMIT_FILES
```

Confirm: "Committed: docs(${padded_phase}): capture phase context"
</step>

<step name="update_state">
Update STATE.md with session info:

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state record-session \
  --stopped-at "Phase ${PHASE} context gathered" \
  --resume-file "${phase_dir}/${padded_phase}-CONTEXT.md"
```

Commit STATE.md:

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(state): record phase ${PHASE} context session" --files .planning/STATE.md
```
</step>

<step name="auto_advance">
Check for auto-advance trigger:

1. Parse `--auto` flag from $ARGUMENTS
2. **Sync chain flag with intent** — if user invoked manually (no `--auto`), clear the ephemeral chain flag from any previous interrupted `--auto` chain. This does NOT touch `workflow.auto_advance` (the user's persistent settings preference):
   ```bash
   if [[ ! "$ARGUMENTS" =~ --auto ]]; then
     node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-set workflow._auto_chain_active false 2>/dev/null
   fi
   ```
3. Read both the chain flag and user preference:
   ```bash
   AUTO_CHAIN=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow._auto_chain_active 2>/dev/null || echo "false")
   AUTO_CFG=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow.auto_advance 2>/dev/null || echo "false")
   ```

**If `--auto` flag present AND `AUTO_CHAIN` is not true:** Persist chain flag to config (handles direct `--auto` usage without new-project):
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-set workflow._auto_chain_active true
```

**If `--auto` flag present OR `AUTO_CHAIN` is true OR `AUTO_CFG` is true:**

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTO-ADVANCING TO PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Context captured. Launching plan-phase...
```

Launch plan-phase using the Skill tool to avoid nested Task sessions (which cause runtime freezes due to deep agent nesting — see #686):
```
Skill(skill="gsd:plan-phase", args="${PHASE} --auto")
```

This keeps the auto-advance chain flat — discuss, plan, and execute all run at the same nesting level rather than spawning increasingly deep Task agents.

**Handle plan-phase return:**
- **PHASE COMPLETE** → Full chain succeeded. Display:
  ```
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   GSD ► PHASE ${PHASE} COMPLETE
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Auto-advance pipeline finished: discuss → plan → execute

  Next: /gsd:discuss-phase ${NEXT_PHASE} --auto
  <sub>/clear first → fresh context window</sub>
  ```
- **PLANNING COMPLETE** → Planning done, execution didn't complete:
  ```
  Auto-advance partial: Planning complete, execution did not finish.
  Continue: /gsd:execute-phase ${PHASE}
  ```
- **PLANNING INCONCLUSIVE / CHECKPOINT** → Stop chain:
  ```
  Auto-advance stopped: Planning needs input.
  Continue: /gsd:plan-phase ${PHASE}
  ```
- **GAPS FOUND** → Stop chain:
  ```
  Auto-advance stopped: Gaps found during execution.
  Continue: /gsd:plan-phase ${PHASE} --gaps
  ```

**If neither `--auto` nor config enabled:**
Route to `confirm_creation` step (existing behavior — show manual next steps).
</step>

</process>

<success_criteria>
- Phase validated against roadmap
- Prior context loaded (PROJECT.md, REQUIREMENTS.md, STATE.md, prior CONTEXT.md files)
- Codebase scouted and classified into ESTABLISHED vs NEW
- Already-decided things not re-asked (carried forward from prior phases AND codebase)
- Genuine conversation had — not a rigid interview
- User's energy and emphasis followed — deep where it matters, brief where it doesn't
- Every decision has signal strength annotation [STRONG/WEAK/DISCRETION]
- Scope creep redirected to deferred ideas
- CONTEXT.md includes `<established>` section with codebase patterns
- CONTEXT.md includes `<canonical_refs>` section with full file paths (MANDATORY)
- CONTEXT.md includes `<code_context>` section with reusable assets and patterns
- Deferred ideas preserved for future phases
- DISCUSSION-LOG.md captures conversation reasoning and signal strength rationale
- Cross-phase notes written if insights relevant to other phases were detected
- Pre-existing cross-phase notes (from prior phase discussions) were loaded and validated
- Discussion focus hints from ROADMAP.md were used to prioritize conversation (if present)
- STATE.md updated with session info
- User knows next steps
</success_criteria>
</content>
</invoke>