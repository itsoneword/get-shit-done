const { test } = require('node:test');
const assert = require('node:assert');
const { scrapeConfidence, extractReturnText } = require('../hooks/gsd2-agent-trace.js');

// scrapeConfidence: prose form
test('scrapeConfidence returns HIGH from prose form', () => {
  assert.strictEqual(scrapeConfidence('**Confidence:** HIGH'), 'HIGH');
});

// scrapeConfidence: JSON form
test('scrapeConfidence returns MEDIUM from JSON form', () => {
  assert.strictEqual(scrapeConfidence('"confidence": "MEDIUM"'), 'MEDIUM');
});

// scrapeConfidence: absent -> null
test('scrapeConfidence returns null when absent', () => {
  assert.strictEqual(scrapeConfidence('## PLANNING COMPLETE\nNo verdict here.'), null);
});

// scrapeConfidence: empty string -> null
test('scrapeConfidence returns null for empty string', () => {
  assert.strictEqual(scrapeConfidence(''), null);
});

// scrapeConfidence: null input -> null
test('scrapeConfidence returns null for null input', () => {
  assert.strictEqual(scrapeConfidence(null), null);
});

// extractReturnText: bare content-array flatten
test('extractReturnText flattens bare content array', () => {
  assert.strictEqual(
    extractReturnText([{type:'text',text:'a'},{type:'text',text:'b'}]),
    'a\nb'
  );
});

// extractReturnText: object-with-.content (confirmed transcript shape)
test('extractReturnText extracts text from object-with-.content shape', () => {
  assert.strictEqual(
    extractReturnText({content:[{type:'text',text:'**Confidence:** LOW'}]}),
    '**Confidence:** LOW'
  );
});

// extractReturnText: result-string fallback
test('extractReturnText returns result string from result-string fallback', () => {
  assert.strictEqual(extractReturnText({result:'hello'}), 'hello');
});

// extractReturnText: plain string passthrough
test('extractReturnText returns plain string as-is', () => {
  assert.strictEqual(extractReturnText('plain'), 'plain');
});
