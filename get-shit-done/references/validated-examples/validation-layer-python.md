---
pattern_id: validation-layer-python
title: Validation Layer — Typed Input Parsing (Python / Pydantic)
language: python
source_repo: https://github.com/pydantic/pydantic
source_file: pydantic/main.py
source_lines: "240-260"
source_permalink: https://github.com/pydantic/pydantic/blob/v2.12.5/pydantic/main.py#L240-L260
license: MIT
counters:
  - Data Shape / API Contract
  - Type / Coercion
---

## What this solves

Untrusted input (dicts, JSON payloads, HTTP request bodies) that crosses a system boundary
without being parsed into a typed model produces cascading bugs: a missing field is
`None` instead of an error, a string `"42"` passes silently where an int was expected, and
validation happens scattered across the call stack rather than at the edge. Pydantic's
`BaseModel.__init__` enforces that input data is either fully validated into a typed
instance or raises a structured `ValidationError` with field-level error paths — there is
no half-valid state. The "parse, don't validate" discipline: validation is parsing, and
parsing produces a fully-typed result or a structured exception.

## Excerpt

```python
    def __init__(self, /, **data: Any) -> None:
        """Create a new model by parsing and validating input data from keyword arguments.

        Raises [`ValidationError`][pydantic_core.ValidationError] if the input data cannot be
        validated to form a valid model.

        `self` is explicitly positional-only to allow `self` as a field name.
        """
        # `__tracebackhide__` tells pytest and some other tools to omit this function from tracebacks
        __tracebackhide__ = True
        validated_self = self.__pydantic_validator__.validate_python(data, self_instance=self)
        if self is not validated_self:
            warnings.warn(
                'A custom validator is returning a value other than `self`.\n'
                "Returning anything other than `self` from a top level model validator isn't supported when validating via `__init__`.\n"
                'See the `model_validator` docs (https://docs.pydantic.dev/latest/concepts/validators/#model-validators) for more details.',
                stacklevel=2,
            )

    # The following line sets a flag that we use to determine when `__init__` gets overridden by the user
    __init__.__pydantic_base_init__ = True  # pyright: ignore[reportFunctionMemberAccess]
```

## Why it's good

- The contract is binary: either `__init__` returns a fully validated instance or it
  raises `ValidationError` — there is no "partially valid" model escape hatch.
- `__tracebackhide__ = True` suppresses the pydantic frame from pytest tracebacks, keeping
  test failure output pointing at the caller, not the framework internals — a deliberate
  DX decision that synthetic examples ignore.
- `__pydantic_validator__.validate_python` dispatches into pydantic-core (Rust); the thin
  Python `__init__` is the stable public boundary regardless of how many times the core
  implementation changes.
- The "validator returning non-self" warning targets a real class of bugs (model validators
  that accidentally return a dict instead of the model instance) — not hypothetical.

## What NOT to cargo-cult

- Pydantic v1 used `__init__` differently — `root_validators`, `validator` decorators, and
  the `parse_obj` classmethod (deprecated in v2). Do not mix v1 and v2 patterns; the v2
  `model_validate` classmethod (not `__init__`) is the preferred entry point for parsing
  untrusted dicts.
- `__pydantic_validator__` is a class var set by `ModelMetaclass` and not meant for direct
  use; reaching into it bypasses pydantic's configuration layer.
- The `self_instance=self` argument to `validate_python` is an in-place validation protocol
  specific to `BaseModel.__init__` — do not copy this call signature in subclass overrides
  without reading the validator contract.
