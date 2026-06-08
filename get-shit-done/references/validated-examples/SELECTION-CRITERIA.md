# Validated Examples — Selection Criteria

Curation rulebook for the GSD validated-example corpus. Read before adding any entry.

---

## What "validated" means

An entry is validated when **both** conditions hold:

1. The excerpt comes from a **reputation-vetted repository** (see Source Bar below).
2. The entry carries **curator commentary** explaining what constraint the code enforces,
   why it is good, and what not to cargo-cult.

"Validated" does NOT mean the example has been independently benchmarked or re-tested by GSD.
Reputation is the filter; commentary is the value-add.

---

## Source bar

Accept a repo as a source when it is:

- **Battle-tested and widely-used** — production use at scale, not a personal project or proof-of-concept.
- **Human-maintained** — not LLM-generated; real engineering decisions survive in the history.
- **Reputation-vetted** — examples include CPython stdlib, requests, httpx, FastAPI, Pydantic, Rich,
  Node.js core, undici, Fastify, Prettier, Zod, ws, FFmpeg, SQLite, Redis, curl, nginx, libuv.
  A repo with low usage or unproven track record is disqualified regardless of how good one snippet looks.

**Avoid sourcing from a repo only because it is famous.** Relevance to the target failure mode
matters more than brand recognition.

---

## Licensing posture

Short attributed excerpts quoted for commentary and study constitute quotation, not vendoring.
This is low-risk even for GPL sources.

**Required safeguards (binding on every entry):**

- Keep excerpts short: **10-30 lines**, the minimal snippet that shows the pattern.
- Always attribute precisely: `source_repo`, `source_file`, `source_lines`, `source_permalink`,
  and `license` are **mandatory** front-matter fields. No exceptions.
- **Never paste reference excerpts into GSD runtime or executable code.** Excerpts live ONLY in
  `get-shit-done/references/` documentation. If an excerpt appears anywhere under `agents/`,
  `commands/`, `bin/`, or `workflows/`, that is a violation.

Override available: restrict corpus to permissive/public-domain repos only (drop GPL, LGPL)
if maximal conservatism is preferred. Not the default; requires an explicit decision.

---

## Excerpt hygiene

- **10-30 lines.** Shorter = missing context; longer = importing repo-specific scaffolding.
  Target the minimal contiguous block that demonstrates the pattern.
- **Pinned release tag.** `source_permalink` MUST point to a specific release tag
  (e.g. `/blob/v6.19.2/...`). `/blob/main/`, `/blob/master/`, or HEAD refs are INVALID —
  they drift and break attribution over time.
- **No synthetic examples.** If the pattern cannot be found in a reputation-vetted repo,
  it does not belong in this corpus. Do not generate an example and call it validated.
  The entry does not exist until the real excerpt is located.

---

## No synthetic examples

This is the hardest constraint: if you cannot find the pattern in a reputation-vetted repo,
the entry does not get added. An LLM-generated "representative" snippet is not a validated example.
Leave a TODO in the INDEX rather than fabricate an excerpt.

---

## Fat-INDEX anti-pattern

The `INDEX.md` is a **4-column table only**: `pattern_id`, `constraint (one line)`, `language`, `file`.
Do not add code excerpts, "why it's good" bullets, or any prose beyond the one-line constraint
to the INDEX. Commentary belongs exclusively in the per-entry files. A fat INDEX recreates
the eager-blob problem this corpus was designed to avoid.
