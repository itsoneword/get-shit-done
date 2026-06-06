/**
 * Frontmatter — YAML frontmatter parsing, serialization, and CRUD commands
 */

const fs = require('fs');
const path = require('path');
const { safeReadFile, normalizeMd, output, error } = require('./core.cjs');

// ─── Parsing engine ───────────────────────────────────────────────────────────

function extractFrontmatter(content) {
  const frontmatter = {};
  // Find ALL frontmatter blocks at the start of the file.
  // If multiple blocks exist (corruption from CRLF mismatch), use the LAST one
  // since it represents the most recent state sync.
  const allBlocks = [...content.matchAll(/(?:^|\n)\s*---\r?\n([\s\S]+?)\r?\n---/g)];
  const match = allBlocks.length > 0 ? allBlocks[allBlocks.length - 1] : null;
  if (!match) return frontmatter;

  const yaml = match[1];
  const lines = yaml.split(/\r?\n/);

  // Stack to track nested objects: [{obj, key, indent}]
  // obj = object to write to, key = current key collecting array items, indent = indentation level
  let stack = [{ obj: frontmatter, key: null, indent: -1 }];

  for (const line of lines) {
    // Skip empty lines
    if (line.trim() === '') continue;

    // Calculate indentation (number of leading spaces)
    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1].length : 0;

    // Pop stack back to appropriate level
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const current = stack[stack.length - 1];

    // Check for key: value pattern
    const keyMatch = line.match(/^(\s*)([a-zA-Z0-9_-]+):\s*(.*)/);
    if (keyMatch) {
      const key = keyMatch[2];
      const value = keyMatch[3].trim();

      if (value === '' || value === '[') {
        // Key with no value or opening bracket — could be nested object or array
        // We'll determine based on next lines, for now create placeholder
        current.obj[key] = value === '[' ? [] : {};
        current.key = null;
        // Push new context for potential nested content
        stack.push({ obj: current.obj[key], key: null, indent });
      } else if (value.startsWith('[') && value.endsWith(']')) {
        // Inline array: key: [a, b, c]
        current.obj[key] = value.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
        current.key = null;
      } else {
        // Simple key: value
        current.obj[key] = value.replace(/^["']|["']$/g, '');
        current.key = null;
      }
    } else if (line.trim().startsWith('- ')) {
      // Array item
      const itemValue = line.trim().slice(2).replace(/^["']|["']$/g, '');

      // If current context is an empty object, convert to array
      if (typeof current.obj === 'object' && !Array.isArray(current.obj) && Object.keys(current.obj).length === 0) {
        // Find the key in parent that points to this object and convert it
        const parent = stack.length > 1 ? stack[stack.length - 2] : null;
        if (parent) {
          for (const k of Object.keys(parent.obj)) {
            if (parent.obj[k] === current.obj) {
              parent.obj[k] = [itemValue];
              current.obj = parent.obj[k];
              break;
            }
          }
        }
      } else if (Array.isArray(current.obj)) {
        current.obj.push(itemValue);
      }
    }
  }

  return frontmatter;
}

function reconstructFrontmatter(obj) {
  const lines = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else if (value.every(v => typeof v === 'string') && value.length <= 3 && value.join(', ').length < 60) {
        lines.push(`${key}: [${value.join(', ')}]`);
      } else {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - ${typeof item === 'string' && (item.includes(':') || item.includes('#')) ? `"${item}"` : item}`);
        }
      }
    } else if (typeof value === 'object') {
      lines.push(`${key}:`);
      for (const [subkey, subval] of Object.entries(value)) {
        if (subval === null || subval === undefined) continue;
        if (Array.isArray(subval)) {
          if (subval.length === 0) {
            lines.push(`  ${subkey}: []`);
          } else if (subval.every(v => typeof v === 'string') && subval.length <= 3 && subval.join(', ').length < 60) {
            lines.push(`  ${subkey}: [${subval.join(', ')}]`);
          } else {
            lines.push(`  ${subkey}:`);
            for (const item of subval) {
              lines.push(`    - ${typeof item === 'string' && (item.includes(':') || item.includes('#')) ? `"${item}"` : item}`);
            }
          }
        } else if (typeof subval === 'object') {
          lines.push(`  ${subkey}:`);
          for (const [subsubkey, subsubval] of Object.entries(subval)) {
            if (subsubval === null || subsubval === undefined) continue;
            if (Array.isArray(subsubval)) {
              if (subsubval.length === 0) {
                lines.push(`    ${subsubkey}: []`);
              } else {
                lines.push(`    ${subsubkey}:`);
                for (const item of subsubval) {
                  lines.push(`      - ${item}`);
                }
              }
            } else {
              lines.push(`    ${subsubkey}: ${subsubval}`);
            }
          }
        } else {
          const sv = String(subval);
          lines.push(`  ${subkey}: ${sv.includes(':') || sv.includes('#') ? `"${sv}"` : sv}`);
        }
      }
    } else {
      const sv = String(value);
      if (sv.includes(':') || sv.includes('#') || sv.startsWith('[') || sv.startsWith('{')) {
        lines.push(`${key}: "${sv}"`);
      } else {
        lines.push(`${key}: ${sv}`);
      }
    }
  }
  return lines.join('\n');
}

function spliceFrontmatter(content, newObj) {
  const yamlStr = reconstructFrontmatter(newObj);
  const match = content.match(/^---\r?\n[\s\S]+?\r?\n---/);
  if (match) {
    return `---\n${yamlStr}\n---` + content.slice(match[0].length);
  }
  return `---\n${yamlStr}\n---\n\n` + content;
}

function parseMustHavesBlock(content, blockName) {
  // Extract a specific block from must_haves in raw frontmatter YAML.
  // Detects must_haves child indent dynamically so it works for both
  // 2-space plans (real plans) and 4-space plans (legacy test fixtures).
  const fmMatch = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  if (!fmMatch) return [];

  const yaml = fmMatch[1];
  const yamlLines = yaml.split(/\r?\n/);

  // Step 1: Find must_haves: and compute its indent level (mhIndent).
  const mhLineMatch = yaml.match(/^(\s*)must_haves:\s*$/m);
  if (!mhLineMatch) return [];
  const mhIndent = mhLineMatch[1].length;

  // Step 2: Determine child indent = indent of first non-blank line after must_haves:.
  const mhLineIdx = yamlLines.findIndex(l => /^(\s*)must_haves:\s*$/.test(l));
  let childIndent = null;
  for (let i = mhLineIdx + 1; i < yamlLines.length; i++) {
    const l = yamlLines[i];
    if (l.trim() === '') continue;
    const ind = l.match(/^(\s*)/)[1].length;
    if (ind > mhIndent) { childIndent = ind; break; }
    break; // non-blank, non-deeper line — must_haves block is empty
  }
  if (childIndent === null) return [];

  // Derive relative indents. At childIndent=4: itemIndent=6, keyIndent=8, nestedArrIndent=10
  // (identical to the former hardcodes, preserving 4-space test fixture behaviour).
  const itemIndent = childIndent + 2;
  const keyIndent = childIndent + 4;
  const nestedArrIndent = childIndent + 6;

  // Step 3: Find the block header anchored at EXACTLY childIndent spaces.
  // Using exact-count `\s{N}` prevents matching a same-named key nested deeper
  // (e.g., `artifacts:` at 6-space under truths[0] must not be selected when
  // the top-level `artifacts:` is at 2-space childIndent).
  const headerPattern = new RegExp(`^([ ]{${childIndent}})${blockName}:\\s*$`, 'm');
  const blockStart = yaml.search(headerPattern);
  if (blockStart === -1) return [];

  const afterBlock = yaml.slice(blockStart);
  const blockLines = afterBlock.split(/\r?\n/).slice(1); // skip the header line itself

  // Step 4: Walk block body and build items array.
  const items = [];
  let current = null;

  const itemDashRe = new RegExp(`^\\s{${itemIndent}}-\\s+`);
  const simpleStrRe = new RegExp(`^\\s{${itemIndent}}-\\s+"?([^"]+)"?\\s*$`);
  const kvOnDashRe  = new RegExp(`^\\s{${itemIndent}}-\\s+(\\w+):\\s*"?([^"]*)"?\\s*$`);
  const contKeyRe   = new RegExp(`^\\s{${keyIndent},}(\\w+):\\s*"?([^"]*)"?\\s*$`);
  const nestedArrRe = new RegExp(`^\\s{${nestedArrIndent},}-\\s+"?([^"]+)"?\\s*$`);

  for (const line of blockLines) {
    if (line.trim() === '') continue;
    const indent = line.match(/^(\s*)/)[1].length;
    // Stop when we return to child-block-sibling level or shallower.
    if (indent <= childIndent) break;

    if (itemDashRe.test(line)) {
      // New list item
      if (current !== null) items.push(current);
      const simpleMatch = simpleStrRe.exec(line);
      if (simpleMatch && !line.includes(':')) {
        current = simpleMatch[1];
      } else {
        const kvMatch = kvOnDashRe.exec(line);
        if (kvMatch) {
          current = { [kvMatch[1]]: kvMatch[2] };
        } else {
          current = {};
        }
      }
    } else if (current !== null && typeof current === 'object') {
      // Continuation key-value (lower-bound: tolerates deeper sub-structure)
      const kvMatch = contKeyRe.exec(line);
      if (kvMatch) {
        const val = kvMatch[2];
        current[kvMatch[1]] = /^\d+$/.test(val) ? parseInt(val, 10) : val;
      }
      // Nested array item under the last-added key
      const arrMatch = nestedArrRe.exec(line);
      if (arrMatch) {
        const keys = Object.keys(current);
        const lastKey = keys[keys.length - 1];
        if (lastKey) {
          if (!Array.isArray(current[lastKey])) {
            current[lastKey] = current[lastKey] ? [current[lastKey]] : [];
          }
          current[lastKey].push(arrMatch[1]);
        }
      }
    }
  }
  if (current !== null) items.push(current);

  return items;
}

// ─── Frontmatter CRUD commands ────────────────────────────────────────────────

const FRONTMATTER_SCHEMAS = {
  plan: { required: ['phase', 'plan', 'type', 'wave', 'depends_on', 'files_modified', 'autonomous', 'must_haves'] },
  summary: { required: ['phase', 'plan', 'subsystem', 'tags', 'duration', 'completed'] },
  verification: { required: ['phase', 'verified', 'status', 'score'] },
};

function cmdFrontmatterGet(cwd, filePath, field, raw) {
  if (!filePath) { error('file path required'); }
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  const content = safeReadFile(fullPath);
  if (!content) { output({ error: 'File not found', path: filePath }, raw); return; }
  const fm = extractFrontmatter(content);
  if (field) {
    const value = fm[field];
    if (value === undefined) { output({ error: 'Field not found', field }, raw); return; }
    output({ [field]: value }, raw, JSON.stringify(value));
  } else {
    output(fm, raw);
  }
}

function cmdFrontmatterSet(cwd, filePath, field, value, raw) {
  if (!filePath || !field || value === undefined) { error('file, field, and value required'); }
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  if (!fs.existsSync(fullPath)) { output({ error: 'File not found', path: filePath }, raw); return; }
  const content = fs.readFileSync(fullPath, 'utf-8');
  const fm = extractFrontmatter(content);
  let parsedValue;
  try { parsedValue = JSON.parse(value); } catch { parsedValue = value; }
  fm[field] = parsedValue;
  const newContent = spliceFrontmatter(content, fm);
  fs.writeFileSync(fullPath, normalizeMd(newContent), 'utf-8');
  output({ updated: true, field, value: parsedValue }, raw, 'true');
}

function cmdFrontmatterMerge(cwd, filePath, data, raw) {
  if (!filePath || !data) { error('file and data required'); }
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  if (!fs.existsSync(fullPath)) { output({ error: 'File not found', path: filePath }, raw); return; }
  const content = fs.readFileSync(fullPath, 'utf-8');
  const fm = extractFrontmatter(content);
  let mergeData;
  try { mergeData = JSON.parse(data); } catch { error('Invalid JSON for --data'); return; }
  Object.assign(fm, mergeData);
  const newContent = spliceFrontmatter(content, fm);
  fs.writeFileSync(fullPath, normalizeMd(newContent), 'utf-8');
  output({ merged: true, fields: Object.keys(mergeData) }, raw, 'true');
}

function cmdFrontmatterValidate(cwd, filePath, schemaName, raw) {
  if (!filePath || !schemaName) { error('file and schema required'); }
  const schema = FRONTMATTER_SCHEMAS[schemaName];
  if (!schema) { error(`Unknown schema: ${schemaName}. Available: ${Object.keys(FRONTMATTER_SCHEMAS).join(', ')}`); }
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  const content = safeReadFile(fullPath);
  if (!content) { output({ error: 'File not found', path: filePath }, raw); return; }
  const fm = extractFrontmatter(content);
  const missing = schema.required.filter(f => fm[f] === undefined);
  const present = schema.required.filter(f => fm[f] !== undefined);
  output({ valid: missing.length === 0, missing, present, schema: schemaName }, raw, missing.length === 0 ? 'valid' : 'invalid');
}

module.exports = {
  extractFrontmatter,
  reconstructFrontmatter,
  spliceFrontmatter,
  parseMustHavesBlock,
  FRONTMATTER_SCHEMAS,
  cmdFrontmatterGet,
  cmdFrontmatterSet,
  cmdFrontmatterMerge,
  cmdFrontmatterValidate,
};
