Load this when deciding whether a recurring capability deserves its own GSD artifact, or when authoring a new reference/agent/workflow so the model reliably loads and obeys it.

---

# GSD Artifact-Authoring Guide

## CSO Rule: description = WHEN, Never a Workflow Summary

The `description` or triggering field of any GSD artifact (reference, skill, agent frontmatter) must state ONLY when to load it — triggering conditions, symptoms, situations. It must NEVER summarize the artifact's workflow or process.

**Why this matters:** Testing revealed that when a description summarizes the skill's workflow, Claude may follow the description instead of reading the full skill content. A description of "code review between tasks" caused ONE review even though the flowchart showed TWO (spec compliance then code quality). When the description was changed to just triggering conditions, Claude correctly read the flowchart and followed the two-stage review process. The description creates a shortcut Claude will take. The artifact body becomes documentation Claude skips.

**Violating the letter of the rules is violating the spirit of the rules.**

```yaml
# BAD: Summarizes workflow — Claude follows this instead of reading the artifact
description: Use when executing plans - dispatches subagent per task with code review between tasks

# BAD: Too much process detail
description: Use for TDD - write test first, watch it fail, write minimal code, refactor

# GOOD: Triggering conditions only, no workflow summary
description: Use when executing implementation plans with independent tasks in the current session

# GOOD: Triggering conditions only
description: Use when implementing any feature or bugfix, before writing implementation code
```

**The description test:** Can you remove the description and still know what the artifact does? If yes, the description is correctly scoped to triggers. If the description is the only place the workflow is explained, it is too much.

---

## When to Create a Dedicated GSD Artifact

Create a reference / tool / agent / workflow edit when ALL of these are true:

- The technique was not intuitively obvious — a capable model would miss or mishandle it without guidance
- You would reference it again across multiple projects or plans
- The pattern applies broadly, not only to the current task
- Others benefit — the artifact raises quality for anyone using GSD
- It answers a recurring question whose wrong answer degrades quality

**The decision to add an artifact is the orchestrator's (Opus's) call.** Add one only when the quality gain justifies the token and maintenance cost. More artifacts = more context loaded = more cognitive overhead. Prefer a small sharp reference over a large comprehensive one.

---

## When NOT to Create a Dedicated GSD Artifact

Do not create a dedicated artifact when any of these apply:

- **One-off solution** — the problem is specific to this project or session; it will not recur
- **Standard practice documented elsewhere** — if the technique is covered by official docs, existing GSD references, or widely known conventions, do not duplicate; link instead
- **Project-specific convention** — put it in `CLAUDE.md` (project) or the user's global `~/.claude/CLAUDE.md`, not in the shared GSD tree
- **Mechanically enforceable** — if a regex, validation rule, linter, or CI check can enforce it, automate it. Save documentation for judgment calls that require reasoning. Automating enforcement is always preferable to documenting a rule the model must remember to apply.

---

## Authoring Discipline

### Close Every Loophole Explicitly

Do not just state the rule — forbid specific workarounds. Agents are capable and will find every gap under pressure.

```markdown
# BAD: leaves the workaround open
Write code before test? Delete it.

# GOOD: closes the workaround
Write code before test? Delete it. Start over.

No exceptions:
- Do not keep it as "reference"
- Do not "adapt" it while writing tests
- Do not look at it
- Delete means delete
```

Add the foundational principle early in any discipline-enforcing artifact:

> **Violating the letter of the rules is violating the spirit of the rules.**

This cuts off the entire class of "I'm following the spirit" rationalizations before they start.

### One Excellent Example Beats Many Mediocre Ones

Choose the most representative scenario. Make the example complete, runnable where possible, and commented to explain WHY — not just what. Do not implement in five languages. Do not write contrived templates. One great example that covers the real failure mode is enough.

### Build the Rationalization Table from Real Pushback

For discipline-enforcing artifacts, build a rationalization table from the actual excuses anticipated under pressure — not hypotheticals. Each row: the rationalization on the left, the rebuttal on the right. The rebuttal should be short and factual, not persuasive.

```markdown
| Excuse | Reality |
|--------|---------|
| "Too simple to need a reference" | Judgment calls degrade without anchors. |
| "I'll add the artifact later" | Later means never. Write it when the need is clear. |
| "The rule is obvious" | Obvious rules are the ones that get skipped under pressure. |
```

### Red Flags List for Self-Check

Include a red flags section for discipline-enforcing artifacts. Each red flag is a signal to stop and apply the rule rather than the rationalization. Format:

```markdown
## Red Flags — Stop and Apply the Rule

- [specific observable behavior or thought]
- [specific observable behavior or thought]

All of these mean: [the correct action to take].
```

---

## GSD Form-Factor Decision

GSD has four types of artifacts. Choose based on what you need the model to do differently:

| Form factor | Use when | Examples |
|---|---|---|
| **Reference** (`get-shit-done/references/`) | The model needs to recall a technique, rule, or decision criteria at runtime. Load-on-demand via executor read or `@include`. | `tdd.md`, `artifact-authoring.md`, `receiving-code-review.md` |
| **Workflow edit** (`get-shit-done/workflows/`) | A new step needs to be inserted into an existing GSD command flow (discuss, plan, execute, ship, review). | Adding a reference-load instruction to `review.md`'s present_results step |
| **Agent edit** (`agents/`) | The executor, planner, or verifier agent needs a standing instruction that applies across all invocations of that agent — not just on a specific step. | `<tdd_execution>` watch-it-fail enforcement in `gsd-executor.md` |
| **New command / agent** (`commands/`, `agents/`) | A genuinely new entry point with a distinct lifecycle that does not fit inside any existing GSD workflow. Reserve this for capabilities that cannot be expressed as a reference + workflow edit. | `gsd2:review`, `gsd-debugger` |

**Bias from PROJECT.md: loops and skills over command/agent proliferation.** The bottleneck in AI-assisted development is human round-trip time, not model capability. Each new agent or command adds wiring cost and cognitive overhead. Before creating a new command or agent:

1. Can a reference loaded at the right execution point achieve the same result? If yes, create the reference.
2. Can a one-line edit to an existing workflow step load that reference at the right moment? If yes, make the edit.
3. Only if the capability has a genuinely distinct lifecycle — its own entry point, its own state, its own teardown — create a new command or agent.

**The word "loops/skills" means:** prefer extending an existing workflow with a reference-load instruction over creating a new agent that the orchestrator must explicitly spawn. A reference that is reliably loaded at the right moment raises model autonomy without adding wiring cost.

---

## Source↔Runtime Mirror Rule

Every GSD artifact has two homes. After writing source, copy to runtime:

```bash
cp get-shit-done/references/<name>.md .claude/get-shit-done/references/<name>.md
```

For agent files, the diff between source and runtime is path tokens only (`~/.claude/` expands to the absolute install path, e.g. `<HOME>/.claude/`). For reference files that contain no path tokens, `cp` produces a byte-identical copy — verified with `diff -q`.

Commit source. Runtime is gitignored and must be kept in sync manually.
