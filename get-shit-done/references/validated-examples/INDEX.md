# Validated Examples — Index

Read this to find which pattern file to load. Load only the specific file you need — never load all entries.

| pattern_id | constraint (one line) | language | file |
|------------|----------------------|----------|------|
| async-retry-backoff | Bounded exponential backoff capped at maxTimeout with server Retry-After precedence; no infinite retry or timer leak | javascript | validated-examples/async-retry-backoff.md |
| error-propagation-python | Translate low-level transport exceptions into a typed hierarchy preserving original cause; callers never catch library internals | python | validated-examples/error-propagation-python.md |
| validation-layer-python | Parse untrusted input into a fully-typed model or raise a structured ValidationError; no half-valid state | python | validated-examples/validation-layer-python.md |
| python-resource-management | Guarantee cleanup on all exit paths (normal and exception) via generator-based context manager | python | validated-examples/python-resource-management.md |
| validation-layer-ts | Parse boundary at entry point: parse throws on invalid input, safeParse returns discriminated union forcing both cases handled | typescript | validated-examples/validation-layer-ts.md |
| config-env-validation | Validate all env vars against a JSON Schema at startup and fail fast with a descriptive error before any server logic runs | javascript | validated-examples/config-env-validation.md |

<!-- INDEX must stay slim: only these four columns. No code excerpts. No "why it's good" prose.
     Commentary belongs exclusively in the per-entry pattern files. -->
