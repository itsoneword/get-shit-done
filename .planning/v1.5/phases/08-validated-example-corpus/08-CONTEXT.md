# Phase 8: Validated Example Corpus - Context

**Gathered:** 2026-06-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a curated corpus of **validated, human-maintained** code examples mined from strong real-world reference projects, so GSD guidance draws on real battle-tested code instead of plausible-but-untested LLM-generated examples. Indexed **by pattern, not by repo**, with per-example commentary. Structured so it can also serve as the validated reference/eval substrate Phase 9 (SkillOpt-style self-improving skills) will consume.

**Out of this phase:** the SkillOpt-style optimizer loop and eval harness — split out to **Phase 9** during this discussion (user picked "full eval harness + loop" ambition + "split into two phases"). A reusable example-**mining** workflow/CLI is also out (deferred — see Deferred Ideas).

**Detected domain:** Agentic
**Evidence:** `agents/`, `workflows/`, `commands/` present; goal targets GSD's own skill/reference layer
**Confirmed by user:** not explicitly confirmed; domain is incidental here — the phase deliverable is a reference artifact, not an agent system

</domain>

<established>
## Established Patterns (from codebase)

- **`get-shit-done/references/` reference docs** (Phase 3): `universal-anti-patterns.md`, `common-bug-patterns.md`, `tdd.md`, `verification-patterns.md`, `AGENTIC-PATTERNS.md`. The corpus belongs in this directory family.
- **Hybrid load scheme** (Phase 3 decision): verifier *eager-loads* a doc via `@~/.claude/get-shit-done/references/<doc>.md` (see `verify-phase.md:22`); planner references docs *on-demand* ("Read when relevant", like `tdd.md`) to keep context lean. Phase 8 uses the **on-demand / planner** half of this scheme.
- **Source vs runtime split**: edits land in `get-shit-done/references/` (committed source); `.claude/get-shit-done/references/` is the gitignored runtime copy propagated by install. Commit source only.

</established>

<decisions>
## Implementation Decisions

### Corpus shape & indexing
- Indexed **by pattern, not by repo** [STRONG — user's own `CODE-EXAMPLES.md` draft + restated: "rely on reputation… catalog by pattern"]. Example buckets: CLI parsing, async retry/backoff, validation layer, config loading, telemetry hook, planner-prompt structure.
- Each pattern is a **self-contained, individually-retrievable entry** — never one giant eager-loaded blob [STRONG — user: "don't think having huge info as ref is good idea… search particular patterns, not load full huge file"].

### Entry storage — excerpts required
- Each entry contains an **actual code excerpt**, not commentary alone [STRONG — user: "we need the code to understand what good code is, so only comment will not work"].
- Excerpt + **precise attribution** (repo, file path, line range / permalink, license) + commentary: *what constraint it solves*, *why it's good*, *what NOT to cargo-cult*.
- Keep excerpts **short** (targeted snippets, not whole files). Rationale is both context-leanness and licensing safety.

### Licensing posture (resolved)
- GSD ships publicly, so copied code = redistribution in principle. **Resolution:** short, attributed excerpts quoted *for commentary/study* are quotation, not vendoring — low risk even for GPL sources (e.g. FFmpeg) [STRONG, specialist-backed — resolved inline; user may override to permissive-only]. <!-- resolved inline by resolution loop; confidence: HIGH; source: license-practice norms for short attributed quotation -->
- **Safeguards (binding on the curation step):** keep excerpts short; always attribute precisely incl. license; **never paste reference code into GSD's executable/runtime code** — excerpts live only in `references/` documentation.
- Override available: restrict to permissive/public-domain repos only (drop GPL) if maximal conservatism is preferred later. Not chosen now.

### Source selection — reputation-driven
- Sources chosen by **whole-repo reputation**: battle-tested, widely-used, human-maintained repos qualify; low-usage/unproven repos do not [STRONG — user: "rely on reputation (e.g. all ffmpeg is really good code, and some random repo with 0 usage is not)"].
- "Validated" therefore means: **excerpt comes from a reputation-vetted repo + carries curator commentary** — it does NOT require each example to be independently re-tested/benchmarked by us.
- Candidate source pool already drafted in `reference/CODE-EXAMPLES.md` (FFmpeg, SQLite, Redis, curl, nginx, libuv; CPython/requests/httpx/FastAPI/Pydantic/Rich; Node core/undici/Fastify/Prettier/Zod/ws, etc.). Initial languages: **Python + Node/TS first**, minimal systems-reference snippets.

### Integration into GSD flow
- Lives in **`get-shit-done/references/`** (e.g. `references/validated-examples/`); consumed by the **planner, on-demand** [STRONG — explicitly selected option]. Verifier integration NOT included this phase.

### Access / retrieval mechanism
- **Deferred to research/plan time** [STRONG — explicitly selected]. **Hard constraint locked:** must be **per-pattern retrievable, not one eager blob**. Research recommends the mechanism (e.g. per-pattern files + slim INDEX the planner reads, vs a `gsd-tools examples <pattern>` retrieval command) based on actual corpus size/count.

### Phase sequence (research-first)
- This phase is **research-led** [STRONG — user: "first we need to research (what would be real good code and why), then search it, then copy and catalog"]:
  1. **Research** — what makes code "good" and *why*, tied to GSD's real failure modes (verifier/debug recurring catches), and which patterns matter most.
  2. **Find** — locate exemplars via repo reputation.
  3. **Curate** — short attributed excerpts + commentary.
  4. **Catalog** — pattern-indexed, per-pattern retrievable.

### Claude's Discretion
- Seed size for v1 (how many patterns to populate this phase) — lean small/focused, not comprehensive; exact count sized at plan time [DISCRETION — user wary of "huge info"; comprehensive coverage explicitly not the goal now].
- Exact entry-file format and INDEX schema.

</decisions>

<expected_outcome>
## Expected Outcome

- **End state:** GSD has a pattern-indexed corpus of validated real-world code examples in `references/`. For a given pattern (e.g. "async retry with backoff"), an entry shows a short, attributed excerpt from a reputation-vetted repo plus commentary on what it solves and what not to cargo-cult.
- **Success signal:** When the planner is working a coding task, it can pull the relevant pattern's example **on demand** — seeing real code, not a synthetic snippet — without loading the whole corpus. Phase 9 can reuse the same corpus as validated reference/eval material.
- **Flow:** research (what good code is + which patterns matter) → find via reputation → curate short excerpts → catalog per-pattern → planner reads one pattern on demand.

</expected_outcome>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Corpus source draft & criteria
- `.planning/reference/CODE-EXAMPLES.md` — candidate source repos, selection criteria, "by pattern not by repo" principle, initial-direction buckets/languages. The working draft this phase matures.
- `.planning/reference/IDEAS.md` §#7 — origin idea (promoted to this phase).

### Established reference-doc pattern to mirror
- `get-shit-done/references/universal-anti-patterns.md`, `get-shit-done/references/common-bug-patterns.md`, `get-shit-done/references/tdd.md` — Phase 3 docs; show the on-demand-load reference-doc shape the corpus should follow.
- `get-shit-done/workflows/verify-phase.md` §line ~22 — the `@`-eager load mechanism (for contrast; Phase 8 uses on-demand, not eager).

### Forward dependency
- ROADMAP.md → **Phase 9: SkillOpt-Style Self-Improving Skills** — the consumer of this corpus; corpus structure must be reusable as its reference/eval substrate.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get-shit-done/references/` directory + the Phase 3 reference docs as a structural template (front matter, commentary style).
- Phase 4 telemetry (`agent-trace.jsonl`) and verifier/debug outcomes — the source of "GSD's real failure modes" the research step should mine to prioritize which patterns matter.

### Established Patterns
- On-demand reference loading ("Read when relevant") keeps planner context lean — corpus retrieval must preserve this (no eager mega-doc).
- Source→runtime install propagation: commit only `get-shit-done/...`; `.claude/...` is gitignored runtime.

### Integration Points
- Planner prompt / `get-shit-done/templates/phase-prompt.md` and `gsd-planner.md` — where an on-demand pointer to the corpus would be added.
- A possible `gsd-tools` subcommand (`examples <pattern>`) if research picks the CLI-retrieval mechanism.

</code_context>

<specifics>
## Specific Ideas

- "All ffmpeg is really good code, and some random repo with 0 usage is not" — reputation is the selection bar.
- "We need the code to understand what good code is, so only comment will not work" — excerpts are mandatory.
- "Don't think having huge info as ref is good idea… search particular patterns" — retrieval granularity is a first-class requirement.

</specifics>

<deferred>
## Deferred Ideas

### Reviewed Todos (not folded)
- `2026-03-21-add-user-sync-checkpoints-to-plan-phase-subagent-chains.md` and `2026-03-22-update-command-should-sync-project-local-hooks.md` — surfaced by phase-match (keyword overlap only); unrelated to the corpus. Left in pending.

### Split out / deferred
- **SkillOpt-style optimizer loop + eval harness → Phase 9** (the whole self-improvement thread; consumes this corpus).
- **Reusable example-mining workflow/CLI** (`/gsd2:mine-examples` or similar) — deferred to Phase 9 or backlog; this phase curates by hand using reputation as the filter.
- **Verifier integration** of the corpus — this phase wires the planner only.
- **Comprehensive multi-bucket/multi-language coverage** — v1 stays focused; corpus grows incrementally later.

</deferred>

---

*Phase: 08-validated-example-corpus*
*Context gathered: 2026-06-08*
