import { describe, expect, test } from 'vitest';
import {
  PreviewEventSchema,
  createPreviewEvent,
  previewEventTypes,
} from '../src/preview-events.js';

describe('preview event contract', () => {
  test('creates a versioned safe preview opened event without raw token or prospect PII', () => {
    const event = createPreviewEvent({
      eventType: 'preview_opened',
      previewId: 'preview-123',
      siteVersionId: 'version-1',
      occurredAt: '2026-08-30T18:00:00.000Z',
      source: 'private_preview_route',
      pagePath: '/',
      metadata: {
        rawToken: 'this-raw-token-must-not-survive',
        previewUrl: 'https://preview.example.invalid/p/secret-token',
        ipAddress: '203.0.113.7',
        businessName: 'Northstar Painting',
        note: 'safe aggregate context',
      },
    } as Parameters<typeof createPreviewEvent>[0]);

    expect(event).toEqual({
      schemaVersion: 1,
      eventType: 'preview_opened',
      previewId: 'preview-123',
      siteVersionId: 'version-1',
      occurredAt: '2026-08-30T18:00:00.000Z',
      source: 'private_preview_route',
      pagePath: '/',
      privacy: {
        rawTokenStored: false,
        ipAddressStored: false,
        prospectPiiStored: false,
      },
    });
    expect(JSON.stringify(event)).not.toMatch(/raw-token|secret-token|203\.0\.113\.7|Northstar Painting|\/p\//);
    expect(PreviewEventSchema.parse(event)).toEqual(event);
  });

  test('strict-rejects event payloads that persist free-form metadata', () => {
    const unsafe = {
      schemaVersion: 1,
      eventType: 'preview_opened',
      previewId: 'preview-123',
      siteVersionId: 'version-1',
      occurredAt: '2026-08-30T18:00:00.000Z',
      source: 'private_preview_route',
      pagePath: '/',
      privacy: {
        rawTokenStored: false,
        ipAddressStored: false,
        prospectPiiStored: false,
      },
      metadata: {
        previewUrl: 'https://preview.example.invalid/p/secret-token',
        ipAddress: '203.0.113.7',
        businessName: 'Northstar Painting',
      },
    };

    expect(() => PreviewEventSchema.parse(unsafe)).toThrow(/unrecognized/i);
  });

  test('drops prospect PII metadata even when callers use common aliases', () => {
    const event = createPreviewEvent({
      eventType: 'preview_opened',
      previewId: 'preview-123',
      siteVersionId: 'version-1',
      occurredAt: '2026-08-30T18:00:00.000Z',
      source: 'private_preview_route',
      pagePath: '/',
      metadata: {
        company: 'Northstar Painting',
        owner: 'Jane Owner',
        contact: 'Jane Owner',
        telephone: '(202) 555-0101',
        street: '123 Main St',
        city: 'Menifee',
        note: 'safe aggregate context',
      },
    } as Parameters<typeof createPreviewEvent>[0]);

    expect(event).not.toHaveProperty('metadata');
    expect(JSON.stringify(event)).not.toMatch(/Northstar|Jane Owner|555-0101|123 Main St|Menifee/);
  });

  test('declares the Release 0 event vocabulary explicitly', () => {
    expect(previewEventTypes).toEqual([
      'preview_opened',
      'preview_unavailable',
      'preview_expired',
      'preview_revoked',
      'preview_version_updated',
    ]);
  });

  test('keeps the public schema import usable without request runtime helpers', () => {
    expect(createPreviewEvent({
      eventType: 'preview_opened',
      previewId: 'preview-123',
      siteVersionId: 'version-1',
      occurredAt: '2026-08-30T18:00:00.000Z',
      source: 'private_preview_route',
      pagePath: '/',
    }).privacy).toEqual({
      rawTokenStored: false,
      ipAddressStored: false,
      prospectPiiStored: false,
    });
  });
});
