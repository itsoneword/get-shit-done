---
pattern_id: python-resource-management
title: Python Resource Management via Generator Context Manager
language: python
source_repo: https://github.com/python/cpython
source_file: Lib/contextlib.py
source_lines: "125-152"
source_permalink: https://github.com/python/cpython/blob/v3.12.3/Lib/contextlib.py#L125-L152
license: PSF-2.0
counters:
  - Python-Specific Bugs
  - Error Handling
---

## What this solves

Resource cleanup is routinely skipped on exception paths when manually managing
`try/finally` blocks — especially when early returns, nested generators, or unexpected
exceptions are involved. The `@contextmanager` decorator and its `_GeneratorContextManager`
implementation guarantee that the `finally` block in any generator-based context manager
*always* runs when the `with` block exits, whether normally or via exception. Without this,
callers must remember to pair every acquisition with a release; with it, the cleanup
obligation is encoded in the context manager's definition once and applied everywhere via
`with`.

## Excerpt

```python
class _GeneratorContextManager(
    _GeneratorContextManagerBase,
    AbstractContextManager,
    ContextDecorator,
):
    """Helper for @contextmanager decorator."""

    def __enter__(self):
        # do not keep args and kwds alive unnecessarily
        # they are only needed for recreation, which is not possible anymore
        del self.args, self.kwds, self.func
        try:
            return next(self.gen)
        except StopIteration:
            raise RuntimeError("generator didn't yield") from None

    def __exit__(self, typ, value, traceback):
        if typ is None:
            try:
                next(self.gen)
            except StopIteration:
                return False
            else:
                try:
                    raise RuntimeError("generator didn't stop")
                finally:
                    self.gen.close()
        else:
```

## Why it's good

- `__enter__` advances the generator to the first `yield` and returns the yielded value;
  if the generator doesn't yield, it fails loudly with `RuntimeError` — there is no silent
  no-op path.
- `__exit__` routes the exception (if any) back into the generator via `gen.throw(value)`,
  so the generator's own `except`/`finally` blocks see the real exception and can perform
  conditional cleanup — not just unconditional close.
- The `del self.args, self.kwds, self.func` in `__enter__` releases the factory arguments
  once the generator is running — a real-world memory discipline that synthetic examples
  universally omit.
- This is the implementation that `@contextmanager`-decorated functions depend on in every
  Python 3.x release; it has been exercised by millions of `with open(...)`, `with lock:`,
  and `with tempfile.TemporaryDirectory()` call sites.

## What NOT to cargo-cult

- `_GeneratorContextManager` is a CPython-internal class; do not subclass or instantiate it
  directly. The public interface is the `@contextmanager` decorator — use that.
- Don't reimplement `contextlib` by hand. The `gen.throw()` protocol in `__exit__` has
  subtle edge cases around `StopIteration` wrapping, `RuntimeError` re-raise, and
  `BaseException` propagation (all handled in the full `__exit__` body from line 141
  onward) — these are easy to get wrong in a manual reimplementation.
- The `ContextDecorator` mixin allows using the context manager as a function decorator
  (`@mycontext`) — this is convenient but uncommon; don't assume all context managers
  support it.
