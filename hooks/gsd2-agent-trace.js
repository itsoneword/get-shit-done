#!/usr/bin/env node
// gsd2-agent-trace.js — PostToolUse hook skeleton (Plan 01 Tasks 1-2)
// Pure functions exported for testing; stdin reader only runs when executed directly.
// Full record-writing body added in Plan 02.

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
  // stdin reader IIFE (full body added in Plan 02) — for now, a minimal pass-through:
  let input = '';
  const stdinTimeout = setTimeout(() => process.exit(0), 10000);
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', c => input += c);
  process.stdin.on('end', () => { clearTimeout(stdinTimeout); process.exit(0); });
}
