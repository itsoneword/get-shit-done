# Changelog — GSD2

Experimental fork of [get-shit-done](https://github.com/gsd-build/get-shit-done). Forked from v1.26.0.

## [1.0.0] - 2026-03-20

### Changed
- **Conversation-first discuss-phase** — replaced rigid menu-driven interview (3-4 gray areas × 4 AskUserQuestion) with genuine back-and-forth conversation following questioning.md philosophy
- **Codebase-driven questions** — scout_codebase now classifies ESTABLISHED vs NEW patterns; only NEW areas get discussed
- **Adaptive depth** — no fixed question count; complex phases get deep discussion, simple phases get quick confirmation

### Added
- **Signal strength** — every decision in CONTEXT.md carries `[STRONG]`, `[WEAK]`, or `[DISCRETION]` based on user's emphasis and engagement
- **`<established>` section** in CONTEXT.md — tells planner what's already decided by existing codebase
- **Cross-phase note pollination** — insights from one phase discussion automatically saved for related phases via `.planning/cross-phase-notes.md`
- **Discussion focus hints** — roadmapper generates `**Discussion focus**:` per phase in ROADMAP.md to guide conversation priorities
- **Architecture visualizations** — `gsd-architecture.html` (pipeline analysis) and `gsd-orchestration.html` (agent spawning map)

### Removed
- Pre-generated gray area categories
- Fixed 4-question-per-area structure
- Generic AskUserQuestion as primary interaction mode
