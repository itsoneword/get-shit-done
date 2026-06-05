const { test } = require('node:test');
const assert = require('node:assert');
const { filterTrace, formatTable } = require('../get-shit-done/bin/lib/trace.cjs');

// Fixture: 4 records — 2 gsd-phase-researcher in s1 (LOW then HIGH), 1 gsd-planner in s1, 1 gsd-planner in s2
const fixtures = [
  {
    event: 'agent.return',
    session_id: 's1',
    seq: 0,
    ts_return: '2026-06-05T10:00:00.000Z',
    agent_type: 'gsd-phase-researcher',
    confidence: 'LOW',
  },
  {
    event: 'agent.return',
    session_id: 's1',
    seq: 1,
    ts_return: '2026-06-05T10:05:00.000Z',
    agent_type: 'gsd-phase-researcher',
    confidence: 'HIGH',
  },
  {
    event: 'agent.return',
    session_id: 's1',
    seq: 2,
    ts_return: '2026-06-05T10:10:00.000Z',
    agent_type: 'gsd-planner',
    confidence: null,
  },
  {
    event: 'agent.return',
    session_id: 's2',
    seq: 0,
    ts_return: '2026-06-05T10:15:00.000Z',
    agent_type: 'gsd-planner',
    confidence: null,
  },
];

// filterTrace: session filter
test('filterTrace({session:"s1"}) returns 3 records all in session s1', () => {
  const result = filterTrace(fixtures, { session: 's1' });
  assert.strictEqual(result.length, 3);
  assert.ok(result.every(r => r.session_id === 's1'));
});

// filterTrace: agent prefix filter
test('filterTrace({agent:"gsd-phase"}) returns 2 researcher records', () => {
  const result = filterTrace(fixtures, { agent: 'gsd-phase' });
  assert.strictEqual(result.length, 2);
  assert.ok(result.every(r => r.agent_type.startsWith('gsd-phase')));
});

// filterTrace: confidence filter
test('filterTrace({confidence:"LOW"}) returns exactly 1 record', () => {
  const result = filterTrace(fixtures, { confidence: 'LOW' });
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].confidence, 'LOW');
});

// filterTrace: last N records
test('filterTrace({last:2}) returns last 2 records in order', () => {
  const result = filterTrace(fixtures, { last: 2 });
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].session_id, 's1');
  assert.strictEqual(result[0].agent_type, 'gsd-planner');
  assert.strictEqual(result[1].session_id, 's2');
});

// filterTrace: LOW->HIGH correlation — same session, same agent_type
test('filterTrace({session:"s1", agent:"gsd-phase-researcher"}) returns 2 records with confidence LOW then HIGH', () => {
  const result = filterTrace(fixtures, { session: 's1', agent: 'gsd-phase-researcher' });
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].confidence, 'LOW');
  assert.strictEqual(result[1].confidence, 'HIGH');
});

// formatTable: contains header and data
test('formatTable returns string containing header tokens and a data row', () => {
  const out = formatTable(fixtures.slice(0, 2));
  assert.ok(typeof out === 'string', 'should return a string');
  assert.ok(out.includes('agent_type'), 'should include agent_type header');
  assert.ok(out.includes('confidence'), 'should include confidence header');
  assert.ok(out.includes('gsd-phase-researcher'), 'should include gsd-phase-researcher row');
});

// formatTable: empty array returns header only (no crash)
test('formatTable([]) returns header without crashing', () => {
  const out = formatTable([]);
  assert.ok(typeof out === 'string');
  assert.ok(out.includes('agent_type'));
});
