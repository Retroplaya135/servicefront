<div align="center">
  <img src="docs/cover.png" alt="Servicefront" width="100%">
  <p><strong>Validated website specifications from structured service-business evidence.</strong></p>
  <p>
    <a href="#why-servicefront">Why</a> ·
    <a href="#system-boundary">System boundary</a> ·
    <a href="#quick-start">Quick start</a> ·
    <a href="#verification">Verification</a> ·
    <a href="#project-boundaries">Boundaries</a>
  </p>
  <p>
    <img alt="Status: pre-1.0 specification engine" src="https://img.shields.io/badge/status-pre--1.0_spec_engine-64748b">
    <img alt="Node.js 24 or newer" src="https://img.shields.io/badge/node-24%2B-339933">
    <img alt="pnpm 11.17" src="https://img.shields.io/badge/pnpm-11.17-F69220">
    <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-16a34a">
  </p>
</div>

Servicefront is a TypeScript workspace that turns structured painting-contractor facts into a validated website specification. It normalizes services, deduplicates prospect data, selects a template recipe, and produces page, section, theme, media, and provenance records for a separate renderer.

Servicefront is for teams building repeatable website workflows that need content decisions to remain inspectable before a page is rendered or deployed. The current domain model stays specific to painting contractors instead of claiming support for every local-business category.

## Why Servicefront

Template-driven site production becomes hard to review when lead cleanup, service naming, content selection, page structure, styling, and asset choices happen inside one renderer. A finished page may look coherent while still containing duplicated prospects, unsupported claims, inconsistent services, or media that cannot be traced to an approved source.

Servicefront moves those decisions into a typed specification. Inputs are normalized first. A recipe defines the permitted structure. Evidence references stay attached to the resulting content model. The output is validated before a renderer, CMS, or deployment system sees it.

That boundary helps teams:

- review facts and content structure before design work begins;
- generate several site variants from one stable contract;
- snapshot and compare specification changes without visual noise;
- keep private assets, booking links, and client identifiers out of reusable tooling.

## System boundary

## What it produces

| Output | Role |
| --- | --- |
| Site specification | One validated object describing pages, sections, theme, calls to action, and metadata |
| Normalized services | Canonical service records derived from inconsistent prospect inputs |
| Template recipe | A selected structural pattern with explicit page and section rules |
| Evidence references | Links each generated claim or choice to the supplied basis |
| Media placeholders | Reserved identifiers that a private asset workflow can resolve later |
| Private-preview policy | Disables search indexing until facts, copy, and assets are approved |

The specification is the handoff boundary. Rendering, hosting, content management, and deployment can change without mixing those concerns into fact normalization or recipe selection.

## Generation pipeline

`generateDeterministicSiteSpec` in `packages/site-engine` accepts prospect facts, evidence, a timestamp, an ID factory, and fallback media identifiers. The engine normalizes the inputs, chooses a recipe unless one is explicitly provided, assembles the specification, and validates the result through `SiteSpecSchema`.

Reproducible output requires the same source facts, evidence, timestamp, and ID behavior. That makes a generated specification suitable for review and snapshot testing before it enters a renderer.

The workspace also exposes CSV lead parsing, prospect deduplication, service normalization, a template registry, and test utilities. The contracts are described in:

- [Architecture](docs/architecture.md)
- [Site specification](docs/site-specification.md)
- [Template recipes](docs/template-recipes.md)

## Implemented capabilities

### Contracts and validation

- TypeScript and JSON Schema definitions for site specifications and template recipes.
- Runtime validation for pages, sections, calls to action, theme values, metadata, preview state, and evidence references.
- Parity checks that keep exported JSON schemas aligned with the TypeScript contracts.
- Preview-state and preview-event contracts for a separate review surface.

### Input preparation

- CSV lead parsing into typed prospect facts.
- Deduplication for repeated prospect records.
- Painting-service normalization from inconsistent source labels.
- Evidence-support helpers that keep generated statements tied to supplied material.

### Deterministic assembly

- Three painting-specific recipes: trusted local, gallery first, and premium.
- Explicit recipe selection with a deterministic fallback when none is supplied.
- Stable generation when source facts, evidence, timestamp, ID factory, and media placeholders are unchanged.
- Synthetic examples for each recipe and test utilities for contract-level fixtures.

## Quick start

Servicefront requires Node.js 24 or newer and Corepack. The workspace pins pnpm 11.17.0.

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm first-result
```

`first-result` inspects a bundled synthetic specification and prints its business name, selected recipe, and service, page, and evidence counts. It does not generate or publish a live site.

The three examples under `examples/` show different fact and recipe combinations without including a real business identity or asset library.

## Practical usage

Start with the synthetic examples to understand the contract before connecting a private input pipeline. Each example is a complete site specification and can be inspected without running a web server.

In a production-shaped workflow, a private adapter would map approved business facts into the public prospect contract, supply licensed media identifiers, and call the deterministic generator. The resulting specification should then pass editorial and asset review before a separate renderer turns it into a website.

The recipe registry is deliberately small. Add a recipe only when its layout and content rules represent a real repeatable pattern; do not use recipes as a place to hide one-client exceptions. Domain expansion should begin with service and content contracts for the new category, followed by fixtures and validation tests.

## Verification

```bash
corepack pnpm verify
```

The verification command runs repository source checks, TypeScript validation, package tests, builds, and example inspection. Tests cover schemas, deterministic generation, evidence references, service normalization, deduplication, recipe selection, and invalid inputs.

## Repository map

| Path | Responsibility |
| --- | --- |
| `packages/site-schema` | Site, recipe, preview, and JSON Schema contracts |
| `packages/site-engine` | Lead parsing, deduplication, service normalization, recipe selection, and deterministic generation |
| `packages/template-registry` | Painting-specific template recipes and registry behavior |
| `packages/test-utils` | Synthetic fixtures shared by package tests |
| `schemas/` | Exported JSON schemas for non-TypeScript consumers |
| `examples/` | Complete synthetic site specifications for the three recipes |
| `tools/` | Candidate checks and the first-result inspector |
| `docs/` | Architecture, specification, and recipe references |

## Project boundaries

Servicefront is a pre-1.0 specification engine. It does not include a renderer, CMS, database, asset pipeline, booking integration, analytics setup, or deployment service. This is deliberate: the public boundary ends where a validated, reviewable site specification is ready for those systems.

Generated copy remains in private-preview mode. Placeholder media uses reserved URLs and must be replaced with licensed assets before publication. Evidence references preserve the supplied basis for content but do not independently verify a business claim or a media license.

Keep real business facts, booking URLs, analytics identifiers, and media in a private input layer. Operational expectations are documented in [SUPPORT.md](SUPPORT.md); security and contribution guidance are in [SECURITY.md](SECURITY.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

The public output is a contract, not a claim that a generated site is ready to publish. Editorial approval, accessibility review, licensed assets, legal pages, analytics consent, deployment policy, and final business verification remain downstream responsibilities.

## Documentation and support

- [Architecture](docs/architecture.md) — package boundaries and deterministic generation flow.
- [Site specification](docs/site-specification.md) — field-level contract and evidence model.
- [Template recipes](docs/template-recipes.md) — structural patterns and recipe-selection behavior.
- [Support](SUPPORT.md) — supported scope and operational expectations.
- [Contributing](CONTRIBUTING.md) — contract, fixture, and test requirements.
- [Security](SECURITY.md) — reporting and private-input boundaries.

## Contributing, security, and license

Changes to schemas, normalization, recipes, or evidence behavior should include focused fixtures and tests. Keep client identities, real booking URLs, analytics identifiers, credentials, and licensed media out of issues and pull requests.

Report schema bypasses, unsafe parsing, evidence loss, or accidental private-data exposure through GitHub's private security-advisory channel.

Servicefront is available under the [MIT License](LICENSE).
