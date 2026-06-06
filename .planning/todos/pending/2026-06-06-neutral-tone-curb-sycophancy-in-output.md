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
