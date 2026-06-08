---
pattern_id: error-propagation-python
title: Error Propagation Without Swallowing (Python)
language: python
source_repo: https://github.com/psf/requests
source_file: requests/adapters.py
source_lines: "500-519"
source_permalink: https://github.com/psf/requests/blob/v2.31.0/requests/adapters.py#L500-L519
license: Apache-2.0
counters:
  - Error Handling
  - Python-Specific Bugs
---

## What this solves

Without explicit re-wrapping, low-level transport exceptions (urllib3's `MaxRetryError`,
`ProtocolError`, `SSLError`) leak through to callers who have no idea what urllib3 is.
This forces callers to catch library-internal exception types, creating tight coupling and
making the API surface unpredictable. The `HTTPAdapter.send` except blocks translate every
urllib3 exception variant into requests' own typed hierarchy — so callers catch
`requests.exceptions.ConnectionError` or `requests.exceptions.Timeout`, never urllib3
internals — and always pass the original exception as the cause, preserving the full
traceback chain.

## Excerpt

```python
        except (ProtocolError, OSError) as err:
            raise ConnectionError(err, request=request)

        except MaxRetryError as e:
            if isinstance(e.reason, ConnectTimeoutError):
                # TODO: Remove this in 3.0.0: see #2811
                if not isinstance(e.reason, NewConnectionError):
                    raise ConnectTimeout(e, request=request)

            if isinstance(e.reason, ResponseError):
                raise RetryError(e, request=request)

            if isinstance(e.reason, _ProxyError):
                raise ProxyError(e, request=request)

            if isinstance(e.reason, _SSLError):
                # This branch is for urllib3 v1.22 and later.
                raise SSLError(e, request=request)

            raise ConnectionError(e, request=request)
```

## Why it's good

- Every `raise X(e, ...)` passes the urllib3 exception as the first positional arg, which
  means `X.__cause__` is set automatically — the full traceback chain is intact for
  debugging while the public-facing type is requests-only.
- The `MaxRetryError` branch inspects `e.reason` to choose the *most specific* typed
  exception (`ConnectTimeout`, `RetryError`, `ProxyError`, `SSLError`) before falling
  back to the generic `ConnectionError` — structured dispatch, not catch-all.
- Transport-layer volatility (urllib3 version differences, e.g. `_SSLError` in v1.22+ vs
  earlier) is absorbed here; callers are completely shielded from urllib3 versioning.
- This survived years of production use and urllib3 API churn; the `# TODO: Remove in
  3.0.0` comment shows explicit versioned cleanup intent rather than leaving debt silent.

## What NOT to cargo-cult

- The requests-specific exception class names (`ConnectionError`, `ConnectTimeout`,
  `RetryError`, etc.) are defined in `requests.exceptions` — don't import or imitate these
  names outside a requests-compatible codebase; they shadow Python's built-in
  `ConnectionError`.
- The `request=request` kwarg on every raise is requests-specific context threading;
  it attaches the `PreparedRequest` object to the exception for downstream introspection.
  Only useful if your exception hierarchy supports it.
- The `(ProtocolError, OSError)` catch lumps a urllib3 type with a standard library type
  — this is a deliberate compatibility shim for older urllib3 versions, not a general
  pattern for mixing library and stdlib exceptions in one `except` clause.
