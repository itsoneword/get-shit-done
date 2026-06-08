---
pattern_id: config-env-validation
title: Config and Environment Validation with Schema and Fail-Fast Error
language: javascript
source_repo: https://github.com/fastify/env-schema
source_file: index.js
source_lines: "107-124"
source_permalink: https://github.com/fastify/env-schema/blob/v7.0.0/index.js#L107-L124
license: MIT
counters:
  - Environment / Config
  - Data Shape / API Contract
---

## What this solves

Without schema validation, reading env vars silently produces `undefined` for missing keys, wrong types for numeric values, and crashes that appear far from the misconfigured variable. This pattern reads all env data into a single merged object, validates it against a JSON Schema that declares required fields, types, and defaults in one place, and throws a descriptive error immediately if validation fails — pinpointing the misconfigured key before any server logic runs.

## Excerpt

```javascript
  const merge = {}
  data.forEach(d => Object.assign(merge, d))

  if (expandEnv) {
    expandVariables(merge)
  }

  const ajv = chooseAjvInstance(sharedAjvInstance, opts.ajv)

  const valid = ajv.validate(schema, merge)
  if (!valid) {
    const error = new Error(ajv.errorsText(ajv.errors, { dataVar: 'env' }))
    error.errors = ajv.errors
    throw error
  }

  return merge
}
```

## Why it's good

- All env sources (dotenv file, `process.env`, caller-supplied overrides) are merged into a single object before validation — the schema fires on the resolved value, not on multiple partial sources.
- AJV is configured with `coerceTypes: true` and `useDefaults: true` (lines 143–152, not shown), so string env vars like `"3000"` become the integer `3000` and missing optional fields get filled in — eliminating manual `parseInt`/`|| defaultValue` scatter.
- The error message uses `ajv.errorsText({ dataVar: 'env' })` which names the problem variable explicitly (e.g., `"env/PORT must be integer"`) rather than a generic validation failure.
- The function returns the merged, validated, type-coerced config object directly — callers receive a typed value they can trust rather than raw `process.env` strings.

## What NOT to cargo-cult

- The AJV instance configuration (`coerceTypes`, `removeAdditional`, `useDefaults`) is specific to env-schema's design contract; re-using it verbatim for general API validation would silently strip unexpected fields and coerce types in ways that surprise callers.
- The `data` array / merge strategy is env-schema's own multi-source layering (dotenv → process.env → opts.data); if you only need `process.env`, the merge loop is unnecessary and can be replaced with a direct schema validate call.
- `schema.additionalProperties = false` is mutated onto the caller's schema object in-place (line 73, not shown); this would cause surprising field-stripping if the same schema object is reused elsewhere.
