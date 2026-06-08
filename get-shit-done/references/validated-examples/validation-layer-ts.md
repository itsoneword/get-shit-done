---
pattern_id: validation-layer-ts
title: Typed Input Validation with Zod parse and safeParse
language: typescript
source_repo: https://github.com/colinhacks/zod
source_file: packages/zod/src/v3/types.ts
source_lines: "223-245"
source_permalink: https://github.com/colinhacks/zod/blob/v4.4.3/packages/zod/src/v3/types.ts#L223-L245
license: MIT
counters:
  - Data Shape / API Contract
  - Type / Coercion
---

## What this solves

Without a typed validation boundary, unknown inputs (HTTP request bodies, JSON payloads, config files) enter the application as `unknown` or `any`, and type errors surface at runtime far from where the data entered. This pattern establishes a parse boundary at the entry point: `parse` throws immediately on invalid input, while `safeParse` returns a discriminated union `{ success: true, data: T }` or `{ success: false, error: ZodError }` that forces the caller to handle both cases before accessing the validated value.

## Excerpt

```typescript
  parse(data: unknown, params?: util.InexactPartial<ParseParams>): Output {
    const result = this.safeParse(data, params);
    if (result.success) return result.data;
    throw result.error;
  }

  safeParse(data: unknown, params?: util.InexactPartial<ParseParams>): SafeParseReturnType<Input, Output> {
    const ctx: ParseContext = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap,
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data),
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });

    return handleResult(ctx, result);
  }
```

## Why it's good

- `safeParse` accepts `unknown` and returns a discriminated union, so the TypeScript compiler enforces a `.success` check before `result.data` is accessible — the type system blocks unsafe access at the boundary.
- `parse` is implemented as a thin wrapper over `safeParse` rather than a separate code path, so the validation logic is a single function (`safeParse`) and the throwing variant adds no new surface for bugs.
- The `ParseContext` captures the error path and issue list during traversal; when validation fails, `ZodError` carries the full path to each failing field — essential for diagnosing nested schema mismatches.
- The schema itself (`ZodType` subclass) is the single source of truth for both the TypeScript static type (`Output`) and the runtime validation — they cannot drift apart because they are derived from the same definition.

## What NOT to cargo-cult

- `_parseSync` and `_parse` are internal abstract methods; call only the public `parse`/`safeParse` API — the internal pipeline can change between Zod minor versions.
- The `ParseParams` / `ParseContext` machinery is Zod's internal plumbing for composing nested schemas; copy the call-site pattern (`.parse(input)` or `.safeParse(input)`) not the internals.
- Don't over-nest schemas: Zod's composability encourages deeply nested `z.object` chains, but excessive nesting produces `ZodError` paths that are hard to map back to user-facing field names.
