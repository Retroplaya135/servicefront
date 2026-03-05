import { describe, expect, test } from 'vitest';
import siteSchemaPackage from '../package.json' with { type: 'json' };
import siteSpecJsonSchema from '../../../schemas/site-spec.schema.json' with { type: 'json' };
import templateRecipeJsonSchema from '../../../schemas/template-recipe.schema.json' with { type: 'json' };
import {
  assertSiteSpecSchemaParity,
  assertTemplateRecipeSchemaParity,
  SiteSpecSchema,
  TemplateRecipeSchema,
} from '../src/index.js';
import { assertJsonSchemaValidationParity } from '../src/json-schema-parity.js';
import { minimalPaintingSiteFixture } from './fixtures.js';

type JsonObject = { [key: string]: JsonValue };
type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;
type PackageManifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const packageManifest: PackageManifest = siteSchemaPackage;

function cloneSchema(schema: JsonObject): JsonObject {
  return structuredClone(schema);
}

describe('SiteSpecSchema', () => {
  test('accepts the canonical trusted-local fixture', () => {
    expect(SiteSpecSchema.parse(minimalPaintingSiteFixture).schemaVersion).toBe(1);
  });

  test('rejects a non-E164 phone number', () => {
    const invalid = structuredClone(minimalPaintingSiteFixture);
    invalid.contact.phone = '(202) 555-0100';
    expect(() => SiteSpecSchema.parse(invalid)).toThrow();
  });

  test('rejects arbitrary component names', () => {
    const invalid = structuredClone(minimalPaintingSiteFixture);
    invalid.pages[0]!.sections[0]!.component = 'raw_html';
    expect(() => SiteSpecSchema.parse(invalid)).toThrow();
  });

  test('stays in parity with the repository JSON schema contract', () => {
    expect(() => assertSiteSpecSchemaParity(siteSpecJsonSchema)).not.toThrow();
  });

  test('detects site spec structural drift in nested constraints', () => {
    const mutations: Array<[string, (schema: JsonObject) => void]> = [
      [
        'services.maxItems',
        (schema) => {
          (schema.properties as JsonObject).services = {
            ...((schema.properties as JsonObject).services as JsonObject),
            maxItems: 13,
          };
        },
      ],
      [
        'services.required',
        (schema) => {
          const services = (schema.properties as JsonObject).services as JsonObject;
          const item = services.items as JsonObject;
          item.required = ['key', 'name', 'summary'];
        },
      ],
      [
        'contact.additionalProperties',
        (schema) => {
          ((schema.properties as JsonObject).contact as JsonObject).additionalProperties = true;
        },
      ],
      [
        'contact.email.format',
        (schema) => {
          const contact = (schema.properties as JsonObject).contact as JsonObject;
          const properties = contact.properties as JsonObject;
          delete (properties.email as JsonObject).format;
        },
      ],
      [
        'identity.displayName.maxLength',
        (schema) => {
          const identity = (schema.properties as JsonObject).identity as JsonObject;
          const properties = identity.properties as JsonObject;
          (properties.displayName as JsonObject).maxLength = 101;
        },
      ],
      [
        'trust.rating.maximum',
        (schema) => {
          const trust = (schema.properties as JsonObject).trust as JsonObject;
          const properties = trust.properties as JsonObject;
          (properties.rating as JsonObject).maximum = 6;
        },
      ],
    ];

    for (const [label, mutate] of mutations) {
      const mutated = cloneSchema(siteSpecJsonSchema);
      mutate(mutated);
      expect(() => assertSiteSpecSchemaParity(mutated), label).toThrow(/drifted|Missing|Unexpected/);
    }
  });
});

describe('TemplateRecipeSchema', () => {
  test('stays in parity with the repository JSON schema contract', () => {
    expect(() => assertTemplateRecipeSchemaParity(templateRecipeJsonSchema)).not.toThrow();
  });

  test('rejects unknown recipe keys', () => {
    const invalid = {
      schemaVersion: 1,
      key: 'painting-unknown',
      version: '1.0.0',
      niche: 'painting_contractor',
      status: 'active',
      pages: ['/'],
      componentVariants: {
        hero: ['trust_split'],
      },
      tokens: {
        fontHeading: 'Inter',
        fontBody: 'Inter',
        accentOptions: ['#244A3B'],
        radius: 'small',
        spacingDensity: 'balanced',
      },
      editPolicy: {
        ownerAllowedPaths: [],
        staffAllowedPaths: [],
        forbiddenPaths: [],
      },
    };

    expect(() => TemplateRecipeSchema.parse(invalid)).toThrow();
  });
});

describe('package boundaries', () => {
  test('keeps test-utils out of the site-schema package graph', () => {
    expect(packageManifest.dependencies ?? {}).not.toHaveProperty('@servicefront/test-utils');
    expect(packageManifest.devDependencies ?? {}).not.toHaveProperty('@servicefront/test-utils');
  });
});

describe('JSON schema parity walker', () => {
  const baseObjectSchema = {
    type: 'object',
    properties: {
      name: {
        type: 'string',
      },
    },
  };

  test('rejects an unexpected generated enum', () => {
    expect(() =>
      assertJsonSchemaValidationParity(
        { type: 'string' },
        {
          type: 'string',
          enum: ['unexpected'],
        },
      ),
    ).toThrow(/enum.*unexpected/i);
  });

  test('rejects unexpected generated required keys', () => {
    expect(() =>
      assertJsonSchemaValidationParity(baseObjectSchema, {
        ...baseObjectSchema,
        required: ['name'],
      }),
    ).toThrow(/required.*unexpected/i);
  });

  test('rejects unexpected generated array items', () => {
    expect(() =>
      assertJsonSchemaValidationParity(
        { type: 'array' },
        {
          type: 'array',
          items: {
            type: 'string',
          },
        },
      ),
    ).toThrow(/items.*unexpected/i);
  });

  test('rejects unexpected generated properties', () => {
    expect(() =>
      assertJsonSchemaValidationParity(
        { type: 'object' },
        {
          type: 'object',
          properties: {
            name: {
              type: 'string',
            },
          },
        },
      ),
    ).toThrow(/properties.*unexpected/i);
  });

  test('rejects unexpected generated additionalProperties', () => {
    expect(() =>
      assertJsonSchemaValidationParity(baseObjectSchema, {
        ...baseObjectSchema,
        additionalProperties: false,
      }),
    ).toThrow(/additionalProperties.*unexpected/i);
  });
});
