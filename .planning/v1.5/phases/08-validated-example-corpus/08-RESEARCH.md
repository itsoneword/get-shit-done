# Phase 8: Validated Example Corpus - Research

**Researched:** 2026-06-08
**Domain:** GSD reference architecture + curated code corpus
**Confidence:** HIGH (internal architecture; all findings verified against existing codebase)

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- Indexed **by pattern, not by repo** — example buckets, not repo-organized
- Each pattern is a **self-contained, individually-retrievable entry** — never one giant eager-loaded blob
- Each entry contains an **actual code excerpt**, not commentary alone
- Excerpt + **precise attribution** (repo, file path, line range / permalink, license) + commentary: what constraint it solves, why it's good, what NOT to cargo-cult
- Keep excerpts **short** (targeted snippets, not whole files)
- Sources chosen by **whole-repo reputation** (battle-tested, widely-used, human-maintained)
- Licensing posture resolved: short attributed excerpts = quotation not vendoring — excerpts live **only** in `references/` docs, never pasted into runtime code
- Lives in **`get-shit-done/references/`** (e.g. `references/validated-examples/`); consumed by the **planner, on-demand**
- Phase sequence is **research-led**: research → find → curate → catalog
- Access/retrieval mechanism: **deferred to this research document** — hard constraint is per-pattern retrievable, not one blob

### Claude's Discretion

- Seed size for v1 (lean small/focused, not comprehensive; exact count sized at plan time)
- Exact entry-file format and INDEX schema

### Deferred Ideas (OUT OF SCOPE)

- SkillOpt-style optimizer loop + eval harness → Phase 9
- Reusable example-mining workflow/CLI
- Verifier integration of the corpus
- Comprehensive multi-bucket/multi-language coverage

</user_constraints>

---

## Summary

Phase 8's core challenge is **design, not discovery**: the technology is plain markdown files, and the pattern to follow already exists in `get-shit-done/references/`. The real work is (1) mapping GSD's documented failure taxonomy to the pattern buckets that matter most, (2) deciding a concrete entry format and INDEX schema that serves both the planner's on-demand reads and Phase 9's eval needs, and (3) curating ~6-8 seed entries from reputation-vetted source repos.

The retrieval architecture decision is straightforward given GSD's form-factor constraints: per-pattern files + slim INDEX is the only mechanism consistent with the project's "loops/skills over new commands" principle, the existing on-demand markdown reference pattern, and the constraint that Phase 9 parses structured front matter (not CLI output). A `gsd-tools examples` subcommand would be a new command for a non-distinct lifecycle — explicitly against Phase 6 decisions.

**Primary recommendation:** Per-pattern markdown files under `references/validated-examples/`, each with front-matter fields consumed by both planner and Phase 9. A slim `INDEX.md` listing pattern_id + one-line constraint + language + file path. Wired into `gsd-planner.md` under the existing `<code_quality_reference>` section as a "Read when relevant" pointer.

---

## Q1: Failure-Mode Mapping → Pattern Priority

The failure taxonomy lives in `common-bug-patterns.md` and `universal-anti-patterns.md` (Phase 3 docs, already canonical). The categories map directly to corpus pattern buckets. The `agent-trace.jsonl` (Phase 4 telemetry) logs spawn/confidence events — it does NOT carry code-failure modes. The canonical source is the documented taxonomy.

### Failure categories → highest-priority corpus buckets

| Failure category (from common-bug-patterns.md) | Corpus pattern bucket | Priority |
|------------------------------------------------|-----------------------|----------|
| Async/Timing: missing await, race condition, leaked timer | **Async retry/backoff with cancellation** | HIGH — recurring in Node/TS plan execution |
| Error Handling: swallowed error, unhandled rejection, bare `except:` | **Error propagation without swallowing** | HIGH — verifier catches this constantly |
| Data Shape / API Contract: changed response shape, wrong container type | **Validation layer (input parsing + typed output)** | HIGH — root cause of most runtime surprises |
| Python-Specific: mutable default arg, bare `except:`, generator exhaustion | **Python idiomatic resource management** | HIGH — Python-first scope, Phase 3 added content here |
| Environment / Config: missing env var, hardcoded path | **Config loading with sensible defaults + env validation** | MEDIUM |
| Import / Module: circular dep, wrong extension, missing extension | **Module boundary discipline (CJS vs ESM)** | MEDIUM — Node/TS-specific; shows up in GSD's own tooling |
| State Management: shared mutation, dual source of truth | **Immutable data flow patterns** | LOWER — less acute for GSD's scripting domain |

### GSD-specific failure modes not in the taxonomy

The planner anti-patterns section of `universal-anti-patterns.md` reveals GSD-specific failures: vague task actions, reflexive context chaining, scope reduction. The corpus should include one GSD-native pattern:

| GSD failure | Corpus pattern bucket | Source | Priority |
|-------------|----------------------|--------|----------|
| Prompt/plan structure drift (commentary displaces action, scope creeps) | **Structured prompt/plan authoring** | GSD's own `phase-prompt.md` / `tdd.md` are the exemplars | MEDIUM — directly relevant to Phase 9's eval targets |

### Conclusion: 6-8 seed patterns, prioritized

1. Async retry with backoff and cancellation (Node/TS)
2. Error propagation without swallowing (Python + Node/TS variants)
3. Validation layer — input parsing with typed output (Python: Pydantic; Node/TS: Zod)
4. Python resource management — `with`, typed signatures, no mutable defaults (Python)
5. Config loading — env validation + sensible defaults (Python or Node/TS)
6. ESM/CJS module boundary discipline (Node/TS)
7. Structured prompt template authoring (GSD-native, from GSD's own reference docs)

That is 7 buckets. v1 should populate 5-6 (drop the lowest two if time is tight). Comprehensive coverage is explicitly NOT the goal.

---

## Q2: Retrieval Mechanism Recommendation

**Recommendation: Per-pattern files + slim INDEX.md. No CLI subcommand.**

### Decision

Use individual markdown files (`references/validated-examples/{pattern-id}.md`) with a slim `INDEX.md` that the planner reads first. The planner reads only the specific pattern file it needs, never the full corpus.

### Rationale

Three discriminating constraints make this clear:

1. **GSD form-factor rule (Phase 6, STATE.md):** "loops/skills over new commands… new commands only for genuinely distinct lifecycles." Looking up a reference excerpt is not a distinct lifecycle — it is a read. Adding a `gsd-tools examples <pattern>` subcommand would add a CLI command to maintain for a problem markdown files solve.

2. **Existing precedent is zero CLI retrieval.** Every GSD reference (`tdd.md`, `common-bug-patterns.md`, `verification-patterns.md`) is plain markdown read on-demand via `@` includes or "Read when relevant" instructions. A CLI subcommand would be the only exception.

3. **Phase 9 parses front matter, not CLI output.** Phase 9 needs `pattern_id`, `constraint`, `counters` (the failure category it counters) to build its eval substrate. A CLI would return rendered text; front matter gives Phase 9 direct structured access to the fields it needs.

### INDEX.md constraint — must stay slim

The INDEX must list only: pattern_id, one-line constraint description, primary language, file path. If the INDEX grows commentary it becomes an eager blob — the exact thing the user prohibited. No code excerpts, no "why it's good" prose in the INDEX. Those belong in the entry files.

---

## Q3: Entry Format and INDEX Schema

### Per-entry file format

Each file lives at `get-shit-done/references/validated-examples/{pattern-id}.md`.

```markdown
---
pattern_id: async-retry-backoff
title: Async Retry with Backoff and Cancellation
language: typescript
source_repo: https://github.com/nodejs/undici
source_file: lib/client.js
source_lines: "310-345"
source_permalink: https://github.com/nodejs/undici/blob/v6.19.2/lib/client.js#L310-L345
license: MIT
counters:
  - async-timing/missing-await
  - async-timing/leaked-timer
  - error-handling/swallowed-error
---

## What this solves

[One paragraph: the concrete constraint — what goes wrong without this pattern, what invariant it preserves]

## Excerpt

```{language}
[Short snippet — targeted, not the whole file. Aim for 10-30 lines.]
```

## Why it's good

[2-4 bullets: what structural property makes this battle-tested — timeout hygiene, cancellation signal, backoff formula, etc.]

## What NOT to cargo-cult

[2-3 bullets: what's specific to this repo's constraints that shouldn't be blindly copied — library assumptions, protocol-specific behavior, etc.]
```

### Field rationale

| Field | Who reads it | Why |
|-------|-------------|-----|
| `pattern_id` | INDEX.md, Phase 9 | Stable key for cross-referencing |
| `language` | Planner | So planner only pulls Python entries for Python tasks |
| `source_repo` / `source_file` / `source_lines` | Attribution | Licensing compliance |
| `source_permalink` | Attribution | Pinned version link, not drifting HEAD |
| `license` | Attribution | Required for licensing posture |
| `counters` | Phase 9 eval | Maps entry to failure categories from `common-bug-patterns.md`. This is the eval-substrate bridge: Phase 9 tests "does the agent avoid failure category X?" by checking if it used the pattern that counters X. **Controlled vocabulary:** values must be the exact `## Section Header` slugs from `common-bug-patterns.md` (e.g., `Async / Timing`, `Error Handling`, `Python-Specific Bugs`, `Data Shape / API Contract`, `Environment / Config`, `Import / Module`). No invented namespaces — Phase 9 joins on these exact strings. If a section header changes, update all `counters` entries that reference it. |

### INDEX.md schema

```markdown
# Validated Examples — Index

Read this to find which pattern file to load. Load only the specific file you need.

| pattern_id | constraint (one line) | language | file |
|------------|----------------------|----------|------|
| async-retry-backoff | Retry with bounded backoff and cancellation without leaking timers | typescript | validated-examples/async-retry-backoff.md |
| error-propagation | Propagate errors without swallowing, preserve original context | python | validated-examples/error-propagation-python.md |
| ... | ... | ... | ... |
```

No code in INDEX.md. No "why it's good." One row per pattern.

---

## Q4: v1 Seed — Concrete Patterns, Sources, and Excerpt Types

### Seed list (target 6, max 8)

| Pattern bucket | Source repo | File/area | Excerpt type | Counters failure |
|---------------|-------------|-----------|--------------|-----------------|
| Async retry/backoff (Node/TS) | `nodejs/undici` | `lib/client.js` or `lib/pool.js` — retry logic | ~20 lines: backoff loop, timeout guard, cancellation token | async-timing/*, error-handling/swallowed-error |
| Error propagation without swallowing (Python) | `requests` | `requests/adapters.py` — connection error wrapping | ~15 lines: wrap + re-raise with context | error-handling/*, python/bare-except |
| Validation layer — typed input parsing (Python) | `pydantic` | `pydantic/main.py` — `model_validate` + `ValidationError` shape | ~20 lines: parse → typed model → raise on bad shape | data-shape/api-contract, type-coercion/* |
| Validation layer — typed input parsing (Node/TS) | `colinhacks/zod` | `src/types.ts` — `z.object().parse()` + error shape | ~20 lines: schema definition + parse + `.safeParse` branching | data-shape/api-contract, type-coercion/* |
| Python resource management | `CPython stdlib` | `contextlib.py` — `@contextmanager` + `__enter__/__exit__` | ~15 lines: generator-based context manager, finally path | python/mutable-default, error-handling/error-in-handler |
| Config loading with env validation (Node/TS) | `nodejs/node` or `fastify/fastify` | Config/env parsing init path | ~15 lines: read env, validate present + typed, fail fast with message | env-config/missing-env-var, env-config/hardcoded-path |

### Optional 7th if scope allows

| Pattern bucket | Source | Excerpt type | Counters |
|---------------|--------|--------------|----------|
| CJS/ESM module boundary (Node/TS) | `prettier/prettier` | `src/index.js` exports discipline | import-module/wrong-extension, import-module/export-mismatch |

### Sizing rationale

6-7 entries is tractable for one phase and covers the top failure modes. It avoids "having huge info as ref" (user's constraint). The INDEX stays under 15 rows. Growth happens in later phases or as organic additions — not a comprehensive sweep now.

---

## Q5: Planner Integration — Where the Pointer Lives

**Confirmed location:** `agents/gsd-planner.md` — `<code_quality_reference>` section (lines 75-80 in the source at `/home/cleversol/gsd2/mine/agents/gsd-planner.md`).

Current content of that section:

```
<code_quality_reference>
When making code-quality judgments, choosing between implementation patterns, or flagging anti-patterns in plan tasks:
Read ~/.claude/get-shit-done/references/universal-anti-patterns.md

Skip if the phase is trivial glue/config with no design decisions.
</code_quality_reference>
```

**Recommended addition (exact text):**

```
<code_quality_reference>
When making code-quality judgments, choosing between implementation patterns, or flagging anti-patterns in plan tasks:
Read ~/.claude/get-shit-done/references/universal-anti-patterns.md

For pattern-specific validated examples from battle-tested real-world code:
Read ~/.claude/get-shit-done/references/validated-examples/INDEX.md — then load the specific pattern file(s) relevant to the task.
Load only the pattern(s) you need; never load all entries.

Skip if the phase is trivial glue/config with no design decisions.
</code_quality_reference>
```

This mirrors the existing `tdd.md` "Read when relevant" pattern exactly: conditional, targeted, never eager. The planner reads the slim INDEX (< 15 rows), identifies the relevant pattern, loads one file. The INDEX's per-row cost is one line — the whole INDEX is < 20 lines.

**Runtime path:** `.claude/get-shit-done/references/validated-examples/` (gitignored; propagated by install.js)
**Source path:** `get-shit-done/references/validated-examples/` (committed; same as other Phase 3 reference docs)

Both the INDEX and entry files must be propagated by `install.js` — the plan must include a task to wire this.

---

## Architecture Patterns

### Corpus directory structure

```
get-shit-done/references/
└── validated-examples/
    ├── INDEX.md                          # Slim index: pattern_id, one-liner, language, path
    ├── async-retry-backoff.md            # Node/TS
    ├── error-propagation-python.md       # Python
    ├── validation-layer-python.md        # Python (Pydantic)
    ├── validation-layer-ts.md            # Node/TS (Zod)
    ├── python-resource-management.md     # Python (contextlib)
    └── config-env-validation.md          # Node/TS or Python
```

Runtime copy (gitignored, propagated by install.js):
```
.claude/get-shit-done/references/validated-examples/  (same files)
```

### Source selection protocol (used during curation)

1. Identify the failure mode to counter (from `common-bug-patterns.md` taxonomy)
2. Select a reputation-vetted repo from `CODE-EXAMPLES.md` candidate pool
3. Find the specific file + lines that exhibit the pattern — use GitHub permalink pinned to a release tag (not HEAD)
4. Extract 10-30 lines — the minimal snippet that shows the pattern without repo-specific scaffolding
5. Write commentary: what constraint it solves, why it's good, what not to cargo-cult
6. Populate all front matter fields including `counters`

### Anti-patterns to avoid

- **Fat INDEX:** INDEX rows must be one line each. Commentary, code, or "why it's good" prose in the INDEX collapses it into the eager blob the user explicitly prohibited.
- **Whole-file excerpts:** Snippets must be 10-30 lines. Larger = more repo-specific noise; smaller = missing context. The goal is the pattern, not the implementation.
- **HEAD permalinks:** Always link to a pinned release tag (`/blob/v6.19.2/...`). HEAD links drift and break attribution.
- **Synthetic examples:** If you can't find the pattern in a reputation-vetted repo, either the pattern isn't battle-tested or it's the wrong repo. Do not generate an example and call it validated.
- **Comprehensive v1 scope:** Resist adding patterns beyond the ~7 seed buckets. The corpus grows incrementally; a bloated v1 defeats the "lean" decision.

---

## Common Pitfalls

### Pitfall 1: The "just one more pattern" trap
**What goes wrong:** Seed starts at 5, grows to 12 during curation because each pattern reveals adjacent gaps.
**Why it happens:** Corpus design invites expansiveness; each source repo has many good patterns.
**How to avoid:** Commit to the pattern_ids in the plan before curation begins. Any addition beyond the committed list is a scope change requiring explicit decision.

### Pitfall 2: INDEX drift into commentary
**What goes wrong:** INDEX.md grows "why good" prose per entry; becomes an eager-loaded summary.
**Why it happens:** Natural to add context; the user's anti-blob constraint isn't enforced by the format itself.
**How to avoid:** INDEX schema is a strict 4-column table. Anything beyond pattern_id, constraint, language, file path goes in the entry file.

### Pitfall 3: Attribution entropy
**What goes wrong:** Excerpts lose their source permalink over time as repos update; license fields omitted for "obviously permissive" repos.
**Why it happens:** Curation happens fast; attribution fields feel bureaucratic.
**How to avoid:** Front matter is mandatory — plan tasks must include a verification step that greps for all required fields in every entry file.

### Pitfall 4: Assuming the runtime copy won't propagate
**What goes wrong:** Curator creates entries in `get-shit-done/references/validated-examples/` but doesn't confirm the runtime copy at `.claude/get-shit-done/references/validated-examples/` will reflect them.
**Why it happens:** Reasonable assumption that install.js might list files individually.
**How it actually works (verified):** `bin/install.js` copies the entire `get-shit-done/` directory recursively via `copyWithPathReplacement(skillSrc, skillDest, ...)` (line 2854) — which recurses into subdirectories (line 1841). A new `references/validated-examples/` subdirectory is propagated automatically with no install.js changes needed.
**How to avoid:** The plan's verify step should confirm the runtime subdirectory exists after running install, not that install.js references the path by name.

### Pitfall 5: Phase 9 fields missing from v1 entries
**What goes wrong:** v1 entries omit `counters` front matter; Phase 9 can't build eval substrate without it.
**Why it happens:** Seems like Phase 9's problem; easy to defer.
**How to avoid:** `counters` is a required field in v1. The plan's acceptance criteria must grep for `counters:` in every entry file.

---

## Validation Architecture

`workflow.nyquist_validation` is absent from `.planning/config.json` — treat as enabled.

This phase ships reference documents and a gsd-planner.md edit. Per the TDD exemption in `tdd.md` ("Agent/Prompt/Workflow/Reference Exemption: changes to agent behavior via prompt edits, tool edits, workflow-only modifications, and reference files are exempt from tdd=true when behavior is not unit-testable"), no TDD plans are required.

The validations are structural and can be expressed as verify commands in `must_haves`:

### Validation approach

| What to verify | Command | Type |
|---------------|---------|------|
| INDEX.md exists and is non-empty | `test -f get-shit-done/references/validated-examples/INDEX.md && wc -l < get-shit-done/references/validated-examples/INDEX.md` | unit |
| Every entry file has required front matter fields | `for f in get-shit-done/references/validated-examples/*.md; do grep -q 'pattern_id:' "$f" && grep -q 'counters:' "$f" && grep -q 'license:' "$f" || echo "MISSING: $f"; done` | unit |
| pattern_ids in INDEX match actual entry files | (glob check — each INDEX row's file path exists) | unit |
| gsd-planner.md contains the validated-examples pointer | `grep -q 'validated-examples/INDEX.md' agents/gsd-planner.md` | unit |
| Runtime copy propagated by install | `test -d .claude/get-shit-done/references/validated-examples && ls .claude/get-shit-done/references/validated-examples/` | integration |
| Runtime copy exists (after install) | `test -d .claude/get-shit-done/references/validated-examples` | integration |

### Wave 0 gaps

None — no test framework needed. All validations are shell commands (`test`, `grep`, `for` loops). These go directly into PLAN.md `must_haves.truths[].verify[]` blocks.

---

## Sources

### Primary (HIGH confidence)
- `/home/cleversol/gsd2/mine/agents/gsd-planner.md` — confirmed `<code_quality_reference>` section location; verified exact insertion point
- `/home/cleversol/gsd2/mine/get-shit-done/references/common-bug-patterns.md` — failure taxonomy; mapped to corpus buckets
- `/home/cleversol/gsd2/mine/get-shit-done/references/universal-anti-patterns.md` — GSD failure modes including planner anti-patterns
- `/home/cleversol/gsd2/mine/.planning/v1.5/phases/08-validated-example-corpus/08-CONTEXT.md` — locked decisions
- `/home/cleversol/gsd2/mine/.planning/STATE.md` — Phase 6 form-factor decision (loops/skills over new commands)
- `/home/cleversol/gsd2/mine/.planning/ROADMAP.md` — Phase 8/9 success criteria and Phase 9 eval substrate requirements

### Secondary (MEDIUM confidence)
- `CODE-EXAMPLES.md` — candidate source repos; these are vetted choices confirmed by user; specific file paths within repos to be confirmed during curation
- `get-shit-done/templates/planner-subagent-prompt.md` — confirmed no existing validated-examples pointer; plan must add it to `gsd-planner.md`, not the template

---

## Metadata

**Confidence breakdown:**
- Retrieval mechanism (Q2): HIGH — two independent constraints (form-factor rule + precedent) converge on the same answer
- Entry format (Q3): HIGH — mirrors existing Phase 3 reference doc structure; `counters` field is the only novel design decision
- Failure-mode mapping (Q1): HIGH — sourced from committed canonical docs, not telemetry
- Seed pattern selection (Q4): MEDIUM — specific file paths within source repos to be confirmed during curation; repo choices are HIGH confidence
- Planner integration point (Q5): HIGH — grepped and confirmed exact location in gsd-planner.md

**Research date:** 2026-06-08
**Valid until:** Stable indefinitely (internal architecture; no external API or library version dependencies)
