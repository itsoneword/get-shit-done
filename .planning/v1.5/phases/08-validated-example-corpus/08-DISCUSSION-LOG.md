# Phase 8: Validated Example Corpus - Discussion Log

> **Audit trail only.** Not consumed by downstream agents. Decisions are in CONTEXT.md.

**Date:** 2026-06-08
**Phase:** 08-validated-example-corpus
**Decisions captured:** 9 (7 strong, 0 weak, 2 discretion)

---

## Conversation Summary

### Research grounding (SkillOpt)
**What happened:** Before discussing, researched Microsoft's SkillOpt (arXiv 2605.23904, github.com/microsoft/SkillOpt). Found it requires a graded `train/val/test` task set + automated scorer — a substrate GSD lacks. This reframed the original combined phase.

### Phase split
**User's perspective:** Picked "full eval harness + loop" ambition for the SkillOpt thread AND "split into two phases."
**Decision:** Phase 8 narrowed to the **corpus only**; the SkillOpt loop/harness became a new **Phase 9** (large; likely needs its own benchmark sub-phase). Roadmap, dirs, execution order, and progress table updated.
**Signal:** [STRONG] — explicit two-part choice.

### Corpus storage (excerpts vs links)
**User's perspective:** "We need the code to understand what good code is, so only comment will not work."
**Decision:** Actual short code excerpts required, with precise attribution + commentary (solves / why good / don't cargo-cult).
**Signal:** [STRONG] — corrected the link-only option.

### Licensing
**User's perspective:** "What is licensing about? we use it for ourself" — was unaware GSD ships publicly.
**Decision:** Short attributed excerpts = quotation-for-commentary, low-risk even for GPL (FFmpeg); safeguards: keep short, attribute, never vendor into runtime code. Override to permissive-only available, not taken.
**Signal:** [STRONG, specialist-backed] — resolved by Claude, user did not object.

### Source selection
**User's perspective:** "Rely on reputation — all ffmpeg is really good code, a 0-usage repo is not."
**Decision:** Reputation-driven whole-repo trust; "validated" = reputable source + curator commentary (not re-tested by us).
**Signal:** [STRONG].

### Integration
**Decision:** `get-shit-done/references/`, consumed by planner on-demand (Phase 3 hybrid scheme, lighter half). Verifier excluded.
**Signal:** [STRONG] — explicitly selected.

### Access/retrieval
**User's perspective:** "Don't load full huge file, search particular patterns… need to think about it."
**Decision:** Mechanism deferred to research/plan; hard constraint locked = per-pattern retrievable, not one eager blob.
**Signal:** [STRONG] on the constraint; mechanism [DISCRETION] to research.

### Phase sequence
**User's perspective:** "First research what good code is and why, then search, then copy and catalog."
**Decision:** Research-led phase (research → find → curate → catalog).
**Signal:** [STRONG].

## Established (Not Discussed)
- `references/` directory + Phase 3 reference-doc shape; source/runtime install split.

## Deferred Ideas
- SkillOpt loop/harness → Phase 9.
- Example-mining workflow/CLI → Phase 9 or backlog.
- Verifier integration; comprehensive coverage → later.
