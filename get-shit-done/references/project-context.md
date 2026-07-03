Before starting work, discover project context:

1. Read `./CLAUDE.md` if it exists — follow all project-specific guidelines, security requirements, and coding conventions.
2. Check `.claude/skills/` or `.agents/skills/` — if either exists:
   - List available skills and read each `SKILL.md` (lightweight, ~130 lines)
   - Load specific `rules/*.md` only as needed during the work
   - Never load full `AGENTS.md` files (100KB+ — too large for context)
