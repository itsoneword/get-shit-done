<purpose>
Execute discovery at the appropriate depth level. Produces DISCOVERY.md (Level 2-3) that informs PLAN.md creation.
Called from plan-phase.md's mandatory_discovery step with a depth parameter.
For ecosystem research ("how do experts build this"), use /gsd2:research-phase instead (produces RESEARCH.md).
</purpose>

<depth_levels>
| Level | Name         | Time      | Output                                      | When                                      |
| ----- | ------------ | --------- | ------------------------------------------- | ----------------------------------------- |
| 1     | Quick Verify | 2-5 min   | No file, verbal confirmation                | Single library, confirming current syntax |
| 2     | Standard     | 15-30 min | DISCOVERY.md                                | Choosing between options, new integration |
| 3     | Deep Dive    | 1+ hour   | Detailed DISCOVERY.md with validation gates | Architectural decisions, novel problems   |

Depth is determined by plan-phase.md before routing here.
</depth_levels>

<source_hierarchy>
MUST: Context7 BEFORE WebSearch — training data is 6-18 months stale.

1. Context7 MCP FIRST — current docs, no hallucination
2. Official docs — when Context7 lacks coverage
3. WebSearch LAST — comparisons and trends only

Full protocol: ~/.claude/get-shit-done/templates/discovery.md `<discovery_protocol>`
</source_hierarchy>

<process>

<step name="determine_depth">
Route based on depth parameter from plan-phase.md:
- `depth=verify` → Level 1
- `depth=standard` → Level 2
- `depth=deep` → Level 3
</step>

<step name="level_1_quick_verify">
For: Single known library, confirming syntax/version still correct. (2-5 min)

1. Resolve library: `mcp__context7__resolve-library-id with libraryName: "[library]"`
2. Fetch docs: `mcp__context7__get-library-docs with context7CompatibleLibraryID: [from 1], topic: [specific concern]`
3. Verify: current version, API syntax unchanged, no breaking changes.
4. If verified → return to plan-phase.md with confirmation. No DISCOVERY.md needed.
5. If concerns found → escalate to Level 2.
</step>

<step name="level_2_standard">
For: Choosing between options, new external integration. (15-30 min)

1. Identify: what options exist, key comparison criteria, specific use case.
2. Context7 for each option: `resolve-library-id` + `get-library-docs` (mode: "code" for API, "info" for concepts).
3. Official docs for anything Context7 lacks.
4. WebSearch for comparisons: "[A] vs [B] {current_year}", "[option] known issues", "[option] with [our stack]".
5. Cross-verify: any WebSearch finding → confirm with Context7/official docs.
6. Create DISCOVERY.md per ~/.claude/get-shit-done/templates/discovery.md: summary+recommendation, key findings, code examples, confidence (target MEDIUM-HIGH).
7. Return to plan-phase.md.

Output: `.planning/phases/XX-name/DISCOVERY.md`
</step>

<step name="level_3_deep_dive">
For: Architectural decisions, novel problems, high-risk choices. (1+ hour)

1. Scope: define objective, include/exclude boundaries, specific questions (use discovery.md template).
2. Exhaustive Context7: all relevant libraries, related patterns, multiple topics per library.
3. Official docs deep read: architecture guides, best practices, migration guides, known limitations.
4. WebSearch ecosystem context: how others solved similar problems, production experiences, gotchas, recent changes.
5. Cross-verify ALL findings: every WebSearch claim → authoritative source. Mark verified vs assumed. Flag contradictions.
6. Create comprehensive DISCOVERY.md: full template structure, source attribution, confidence per finding, validation checkpoints if any finding is LOW confidence.
7. Confidence gate: if overall confidence is LOW → present options before proceeding (see confidence_gate step).
8. Return to plan-phase.md.

Output: `.planning/phases/XX-name/DISCOVERY.md` (comprehensive)
</step>

<step name="confidence_gate">
// After creating DISCOVERY.md (Level 2-3)
if confidence == LOW:
  AskUserQuestion:
    header: "Low Conf."
    question: "Discovery confidence is LOW: [reason]. How would you like to proceed?"
    options: ["Dig deeper", "Proceed anyway", "Pause"]
elif confidence == MEDIUM:
  inline: "Discovery complete (medium confidence). [brief reason]. Proceed to planning?"
else: // HIGH
  proceed, note: "Discovery complete (high confidence)."
</step>

<step name="open_questions_gate">
// If DISCOVERY.md has open_questions
if open_questions present:
  present inline:
    "Open questions from discovery:
    - [Question 1]
    - [Question 2]
    These may affect implementation. Acknowledge and proceed? (yes / address first)"
  if "address first" → gather user input, update discovery
</step>

<step name="offer_next">
```
Discovery complete: .planning/phases/XX-name/DISCOVERY.md
Recommendation: [one-liner]
Confidence: [level]

What's next?
1. Discuss phase context (/gsd2:discuss-phase [current-phase])
2. Create phase plan (/gsd2:plan-phase [current-phase])
3. Refine discovery (dig deeper)
4. Review discovery
```

NOTE: DISCOVERY.md is NOT committed separately — committed with phase completion.
</step>

</process>

<success_criteria>
Level 1: Context7 consulted, current state verified or escalated, verbal confirmation (no files).

Level 2: Context7 consulted for all options, WebSearch cross-verified, DISCOVERY.md with recommendation, confidence MEDIUM+, ready to inform PLAN.md.

Level 3: Scope defined, Context7 exhaustively consulted, all WebSearch findings verified, comprehensive DISCOVERY.md with source attribution and per-finding confidence, validation checkpoints for LOW-confidence findings, confidence gate passed, ready to inform PLAN.md.
</success_criteria>
