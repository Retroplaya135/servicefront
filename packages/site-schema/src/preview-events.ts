import { z } from 'zod';

export const previewEventTypes = [
  'preview_opened',
  'preview_unavailable',
  'preview_expired',
  'preview_revoked',
  'preview_version_updated',
] as const;

export const previewEventSources = [
  'private_preview_route',
  'demo_batch_cli',
  'operator_action',
] as const;

const pagePathPattern = /^\/(?:[a-z0-9-]+)?$/;
const PreviewEventPrivacySchema = z
  .object({
    rawTokenStored: z.literal(false),
    ipAddressStored: z.literal(false),
    prospectPiiStored: z.literal(false),
  })
  .strict();

export const PreviewEventSchema = z
  .object({
    schemaVersion: z.literal(1),
    eventType: z.enum(previewEventTypes),
    previewId: z.string().min(1).max(140),
    siteVersionId: z.string().min(1).max(140),
    occurredAt: z.iso.datetime(),
    source: z.enum(previewEventSources),
    pagePath: z.string().regex(pagePathPattern),
    privacy: PreviewEventPrivacySchema,
  })
  .strict();

export type PreviewEventType = (typeof previewEventTypes)[number];
export type PreviewEventSource = (typeof previewEventSources)[number];
export type PreviewEvent = z.infer<typeof PreviewEventSchema>;

export type CreatePreviewEventInput = {
  eventType: PreviewEventType;
  previewId: string;
  siteVersionId: string;
  occurredAt: string;
  source: PreviewEventSource;
  pagePath: string;
};

export function createPreviewEvent(input: CreatePreviewEventInput | PreviewEvent): PreviewEvent {
  if ('schemaVersion' in input) {
    return PreviewEventSchema.parse(input);
  }

  return PreviewEventSchema.parse({
    schemaVersion: 1,
    eventType: input.eventType,
    previewId: input.previewId,
    siteVersionId: input.siteVersionId,
    occurredAt: input.occurredAt,
    source: input.source,
    pagePath: input.pagePath,
    privacy: {
      rawTokenStored: false,
      ipAddressStored: false,
      prospectPiiStored: false,
    },
  });
}
