# Architecture

Servicefront is split into four workspace packages:

- `site-schema` owns runtime validation, static types, preview-state rules, and JSON Schema parity checks.
- `template-registry` owns immutable, validated presentation recipes.
- `site-engine` owns input parsing, deduplication, evidence checks, recipe selection, and deterministic site-specification generation.
- `test-utils` owns synthetic fixtures shared by registry tests.

The registry depends on the schema package, and the engine depends on both. Test utilities supply fixtures for registry tests.

The engine accepts facts plus an explicit timestamp and identifier factory. Time and identifier creation stay outside the generator, which makes repeated runs reproducible.

Applications supply rendering, persistence, deployment, and business assets.
