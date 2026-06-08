# Curated code examples for GSD references and skill improvement

Captured 2026-06-07 from a user idea during work on the framework.

> **Now scoped as v1.5 Phase 8**, scope item 2 (Validated Example Corpus). This file is the
> working draft of candidate sources + selection criteria; the phase matures it into a
> pattern-indexed catalog. See ROADMAP.md → Phase 8.

## Why this matters

Right now many examples that appear in prompts, docs, or generated guidance are
LLM-produced. That makes them easy to create, but weak as a ground truth source.
If GSD is meant to improve how agents plan and write code, its example layer should
lean more on **validated handwritten code** from real systems:

- battle-tested APIs and abstractions
- edge cases that synthetic examples often omit
- naming and file boundaries that survived real maintenance
- performance or reliability tradeoffs made under real load
- tests that show intended behavior rather than imagined behavior

The point is not "copy code from OSS into prompts." The point is to mine reliable
patterns, representative snippets, and failure-resistant structures.

## Selection criteria

Prefer repositories that are:

- handwritten and clearly human-maintained
- production-used or widely depended on
- tested, benchmarked, or heavily reviewed
- representative of the language's real conventions
- permissively licensed enough for internal reference and excerpting

Avoid using codebases only because they are famous. Relevance matters more than
brand.

## Candidate sources

### Systems / performance baselines

- **FFmpeg** — extreme performance-oriented C with real-world media edge cases
- **SQLite** — compact, disciplined C with strong correctness culture
- **Redis** — pragmatic low-latency systems code
- **curl** / **libcurl** — robust networking and portability patterns
- **nginx** — evented systems design and configuration boundaries
- **libuv** — event loop / async substrate that maps well to Node-style thinking

### Python

- **CPython stdlib** — canonical APIs, error handling, and interface discipline
- **requests** — clean HTTP ergonomics and API surface design
- **httpx** — modern async/sync transport patterns
- **FastAPI** / **Starlette** — practical service structure and async boundaries
- **Pydantic** — validation patterns, parsing discipline, typed ergonomics
- **attrs** — concise object modeling without framework bloat
- **Rich** — high-quality CLI UX and terminal rendering patterns
- **Django** — mature project structure and separation of concerns

### Node / JavaScript / TypeScript

- **Node.js core** — canonical runtime patterns and API discipline
- **undici** — performant HTTP client design and careful async handling
- **Fastify** — high-throughput server architecture and plugin boundaries
- **Prettier** — disciplined transforms over complex AST/text problems
- **Vitest** — modern test-runner structure and DX-focused API design
- **Zod** — schema ergonomics and composable validation APIs
- **ws** — tight websocket implementation with broad production use
- **npm/cli** — messy-real-world CLI workflows, config, and backward-compat tradeoffs

## How GSD could use this

1. Build a small internal catalog by pattern, not by repo.
   Example buckets: CLI command parsing, async retry loop, validation layer,
   config loading, telemetry hook, planner prompt structure.

2. Prefer excerpts with commentary over raw dumps.
   Each example should say why it is good, what constraint it solves, and what not
   to cargo-cult from it.

3. Connect examples to failure modes.
   If verifier/debug loops repeatedly catch the same class of mistake, attach a
   validated example that shows the right shape.

4. Feed future skill-improvement work.
   If GSD explores a SkillOpt-like loop, this corpus can serve as part of the
   evaluation/reference layer instead of optimizing against synthetic toy examples.

## Initial direction

For immediate GSD relevance, the strongest first buckets are probably:

- Python: validation, CLI tooling, service boundaries, async flows
- Node/TS: CLI/runtime orchestration, hooks, filesystem workflows, async transport
- systems references: minimal targeted snippets from FFmpeg/SQLite/libuv for
  performance and robustness instincts, not for direct style imitation

## Related idea

See pending todo:

- `.planning/todos/pending/2026-06-07-evaluate-skillopt-style-self-improving-skills.md`
