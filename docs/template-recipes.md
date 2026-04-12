# Template recipes

A template recipe describes presentation choices without embedding business facts. Each recipe declares:

- a stable key and version;
- supported business types;
- required and optional page sections;
- theme defaults and allowed variants;
- evidence and media expectations;
- release status.

The registry returns structured clones so callers cannot mutate the shared recipe definitions.

The registry includes three painting-service recipes:

- `painting-trusted-local` for a trust-led default;
- `painting-gallery-first` when supported project media is available;
- `painting-premium` when services, evidence, and presentation signals support a higher-detail treatment.

Recipe selection is deterministic. If premium and gallery scores do not produce a unique positive winner, the engine selects the trusted-local recipe.
