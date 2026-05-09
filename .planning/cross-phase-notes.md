# Cross-Phase Notes

> Insights from phase discussions relevant to other phases. Each session appends here.

---

### From Phase 4 discussion (2026-05-05)

**For future MCP/browser-capability phases:**
- User showed strong interest in Playwright MCP server as a way to give Claude Code direct browser-control tools (browser.click, browser.fill, browser.screenshot)
- Quote: "for mcp server - interesting. we will need to learn how it works and will may have as a result a possibility to rule browser from claude code? sounds cool!"
- Signal: [STRONG] — forward-looking enthusiasm, explicitly deferred from Phase 4 because of scope but earmarked for v2
- Context: came up while scoping UI verification in the verifier loop. Phase 4 schema (`type: ui` in must_haves verify block) is designed so Playwright MCP integration later is a config change, not architectural

**For future test-phase / TEST-SPEC.md changes:**
- Phase 4 chose to author verify commands directly in PLAN.md `must_haves:` rather than extending TEST-SPEC.md
- Rationale: TEST-SPEC.md isn't always present; coupling verification harness to test-phase being run was avoided
- If test-phase is later enhanced to produce executable scenarios, Phase 4's must_haves verify schema is the natural consumer
- Signal: [STRONG] — explicit deferral

**For future executor-level TDD enhancement:**
- gsd-executor already has TDD support but it's opt-in per task (`tdd="true"`)
- User implicitly acknowledged making TDD default is a separate concern from verification harness
- Worth its own scoping conversation: making TDD default-ON parallels Phase 4's verify_after default-ON decision
- Signal: [STRONG] — out-of-scope decision for Phase 4

---
