---
pattern_id: async-retry-backoff
title: Async Retry with Bounded Backoff and Timeout Cap
language: javascript
source_repo: https://github.com/nodejs/undici
source_file: lib/handler/retry-handler.js
source_lines: "143-163"
source_permalink: https://github.com/nodejs/undici/blob/v6.21.0/lib/handler/retry-handler.js#L143-L163
license: MIT
counters:
  - Async / Timing
  - Error Handling
---

## What this solves

Without a bounded retry strategy, a caller can loop indefinitely on transient failures, exhaust connection pools, and leak timers that fire after a request has been aborted. This pattern enforces three invariants: the retry count is bounded by `maxRetries`, the delay is computed via exponential backoff capped at `maxTimeout`, and the server's own `Retry-After` hint takes precedence over the computed delay — so neither the client nor the server drives the retry loop alone.

## Excerpt

```javascript
    // If we reached the max number of retries
    if (counter > maxRetries) {
      cb(err)
      return
    }

    let retryAfterHeader = headers?.['retry-after']
    if (retryAfterHeader) {
      retryAfterHeader = Number(retryAfterHeader)
      retryAfterHeader = Number.isNaN(retryAfterHeader)
        ? calculateRetryAfterHeader(retryAfterHeader)
        : retryAfterHeader * 1e3 // Retry-After is in seconds
    }

    const retryTimeout =
      retryAfterHeader > 0
        ? Math.min(retryAfterHeader, maxTimeout)
        : Math.min(minTimeout * timeoutFactor ** (counter - 1), maxTimeout)

    setTimeout(() => cb(null), retryTimeout)
  }
```

## Why it's good

- The max-retry guard (`counter > maxRetries`) fires before any delay computation — if retries are exhausted the error propagates immediately without scheduling a timer.
- Exponential backoff is `minTimeout * timeoutFactor ** (counter - 1)`, giving the classic doubling curve, but `Math.min(..., maxTimeout)` caps it so the delay never exceeds a hard ceiling regardless of counter magnitude.
- Server-supplied `Retry-After` takes precedence over the computed delay, but is still capped at `maxTimeout` — the caller does not blindly trust a server that returns a far-future retry header.
- Because the retry fires inside `setTimeout(() => cb(null), ...)`, the only resource held during the wait is a timer handle — no connection is kept open while waiting to retry.

## What NOT to cargo-cult

- The `cb` callback pattern is undici's internal dispatch interface; external callers use `undici.request()` options, not this handler directly.
- The upstream-abort path (`this.abort`, `isDisturbed`) is specific to undici's streaming protocol and the way it wraps Node's HTTP/2 internals — do not replicate the abort detection logic verbatim in non-undici code.
- The `statusCodes` and `errorCodes` allowlists (lines 121–141, not shown) guard which errors are retryable at all; the excerpt shows only the timing calculation after those guards have passed.
