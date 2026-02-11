import { toJSONSchema, z } from 'zod';
import { assertJsonSchemaValidationParity } from './json-schema-parity.js';
import { businessTypes, templateKeys } from './site-spec.js';

const semverPattern = '^[0-9]+\\.[0-9]+\\.[0-9]+$';
const pagePathPattern = '^/(?:[a-z0-9-]+)?$';
const hexColorPattern = '^#[0-9A-Fa-f]{6}$';

const semver = new RegExp(semverPattern);
const pagePath = new RegExp(pagePathPattern);
const hexColor = new RegExp(hexColorPattern);

export const templateStatuses = ['draft', 'canary', 'active', 'deprecated'] as const;
export const tokenRadii = ['none', 'small', 'medium', 'large'] as const;
export const spacingDensities = ['compact', 'balanced', 'spacious'] as const;
export const motionLevels = ['none', 'restrained', 'expressive'] as const;
export const publishRiskLevels = ['low', 'medium', 'high'] as const;

export const TemplateRecipeSchema = z
  .object({
    schemaVersion: z.literal(1),
    key: z.enum(templateKeys),
    version: z.string().regex(semver),
    niche: z.literal(businessTypes[0]),
    status: z.enum(templateStatuses),
    displayName: z.string().max(100).optional(),
    description: z.string().max(500).optional(),
    pages: z.array(z.string().regex(pagePath)).min(1),
    componentVariants: z.record(z.string(), z.array(z.string()).min(1)),
    tokens: z
      .object({
        fontHeading: z.string(),
        fontBody: z.string(),
        accentOptions: z.array(z.string().regex(hexColor)).min(1).max(12),
        radius: z.enum(tokenRadii),
        spacingDensity: z.enum(spacingDensities),
        motion: z.enum(motionLevels).optional(),
      })
      .strict(),
    editPolicy: z
      .object({
        ownerAllowedPaths: z.array(z.string()),
        staffAllowedPaths: z.array(z.string()),
        forbiddenPaths: z.array(z.string()),
        ownerPublishRisk: z.record(z.string(), z.enum(publishRiskLevels)).optional(),
      })
      .strict(),
    fallbackMediaPack: z.string().max(100).optional(),
    engineCompatibility: z.string().max(40).optional(),
  })
  .strict();

export type TemplateRecipe = z.infer<typeof TemplateRecipeSchema>;

export function assertTemplateRecipeSchemaParity(schema: unknown): void {
  assertJsonSchemaValidationParity(schema, toJSONSchema(TemplateRecipeSchema));
}
