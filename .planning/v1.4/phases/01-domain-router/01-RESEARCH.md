# Phase 1: Domain Router - Research

**Researched:** 2026-04-15
**Domain:** Markdown-driven workflow modification — no external libraries, pure GSD internals
**Confidence:** HIGH

## Summary

This phase is an internal GSD framework change: inserting domain classification logic into
`discuss-phase.md` and simplifying `plan-phase.md` step 5.6. There is no new runtime dependency,
no npm package, and no new language — the deliverable is modified markdown workflow files and
optionally a small addition to `gsd-tools.cjs`.

The key insight from reading the existing code: discuss-phase already has all the machinery
needed for domain detection. The `build_understanding` step already scouts the codebase,
reads ROADMAP.md, and classifies what's ESTABLISHED vs NEW. Domain routing is a natural
extension of that analysis — the LLM doing build_understanding can simultaneously classify
the domain and output a "Detected:" line. No new tool CLI command is strictly required.

The second insight: plan-phase step 5.6 currently runs a grep for UI keywords on the phase
section and fires a yes/no gate. The router replaces this with a simpler artifact existence
check (does a UI-SPEC.md exist?) and drops the keyword classifier entirely. Classification
now happens earlier (in discuss-phase) and is persisted to CONTEXT.md.

**Primary recommendation:** Implement the router as inline LLM logic inside discuss-phase
`build_understanding` — no new agent, no new tool command, no new config keys needed for
the minimum viable implementation.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Classification mechanism**
- Router analyzes phase description from ROADMAP.md + codebase context (existing files, patterns)
  to determine domain [STRONG]
- Classification looks at: phase name/goal keywords, existing codebase structure (e.g., `src/agents/`
  folder), deployment patterns, domain-specific signals [WEAK]
- Router presents classification with evidence in one visible line: "Detected: [domain] — based on
  [evidence]" [STRONG — from DRTR-02]

**Confirmation UX**
- Router asks user to confirm or override the detected domain before routing [STRONG — user said
  "better to ask than do blindly"]
- Low-confidence classifications still present best guess with override option [WEAK]

**Where router lives**
- Primary classification in discuss-phase — where specialized questions need to happen [STRONG]
- Plan-phase keeps a lightweight guard — file-existence check for expected spec artifacts, not a
  full classifier [STRONG]
- Current hardcoded UI-SPEC gate in plan-phase step 5.6 becomes a generic "missing spec?" check [STRONG]

**Domain routing behavior**
- UI domain → triggers existing UI-SPEC questionnaire (same as today) [STRONG]
- Agentic domain → Phase 1 classifies correctly but actual AGENT-SPEC workflow comes in Phase 2.
  For now: classification + stub/flag that Phase 2 will consume [STRONG]
- Generic domain → current discuss-phase flow continues unchanged [STRONG]
- Multi-domain → run both questionnaires sequentially, no special machinery [WEAK]

**Simplicity constraint**
- Do not overcomplicate — the router is infrastructure for Phase 2 [STRONG — strongest signal]
- LLM interprets free-text responses, questionnaires are not hardcoded [STRONG]

### Deferred Ideas

None — discussion stayed within phase scope.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DRTR-01 | Router classifies phase domain (UI, agentic, generic) from phase description and codebase context | LLM classification in discuss-phase `build_understanding` step; signals enumerated below |
| DRTR-02 | Classification output always visible — one line showing detected domain and evidence signals | Output format defined; rendered before confirm/override prompt |
| DRTR-03 | Confidence below threshold falls back to generic silently, with override option | Confidence logic and threshold heuristics documented below |
| DRTR-04 | Router replaces existing hardcoded UI-SPEC trigger in discuss-phase | Exact step 5.6 changes documented; becomes spec-existence check |
| DRTR-05 | Router detects multi-domain phases and activates both spec workflows | Sequential activation pattern defined; CONTEXT.md domain field supports array |

## Architecture Patterns

### Where the Router Lives

The router is NOT a new step — it is an extension of the existing `build_understanding` step in
`discuss-phase.md`. After Step 4 (codebase scout) and Step 5 (classify ESTABLISHED vs NEW),
add a Step 5.5: Domain Classification. This keeps the implementation minimal and uses context
the step already has.

```
discuss-phase.md
├── Step 1: initialize
├── Step 2: check_existing
├── Step 3: build_understanding
│   ├── Step 1-4: [existing: read project, prior contexts, roadmap, scout codebase]
│   ├── Step 5: Classify ESTABLISHED vs NEW  ← existing
│   ├── Step 5.5: Classify domain (NEW — router lives here)
│   └── Step 6-9: [existing: cross-ref todos, cross-phase notes, discussion focus, init refs]
├── Step 4: conversation
│   └── Opening now includes: "Detected: [domain] — [evidence]" + confirm/override
├── Step 5: write_context  ← must record detected_domain
└── ...
```

### Domain Signal Taxonomy

Classification uses two signal types: **structural signals** (codebase files/folders) and
**keyword signals** (phase name, goal text, ROADMAP description).

**UI domain signals:**
- Structural: presence of `src/components/`, `app/` (Next.js), `pages/`, `*.tsx`/`*.jsx` files,
  `tailwind.config.*`, `shadcn/ui` config, `src/styles/`
- Keywords: UI, interface, frontend, component, layout, page, screen, view, form, dashboard,
  widget, design, styling, visual (same set plan-phase step 5.6 uses today)
- Weight: Either structural OR keyword hit is sufficient for UI detection

**Agentic domain signals:**
- Structural: presence of `agents/`, `src/agents/`, `*.agent.ts`, `workflows/`, multi-file
  orchestration patterns (LangGraph, CrewAI, AutoGen directories), `prompts/` directory
- Keywords in phase goal/description: agent, orchestrat, multi-agent, sub-agent, workflow,
  spawn, pipeline, LLM chain, tool use, autonomous, agentic
- Keywords about outputs: "classifies", "routes", "delegates", "coordinates agents"
- Weight: Keywords in phase goal are stronger signal than structural (a project can have agents
  in code without the current phase being agentic)

**Confidence thresholds:**

| Signals present | Confidence | Action |
|----------------|------------|--------|
| 2+ structural + keywords agree | HIGH | Route directly, show evidence, ask confirm |
| 1 structural OR keywords only | MEDIUM | Route as best guess, show evidence, ask confirm |
| No signals, or weak/conflicting | LOW → Generic | Fall back to generic silently; offer `--domain` override flag |

The "silent fallback to generic" for LOW confidence satisfies DRTR-03: no gate, no question,
just proceeds as generic. The override mechanism is a keyword in the confirm/override prompt
(not a flag argument — the LLM interprets the user's typed response).

### Domain Output Format (DRTR-02)

The visible classification line appears in the conversation opening, between codebase scouting
and the discussion questions:

```
Detected: [UI] — component files in src/components/, keywords "layout" and "page" in phase goal
Detected: [Agentic] — agents/ directory found, phase goal contains "classifies" and "routes"
Detected: [Agentic + UI] — agents/ directory + src/components/, both keyword sets match
Detected: [Generic] — no domain-specific signals found
```

### CONTEXT.md Changes (write_context step)

The `<domain>` section in CONTEXT.md gains a structured field that downstream phases can parse:

```markdown
<domain>
## Phase Boundary

[existing prose description]

**Detected domain:** UI | Agentic | Generic | UI+Agentic
**Evidence:** [comma-separated signals that triggered classification]
**Confirmed by user:** yes | overridden to [domain]

</domain>
```

This is the stub that Phase 2 (AGENT-SPEC) will consume to know whether to trigger the
agentic spec workflow. Plan-phase checks for the presence of this field when checking
for expected spec artifacts.

### Plan-Phase Step 5.6 Changes (DRTR-04)

Replace the current heuristic:
```
grep -iE "UI|interface|frontend|..." and ask yes/no
```

With an artifact existence check:
```bash
# Read detected_domain from CONTEXT.md (if exists)
DETECTED_DOMAIN=$(grep "Detected domain:" "${CONTEXT_PATH}" 2>/dev/null | head -1)

# If domain contains UI, check for UI-SPEC artifact
if [[ "$DETECTED_DOMAIN" =~ "UI" ]]; then
  UI_SPEC_FILE=$(ls "${PHASE_DIR}"/*-UI-SPEC.md 2>/dev/null | head -1)
  if [[ -z "$UI_SPEC_FILE" ]] && [[ "$UI_GATE_CFG" == "true" ]]; then
    # Same gate behavior as today — ask user
  fi
fi

# If domain contains Agentic, check for AGENT-SPEC artifact (Phase 2 delivers this)
# For Phase 1: just skip silently (AGENT-SPEC workflow doesn't exist yet)
```

The keyword grep in step 5.6 becomes a fallback only when no CONTEXT.md exists (backward
compatibility for phases without discuss-phase context).

### Multi-Domain Handling (DRTR-05)

When both UI and Agentic signals are detected:
1. Show: `Detected: [UI + Agentic] — [evidence for each]`
2. Ask confirm (same single confirm prompt, domain field is "UI+Agentic")
3. In conversation step: run UI-SPEC questionnaire first (it already exists), then note
   that AGENT-SPEC questionnaire comes in Phase 2
4. CONTEXT.md records `Detected domain: UI+Agentic`
5. Plan-phase checks for both spec artifacts

No special machinery — the sequential pattern the user approved.

### Override Mechanism

The confirm/override prompt is plain text within the conversation opening:

```
Detected: [Agentic] — agents/ directory found, phase goal contains "routes" and "classifies"

Does this look right? Type 'yes' to confirm, or tell me the correct domain
(options: UI, Agentic, Generic, UI+Agentic).
```

The LLM interprets the response — no hardcoded option parsing needed. If user types "generic"
or "it's actually a UI phase" the LLM updates the classification and proceeds accordingly.
This satisfies DRTR-03's override option without adding a CLI flag.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| UI keyword detection | New regex in tools CLI | Reuse same keyword set as plan-phase step 5.6 already has |
| Domain persistence | New config key or state field | Add `Detected domain:` line to existing `<domain>` section in CONTEXT.md |
| Spec artifact checking | New tool CLI command | Inline bash glob in plan-phase (same as existing UI-SPEC check) |
| Override mechanism | CLI flag parsing | LLM free-text interpretation (already the pattern in discuss-phase) |

**Key insight:** Every capability this phase needs already exists in the system. The router is
an orchestration change, not a new feature.

## Common Pitfalls

### Pitfall 1: Breaking the Existing UI-SPEC Flow
**What goes wrong:** The new router runs in discuss-phase, but plan-phase step 5.6 still has the
old keyword grep + yes/no gate. Both fire, user gets asked twice.
**How to avoid:** Step 5.6 must be changed simultaneously with the discuss-phase router insertion.
The gate becomes "does UI-SPEC artifact exist?" not "does the phase look like UI?". The keyword
grep is removed from plan-phase entirely when CONTEXT.md exists.
**Warning signs:** If plan-phase asks about UI design contract for a phase that already has
CONTEXT.md with domain classification, the step 5.6 change was missed.

### Pitfall 2: Router Fires for Infrastructure Phases
**What goes wrong:** A phase like "Set up CI/CD pipeline" contains keywords like "workflow"
(matches agentic) or "interface" (matches UI). Router incorrectly classifies it as agentic.
**How to avoid:** Keyword signals for agentic domain should require multi-keyword match or
structural confirmation. Single keyword "workflow" in CI context is a false positive. Weight
phase goal keywords higher than incidental mentions, and require at least 2 signals for
non-generic classification.
**Warning signs:** Testing with "Set up CI/CD workflow" triggers agentic — that's the false
positive to watch for during implementation.

### Pitfall 3: CONTEXT.md Domain Field Not Parseable
**What goes wrong:** Plan-phase tries to grep for "Detected domain:" in CONTEXT.md but the
format varies (LLM wrote "Domain: UI" or "Detected: UI" or prose description).
**How to avoid:** Specify the exact line format in write_context step: `**Detected domain:** [value]`.
Plan-phase greps for that exact string. Document the format in the workflow instructions.

### Pitfall 4: Confirm Step Adds Friction for Clear Cases
**What goes wrong:** HIGH-confidence detection (multiple structural + keyword signals) still
asks the user to confirm, adding an unnecessary interaction step.
**How to avoid:** Per the user's context, confirmation is desired ("better to ask than do blindly").
Keep the confirm step but make it dismissible with a single "yes" or Enter. The cost is one
interaction, not a gate.

### Pitfall 5: Phase 2 Dependency Not Stubbed
**What goes wrong:** Phase 1 correctly classifies agentic phases, but CONTEXT.md has no field
Phase 2 can consume, so Phase 2 must re-detect or ask again.
**How to avoid:** The `Detected domain: Agentic` line in CONTEXT.md IS the stub Phase 2 reads.
No additional stub file or flag needed. Verify Phase 2 spec will read CONTEXT.md `<domain>` section.

## Code Examples

### Router Classification Block (discuss-phase Step 5.5)

This runs after codebase scout (Step 4) and ESTABLISHED/NEW classification (Step 5):

```markdown
### Step 5.5: Classify domain

Using what you found in Step 4 (codebase structure) and Step 3 (ROADMAP phase goal/description),
classify the domain:

**UI signals to check:**
- Structural: src/components/, app/, pages/, *.tsx/*.jsx files, tailwind.config.*, src/styles/
- Keywords in phase goal: UI, interface, frontend, component, layout, page, screen, view, form,
  dashboard, widget, design, visual

**Agentic signals to check:**
- Structural: agents/, src/agents/, workflows/, prompts/, *.agent.ts files
- Keywords in phase goal: agent, orchestrat, multi-agent, workflow, spawn, pipeline, LLM, autonomous,
  classif, rout, delegat, coordinat

**Confidence rules:**
- 2+ signal types agree → HIGH → proceed to conversation opening with detected domain
- 1 signal type only → MEDIUM → proceed with best-guess domain in opening
- No signals or conflicting → LOW → use Generic, do not ask user about it

**Store internally:**
- detected_domain: "UI" | "Agentic" | "Generic" | "UI+Agentic"
- domain_evidence: list of signals that triggered classification (for the visible line)
- domain_confidence: HIGH | MEDIUM | LOW
```

### Conversation Opening (domain-aware)

```markdown
## Phase {X}: {Name}

**What it delivers:** {from ROADMAP}

**Detected: [{domain}]** — {comma-separated evidence signals}

**What I found in the codebase:**
- {Established pattern 1}
...

**What's new in this phase:**
- {New area 1}
...

{If detected_domain is UI or Agentic (not Generic):}
Does the domain detection look right? Say 'yes' to confirm, or tell me the correct
domain (UI, Agentic, Generic, UI+Agentic).

{If Generic (LOW confidence):}
[Skip domain confirm — proceed directly to discussion]

---

Tell me about how you see this phase...
```

### Plan-Phase Step 5.6 Replacement Logic

```bash
# Check if CONTEXT.md exists and has domain classification
if [[ -n "$CONTEXT_PATH" ]]; then
  DETECTED_DOMAIN=$(grep "^\*\*Detected domain:\*\*" "${CONTEXT_PATH}" 2>/dev/null | sed 's/.*\*\* //' | tr -d '\r')
else
  # Fallback: keyword grep on phase section (backward compat for phases without discuss-phase)
  PHASE_SECTION=$(node "~/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap get-phase "${PHASE}" 2>/dev/null)
  echo "$PHASE_SECTION" | grep -iE "UI|interface|frontend|component|layout|page|screen|view|form|dashboard|widget" > /dev/null 2>&1
  [[ $? -eq 0 ]] && DETECTED_DOMAIN="UI" || DETECTED_DOMAIN="Generic"
fi

# UI spec check
if [[ "$DETECTED_DOMAIN" =~ "UI" ]] && [[ "$UI_GATE_CFG" == "true" ]]; then
  UI_SPEC_FILE=$(ls "${PHASE_DIR}"/*-UI-SPEC.md 2>/dev/null | head -1)
  if [[ -z "$UI_SPEC_FILE" ]]; then
    # existing gate behavior — AskUserQuestion
  fi
fi
# Agentic spec check (Phase 2 hook point — currently no-op)
# if [[ "$DETECTED_DOMAIN" =~ "Agentic" ]]; then
#   AGENT_SPEC_FILE=$(ls "${PHASE_DIR}"/*-AGENT-SPEC.md 2>/dev/null | head -1)
#   ...Phase 2 will add this block...
# fi
```

### CONTEXT.md Domain Section Format

```markdown
<domain>
## Phase Boundary

[existing prose description of what the phase delivers]

**Detected domain:** Agentic
**Evidence:** agents/ directory found, phase goal contains "classifies", "routes", "domain"
**Confirmed by user:** yes

</domain>
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|-----------------|--------|
| plan-phase step 5.6 keyword grep + yes/no gate | Router in discuss-phase + artifact check in plan-phase | Classification happens earlier, with evidence; plan-phase becomes passive |
| UI-SPEC trigger hardcoded to plan-phase | UI-SPEC triggered by discuss-phase domain classification | Phase 2 can add AGENT-SPEC trigger with zero plan-phase changes |
| No domain awareness in CONTEXT.md | `Detected domain:` field persisted in CONTEXT.md | Downstream agents (planner, executor) know domain without re-detecting |

## Validation Architecture

### Test Framework

No automated test framework is set up for this project (GSD itself is a markdown/workflow
project with JS utilities tested via `.test.cjs` files).

| Property | Value |
|----------|-------|
| Framework | Node.js built-in assertions (existing pattern from tests/*.test.cjs) |
| Config file | none — tests run directly via node |
| Quick run command | `node tests/*.test.cjs 2>&1` |
| Full suite command | `node tests/*.test.cjs 2>&1` |

### Phase Requirements → Test Map

Domain router changes are to markdown workflow files (discuss-phase.md, plan-phase.md) and
CONTEXT.md format. These are LLM-orchestrated — unit testing is not applicable to the workflow
logic itself. Verification is behavioral (run discuss-phase on test phase descriptions, observe
output).

| Req ID | Behavior | Test Type | Verification Method |
|--------|----------|-----------|-------------------|
| DRTR-01 | Agentic phase description → "Detected: Agentic" | Manual behavioral | Run discuss-phase on Phase 1 description, verify output line appears |
| DRTR-02 | Classification line always visible with evidence | Manual behavioral | Inspect discuss-phase opening output for "Detected:" line |
| DRTR-03 | Generic fallback for ambiguous phases | Manual behavioral | Run discuss-phase on a generic phase, verify no domain prompt |
| DRTR-04 | UI-SPEC gate now uses CONTEXT.md not keyword grep | Manual behavioral | Run plan-phase after discuss-phase for a UI phase, verify no double-prompt |
| DRTR-05 | Multi-domain phases activate both | Manual behavioral | Run discuss-phase on phase with UI+agentic signals, verify both triggered |

### Wave 0 Gaps

None — no new test files needed. Verification is manual behavioral testing of workflow files.
The CONTEXT.md format change (adding `Detected domain:` field) should be validated by running
`/gsd2:discuss-phase 1` and inspecting the output CONTEXT.md.

## Open Questions

1. **Where exactly in the conversation opening does the confirm/override prompt live?**
   - What we know: It appears before the main discussion questions, after the "Detected:" line
   - What's unclear: Does it appear on the same turn as the codebase summary, or on a separate
     turn after the user's first response?
   - Recommendation: Same turn as the opening — before asking "Tell me about this phase." This
     way detection + confirmation + discussion all start together with minimal round-trips.

2. **Should `detected_domain` be a new config key or live only in CONTEXT.md?**
   - What we know: User said config can have new keys following existing pattern [WEAK]
   - What's unclear: Is per-phase config needed, or is CONTEXT.md sufficient?
   - Recommendation: CONTEXT.md only — config.json is project-wide, domain classification is
     per-phase. CONTEXT.md is the correct artifact.

3. **What happens when Phase 1 is run on itself (this very phase is agentic)?**
   - What we know: Phase 1 is classified as Agentic (domain router = agentic infrastructure)
   - What's unclear: The user confirmed that Phase 1 classifies correctly but AGENT-SPEC is Phase 2
   - Recommendation: For Phase 1 implementation, after confirming "Agentic", discuss-phase notes
     "AGENT-SPEC workflow will be available in Phase 2" and continues with standard discuss-phase
     questions. No questionnaire to run yet.

## Sources

### Primary (HIGH confidence)
- Direct code read: `/Users/itsoneword/.claude/get-shit-done/workflows/discuss-phase.md` — full
  step-by-step structure, build_understanding pattern, write_context format
- Direct code read: `/Users/itsoneword/.claude/get-shit-done/workflows/plan-phase.md` — step 5.6
  exact implementation to be replaced
- Direct code read: `/Users/itsoneword/.claude/get-shit-done/bin/lib/config.cjs` — VALID_CONFIG_KEYS,
  config.json structure
- Direct code read: `/Users/itsoneword/.claude/get-shit-done/bin/lib/init.cjs` — cmdInitPhaseOp,
  what CONTEXT.md fields are parsed by init commands
- Direct read: `.planning/phases/01-domain-router/01-CONTEXT.md` — locked decisions

### Secondary (MEDIUM confidence)
- `.planning/codebase/ARCHITECTURE.md` — layer breakdown, data flow patterns
- `.planning/REQUIREMENTS.md` — DRTR-01 through DRTR-05 definitions

## Metadata

**Confidence breakdown:**
- Architecture patterns: HIGH — based on direct code reading of all integration points
- Domain signal taxonomy: MEDIUM — keyword lists are derived from existing step 5.6 patterns
  (HIGH) plus agentic signals that follow the same logic (MEDIUM — no existing codebase precedent)
- Pitfalls: HIGH — derived directly from integration point analysis
- Validation: HIGH — manual behavioral testing is appropriate for markdown workflow changes

**Research date:** 2026-04-15
**Valid until:** Stable — GSD workflow files change infrequently. Re-verify if discuss-phase.md
or plan-phase.md is modified between now and implementation.
