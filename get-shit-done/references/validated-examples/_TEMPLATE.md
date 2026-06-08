---
pattern_id: <stable-kebab-id>            # stable key; matches INDEX row + filename
title: <human title>
language: <python|typescript|javascript>
source_repo: <https URL of repo>
source_file: <path/within/repo>
source_lines: "<start>-<end>"
source_permalink: <https permalink pinned to a release tag, e.g. /blob/v6.19.2/...  NEVER /blob/main/ or HEAD>
license: <SPDX id, e.g. MIT, Apache-2.0, PSF-2.0>
counters:                                 # EXACT ## section-header titles from common-bug-patterns.md — NOT slugs
  - Async / Timing
  - Error Handling
---

<!-- Valid counters: values — each MUST be copied character-for-character from common-bug-patterns.md ## section headers.
     No invented sub-namespaces. No slug form (e.g. "async-timing/missing-await" is INVALID).
     This is the Phase 9 join key — a slug or invented string breaks the eval substrate.

     Full valid vocabulary (as of Phase 8):

       Null / Undefined Access
       Off-by-One / Boundary
       Async / Timing
       State Management
       Import / Module
       Type / Coercion
       Environment / Config
       Data Shape / API Contract
       Regex / String
       Error Handling
       Scope / Closure
       Python-Specific Bugs

     If a section header in common-bug-patterns.md changes, update all counters: entries that reference it.
-->

## What this solves

[One paragraph: the concrete constraint this pattern enforces — what goes wrong without it, what invariant it preserves.]

## Excerpt

```<language>
[Short snippet from source_permalink — 10-30 lines, the minimal code that shows the pattern without repo-specific scaffolding. Never the whole file.]
```

## Why it's good

- [Bullet 1: specific structural property — e.g. bounded retry count, explicit cancellation signal, typed return]
- [Bullet 2: edge case this handles that synthetic examples omit]
- [Bullet 3: production signal — why this survived real maintenance / real load]
- [Bullet 4: optional fourth bullet if genuinely distinct]

## What NOT to cargo-cult

- [Bullet 1: what is specific to this repo's constraints and shouldn't be blindly copied — library assumption, protocol-specific behavior]
- [Bullet 2: something that looks like best practice but is actually a workaround for repo-specific constraints]
- [Bullet 3: optional third bullet if genuinely distinct]
