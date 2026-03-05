import { toJSONSchema, z } from 'zod';
import { assertJsonSchemaValidationParity } from './json-schema-parity.js';

const e164Pattern = '^\\+[1-9][0-9]{7,14}$';
const hhmmPattern = '^[0-2][0-9]:[0-5][0-9]$';
const serviceKeyPattern = '^[a-z0-9_]+$';
const pagePathPattern = '^/(?:[a-z0-9-]+)?$';
const servicePagePathPattern = '^/[a-z0-9-]+$';
const sectionIdPattern = '^[a-z0-9_-]+$';
const hexColorPattern = '^#[0-9A-Fa-f]{6}$';
const uuidPattern = '^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$';

const e164 = new RegExp(e164Pattern);
const hhmm = new RegExp(hhmmPattern);
const serviceKey = new RegExp(serviceKeyPattern);
const pagePath = new RegExp(pagePathPattern);
const servicePagePath = new RegExp(servicePagePathPattern);
const sectionId = new RegExp(sectionIdPattern);
const hexColor = new RegExp(hexColorPattern);
const uuid = new RegExp(uuidPattern);
const uuidSchema = z.stringFormat('uuid', uuid);

export const businessTypes = ['painting_contractor'] as const;
export const primaryCtas = ['request_estimate', 'call_now', 'get_quote'] as const;
export const days = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;
export const testimonialSourceTypes = ['client_supplied', 'public_review', 'fictional_demo'] as const;
export const mediaRoles = ['logo', 'hero', 'project', 'service', 'team', 'background'] as const;
export const mediaRightsStatuses = ['client_owned', 'licensed', 'generated', 'unknown'] as const;
export const pageSectionComponents = [
  'hero',
  'trust_bar',
  'service_grid',
  'before_after',
  'project_gallery',
  'review_wall',
  'process',
  'about_story',
  'service_areas',
  'faq',
  'estimate_form',
  'final_cta',
] as const;
export const templateKeys = [
  'painting-premium',
  'painting-trusted-local',
  'painting-gallery-first',
] as const;
export const themeTones = ['light', 'balanced', 'dark'] as const;
export const robotPolicies = ['noindex,nofollow,noarchive', 'index,follow'] as const;
export const generationModes = [
  'deterministic',
  'ai_enriched',
  'operator',
  'owner',
  'fictional_demo',
] as const;
export const evidenceKinds = [
  'lead_source',
  'website',
  'public_profile',
  'client_confirmation',
  'client_asset',
  'licensed_asset',
  'generated_asset',
  'operator_note',
] as const;

export const SiteSpecSchema = z
  .object({
    schemaVersion: z.literal(1),
    identity: z
      .object({
        displayName: z.string().min(1).max(100),
        legalName: z.string().min(1).max(140).optional(),
        businessType: z.enum(businessTypes),
        tagline: z.string().max(160).optional(),
        city: z.string().min(1).max(80),
        state: z.string().min(2).max(40),
        postalCode: z.string().max(16).optional(),
        logoAssetId: uuidSchema.optional(),
        textWordmark: z.boolean().default(true).optional(),
      })
      .strict(),
    contact: z
      .object({
        phone: z.string().regex(e164),
        displayPhone: z.string().max(30).optional(),
        email: z.email().optional(),
        primaryCta: z.enum(primaryCtas),
        hours: z
          .array(
            z
              .object({
                day: z.enum(days),
                closed: z.boolean(),
                opens: z.string().regex(hhmm).optional(),
                closes: z.string().regex(hhmm).optional(),
              })
              .strict(),
          )
          .max(7)
          .optional(),
      })
      .strict(),
    services: z
      .array(
        z
          .object({
            key: z.string().regex(serviceKey).max(50),
            name: z.string().min(1).max(80),
            summary: z.string().min(20).max(300),
            body: z.string().max(2400).optional(),
            enabled: z.boolean(),
            imageAssetId: uuidSchema.optional(),
            pagePath: z.string().regex(servicePagePath).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(12),
    serviceAreas: z.array(z.string().min(1).max(100)).max(40).optional(),
    trust: z
      .object({
        rating: z.number().min(1).max(5).optional(),
        reviewCount: z.int().min(0).max(1_000_000).optional(),
        licensed: z.boolean().optional(),
        insured: z.boolean().optional(),
        yearsInBusiness: z.int().min(0).max(200).optional(),
        guarantees: z.array(z.string().max(180)).max(8).optional(),
      })
      .strict()
      .optional(),
    testimonials: z
      .array(
        z
          .object({
            quote: z.string().min(10).max(600),
            name: z.string().max(100).optional(),
            sourceType: z.enum(testimonialSourceTypes),
            sourceUrl: z.url().optional(),
            sourceCapturedAt: z.iso.datetime().optional(),
          })
          .strict(),
      )
      .max(20)
      .optional(),
    media: z
      .array(
        z
          .object({
            assetId: uuidSchema,
            role: z.enum(mediaRoles),
            alt: z.string().max(300).optional(),
            rightsStatus: z.enum(mediaRightsStatuses),
            sourceUrl: z.url().optional(),
            placeholder: z.boolean(),
            focalX: z.number().min(0).max(1).optional(),
            focalY: z.number().min(0).max(1).optional(),
          })
          .strict(),
      )
      .max(80)
      .optional(),
    pages: z
      .array(
        z
          .object({
            path: z.string().regex(pagePath),
            title: z.string().min(1).max(120),
            enabled: z.boolean(),
            sections: z
              .array(
                z
                  .object({
                    id: z.string().regex(sectionId),
                    component: z.enum(pageSectionComponents),
                    variant: z.string().min(1).max(50),
                    enabled: z.boolean(),
                    headline: z.string().max(160).optional(),
                    body: z.string().max(1800).optional(),
                    dataKey: z.string().max(80).optional(),
                  })
                  .strict(),
              )
              .min(1)
              .max(24),
          })
          .strict(),
      )
      .min(1)
      .max(12),
    theme: z
      .object({
        recipeKey: z.enum(templateKeys),
        accent: z.string().regex(hexColor),
        tone: z.enum(themeTones),
        heroVariant: z.string().max(50).optional(),
        galleryVariant: z.string().max(50).optional(),
      })
      .strict(),
    seo: z
      .object({
        siteTitle: z.string().min(10).max(70),
        defaultDescription: z.string().min(50).max(170),
        canonicalBaseUrl: z.url().optional(),
        robots: z.enum(robotPolicies),
        structuredDataEnabled: z.boolean().default(true).optional(),
      })
      .strict(),
    forms: z
      .object({
        estimateFormEnabled: z.boolean(),
        formDefinitionId: uuidSchema.optional(),
        successMessage: z.string().max(300),
        privacyNotice: z.string().max(500).optional(),
      })
      .strict(),
    provenance: z
      .object({
        generatedAt: z.iso.datetime(),
        generationMode: z.enum(generationModes),
        evidence: z
          .array(
            z
              .object({
                id: z.string().min(1).max(100),
                kind: z.enum(evidenceKinds),
                source: z.string().max(500),
                capturedAt: z.iso.datetime(),
                notes: z.string().max(800).optional(),
              })
              .strict(),
          )
          .max(200),
      })
      .strict(),
  })
  .strict();

export type SiteSpec = z.infer<typeof SiteSpecSchema>;

export function assertSiteSpecSchemaParity(schema: unknown): void {
  assertJsonSchemaValidationParity(schema, toJSONSchema(SiteSpecSchema));
}
