# Contributing

Open an issue before changing a public contract or recipe-selection rule. Small fixes may be submitted directly with a focused explanation and tests.

## Local checks

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm verify
```

Changes to a runtime schema must update its JSON Schema parity fixture. Changes to deterministic generation must prove identical output for identical inputs. Use only synthetic identities, reserved domains, and `+1-202-555-01xx` telephone numbers in tests and examples.

Do not add customer data, deployment credentials, generated build output, or dependencies without a documented need.
