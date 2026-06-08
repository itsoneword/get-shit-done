#!/usr/bin/env node
// gsd-hook-version: 1.5.0
// gsd2-agent-trace.js — PostToolUse / PostToolUseFailure hook
// Appends one JSONL record to .planning/telemetry/agent-trace.jsonl per gsd-* subagent spawn.
// Pure functions exported for testing; stdin reader only runs when executed directly.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function scrapeConfidence(text) {
  if (!text) return null;
  const m = String(text).match(/confidence\s*["']?\s*[:=]\s*\**\s*["']?(HIGH|MEDIUM|LOW)/i);
  return m ? m[1].toUpperCase() : null;
}

function extractReturnText(toolResponse) {
  if (toolResponse && Array.isArray(toolResponse.content)) {
    return toolResponse.content
      .filter(b => b && b.type === 'text')
      .map(b => b.text || '')
      .join('\n');
  }
  if (Array.isArray(toolResponse)) {
    return toolResponse
      .filter(b => b && b.type === 'text')
      .map(b => b.text || '')
      .join('\n');
  }
  if (toolResponse && typeof toolResponse.result === 'string') return toolResponse.result;
  return typeof toolResponse === 'string' ? toolResponse : JSON.stringify(toolResponse || '');
}

module.exports = { scrapeConfidence, extractReturnText };

if (require.main === module) {
  let input = '';
  // Timeout guard: exit silently if stdin doesn't close within 10s (pipe issues / slow piping).
  // See gsd2-context-monitor.js #775, #1162.
  const stdinTimeout = setTimeout(() => process.exit(0), 10000);
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', c => input += c);
  process.stdin.on('end', () => {
    clearTimeout(stdinTimeout);
    try {
      const data = JSON.parse(input);
      const { session_id, cwd, tool_input, tool_response, hook_event_name } = data;

      // Bail: missing required envelope fields
      if (!session_id || !cwd) process.exit(0);

      // Guard: only gsd-* subagent spawns (OBS-01 filter + subagent-context guard per RESEARCH Q4)
      const agentType = tool_input?.subagent_type || '';
      if (!agentType.startsWith('gsd-')) process.exit(0);

      // Config gate: default-on (absent or true = enabled; explicit false = disabled)
      const configPath = path.join(cwd, '.planning', 'config.json');
      if (fs.existsSync(configPath)) {
        try {
          const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          if (cfg.hooks?.agent_trace === false) process.exit(0);
        } catch (_) {
          // Ignore config parse errors — proceed as default-on
        }
      }

      // GSD-project guard: self-disable in non-GSD projects
      if (!fs.existsSync(path.join(cwd, '.planning', 'STATE.md'))) process.exit(0);

      // Extract return text + scrape confidence verdict (null is the common case)
      const returnText = extractReturnText(tool_response);
      const confidence = scrapeConfidence(returnText);

      // Correlation fields
      const desc = tool_input?.description || '';
      const descHash = crypto.createHash('sha256').update(desc).digest('hex').slice(0, 8);

      // Event type: PostToolUseFailure writes agent.error; PostToolUse writes agent.return
      const event = hook_event_name === 'PostToolUseFailure' ? 'agent.error' : 'agent.return';

      // Ensure telemetry dir exists
      const telemetryDir = path.join(cwd, '.planning', 'telemetry');
      fs.mkdirSync(telemetryDir, { recursive: true });
      const logPath = path.join(telemetryDir, 'agent-trace.jsonl');

      // Per-session seq: count existing lines for this session only
      let seq = 0;
      if (fs.existsSync(logPath)) {
        const existing = fs.readFileSync(logPath, 'utf8');
        seq = (existing.match(new RegExp('"session_id":"' + session_id + '"', 'g')) || []).length;
      }

      // duration_ms: use top-level whole-call field confirmed by 04-01 envelope capture
      const duration_ms = (typeof data.duration_ms === 'number') ? data.duration_ms : null;

      const record = {
        event,
        session_id,
        seq,
        ts_return: new Date().toISOString(),
        agent_type: agentType,
        description: desc,
        desc_hash: descHash,
        confidence,
        duration_ms
      };

      fs.appendFileSync(logPath, JSON.stringify(record) + '\n');
    } catch (_) {
      // Silent fail — never block tool execution
    }
    process.exit(0);
  });
}
