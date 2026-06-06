---
created: 2026-06-06T00:00:00Z
title: Research neutral/professional output tone — curb sycophancy and false validation
area: output-format
files: []
related: backlog 999.2 (terse-output default)
---

## Problem

Output skews **cheering / supportive** rather than neutral and professional. Phrases like
"and you've diagnosed it exactly right", "great catch", "you're absolutely right" appear
frequently. They read pleasantly but are **often misleading** — they assert correctness or
agreement as social lubricant, not as a verified judgment. The risk is **false validation**:
the user can't tell praise-as-filler from a genuine, evidence-backed confirmation.

Distinct from 999.2 (which is about verbosity/length). This is about **tone and epistemic
honesty** — even a terse answer can be sycophantic ("yep, exactly right!").

## Goal

Research the best available options to make output default to a neutral, professional,
evidence-first register: confirmations only when verified, disagreement when warranted,
no reflexive praise. Then pick an approach and apply it.

## Research directions

- Anthropic / industry guidance on sycophancy mitigation and calibrated language in LLM output.
- Where to enforce it for GSD: a global communication-standard instruction (CLAUDE.md /
  output-style), a reference doc loaded by agents, or per-workflow output contracts.
- Concrete rewrite rules: replace "you're exactly right" with the *evidence* ("the mtimes
  confirm X"); state confidence explicitly; separate verified facts from opinion; allow
  plain disagreement.
- How to verify the change took (hard to test tone — maybe a rubric / sample audit).

## Acceptance

- A short written standard for neutral, evidence-first output exists and is wired into the
  path GSD agents and the assistant actually read.
- Confirmations are tied to evidence or explicit confidence, not social affirmation.

## Resolution (2026-06-06)

**Standard authored + wired** in `get-shit-done/references/ui-brand.md` as a new
"Communication Standard" section (+ "Tone" anti-patterns). Single source of truth — no
separate doc, to avoid drift. File reframed from "visual patterns" to "user-facing output
standards (visual + tone)".

**Wiring:** `ui-brand.md` is already `@`-referenced by ~17 GSD orchestrators
(commands/gsd2/*.md + get-shit-done/workflows/*.md — planning/execution/UI/profile
commands; NOT every command — e.g. discuss-phase, debug, fix, ship, verify-work don't load
it). Editing the file's content propagates the standard to all of them with zero new
`@`-includes — which also kept this work disjoint from parallel sessions touching
plan-phase/execute-phase/new-project. Source-of-truth is the repo `get-shit-done/` copy;
mirrored to the project-local `.claude/get-shit-done/` install. Verified live: the local
commands rewrite the `@` ref to the absolute path
`…/mine/.claude/get-shit-done/references/ui-brand.md`, and that resolved file now contains
the standard — so it is active this session (install/build re-syncs from source normally).

**Scope decision (deliberate):** wiring is at the *orchestrator* level, not `agents/*.md`.
Orchestrators emit the user-facing prose; subagents return structured artifacts to the
orchestrator, not chat. So orchestrator-level wiring + the existing assistant memory
(`neutral-tone-no-sycophancy`, loaded every session) covers the real user-facing surface.
Full per-agent reach (`agents/*.md`) is deferred — low marginal value, and
`gsd-codebase-mapper.md` is owned by the concurrent generate-claude-md work.

**Research grounding:** Constitutional AI treats anti-sycophancy as an explicit principle
(honesty, non-deception, calibrated confidence); LLMs are overconfident when asked to state
confidence verbally → tie confidence to evidence; the core failure is capitulation under
pushback ("are you sure?" flips answers) and mirroring user confidence; training for warmth
raises sycophancy (Nature 2026) — so a neutral register is the deliberate choice.

**Content:** lead with evidence not affirmation; confirm only what's verified; tag
confidence (verified / inferred / unknown); disagree when warranted and don't capitulate
under pushback; tone ≠ length (a terse reply can still be sycophantic); guard against
over-correcting into reflexive contrarianism.
