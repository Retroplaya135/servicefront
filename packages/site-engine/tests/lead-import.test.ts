import { describe, expect, test } from 'vitest';
import { deduplicateProspects } from '../src/deduplication.js';
import { CsvImportError, parseLeadCsv } from '../src/lead-import.js';

const requiredHeaders = 'external_id,business_name,phone,city,state,postal_code,time_zone,services,lead_score,source,source_captured_at';

describe('parseLeadCsv', () => {
  test('normalizes valid lead rows while preserving source values and evidence', () => {
    const csv = [
      requiredHeaders,
      'p-1,North Star Painting,(202) 555-0121,San Rafael,CA,94901,America/Los_Angeles,interior painter|cabinet painter,87,manual,2026-08-30T12:00:00.000Z',
    ].join('\n');

    const result = parseLeadCsv(csv);

    expect(result.rejected).toEqual([]);
    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0]).toMatchObject({
      rowNumber: 2,
      externalId: 'p-1',
      businessName: 'North Star Painting',
      phone: '+12025550121',
      originalPhone: '(202) 555-0121',
      services: ['interior painter', 'cabinet painter'],
      leadScore: 87,
      source: 'manual',
      sourceCapturedAt: '2026-08-30T12:00:00.000Z',
    });
    expect(result.accepted[0]?.facts.evidence).toContainEqual({
      id: 'row-2-phone',
      kind: 'lead_source',
      source: 'manual',
      capturedAt: '2026-08-30T12:00:00.000Z',
      notes: 'Imported phone: (202) 555-0121',
    });
  });

  test('reports row-level validation errors while preserving other valid rows', () => {
    const csv = [
      requiredHeaders,
      'bad-phone,Brush Crew,555,Berkeley,CA,94704,America/Los_Angeles,house painter,44,apollo,2026-08-30T12:00:00.000Z',
      'good,Good Co,+12025550199,Oakland,CA,94612,America/Los_Angeles,exterior painter,55,apollo,2026-08-30T12:00:00.000Z',
    ].join('\n');

    const result = parseLeadCsv(csv);

    expect(result.accepted.map((row) => row.externalId)).toEqual(['good']);
    expect(result.rejected).toEqual([
      {
        rowNumber: 2,
        code: 'INVALID_PHONE',
        message: 'phone must normalize to E.164',
        field: 'phone',
      },
    ]);
  });

  test('rejects missing required headers as a command-level import error', () => {
    const csv = [
      'external_id,business_name,phone,city,state,postal_code,time_zone,services,lead_score,source',
      'p-1,North Star Painting,+12025550121,San Rafael,CA,94901,America/Los_Angeles,interior painter,87,manual',
    ].join('\n');

    expect(() => parseLeadCsv(csv)).toThrow(CsvImportError);
  });

  test('accepts optional CSV columns by header name without requiring required headers to be a prefix', () => {
    const csv = [
      'email,website_condition,external_id,business_name,phone,city,state,postal_code,time_zone,services,lead_score,source,source_captured_at,owner_name',
      'avery@example.com,dated,p-1,North Star Painting,+12025550121,San Rafael,CA,94901,America/Los_Angeles,interior painter,87,manual,2026-08-30T12:00:00.000Z,Avery',
    ].join('\n');

    const result = parseLeadCsv(csv);

    expect(result.rejected).toEqual([]);
    expect(result.accepted[0]).toMatchObject({
      externalId: 'p-1',
      email: 'avery@example.com',
      ownerName: 'Avery',
      websiteCondition: 'dated',
    });
  });

  test('rejects malformed row widths before a partial row can be accepted', () => {
    const csv = [
      requiredHeaders,
      'p-1,North Star Painting,+12025550121,San Rafael,CA,94901,America/Los_Angeles,interior painter,87,manual',
    ].join('\n');

    expect(() => parseLeadCsv(csv)).toThrow(CsvImportError);
  });

  test('rejects CSV files beyond the bounded row limit', () => {
    const rows = [requiredHeaders];
    for (let index = 0; index < 2_001; index += 1) {
      rows.push(`p-${index},Painter ${index},+12025550100,Oakland,CA,94612,America/Los_Angeles,house painter,80,manual,2026-08-30T12:00:00.000Z`);
    }

    expect(() => parseLeadCsv(rows.join('\n'))).toThrow(CsvImportError);
  });

  test('rejects rows whose bounded fields would fail the site spec generator later', () => {
    const longBusinessName = 'A'.repeat(101);
    const tooManyServices = Array.from({ length: 13 }, (_, index) => `service ${index}`).join('|');
    const longSource = 's'.repeat(501);
    const csv = [
      requiredHeaders,
      `long-name,${longBusinessName},+12025550101,Oakland,CA,94612,America/Los_Angeles,house painter,80,manual,2026-08-30T12:00:00.000Z`,
      `too-many,Too Many Services,+12025550102,Oakland,CA,94612,America/Los_Angeles,${tooManyServices},80,manual,2026-08-30T12:00:00.000Z`,
      `long-source,Long Source,+12025550103,Oakland,CA,94612,America/Los_Angeles,house painter,80,${longSource},2026-08-30T12:00:00.000Z`,
    ].join('\n');

    const result = parseLeadCsv(csv);

    expect(result.accepted).toEqual([]);
    expect(result.rejected).toEqual([
      {
        rowNumber: 2,
        code: 'INVALID_BUSINESS_NAME',
        message: 'business_name must be 1 to 100 characters',
        field: 'business_name',
      },
      {
        rowNumber: 3,
        code: 'INVALID_SERVICES',
        message: 'services must contain 1 to 12 values',
        field: 'services',
      },
      {
        rowNumber: 4,
        code: 'INVALID_SOURCE',
        message: 'source must be 1 to 500 characters',
        field: 'source',
      },
    ]);
  });
});

describe('deduplicateProspects', () => {
  test('drops hard duplicates by phone before domain and leaves name-locality matches as advisory warnings', () => {
    const parsed = parseLeadCsv([
      `${requiredHeaders},website_url`,
      'a,North Star Painting,+12025550101,San Rafael,CA,94901,America/Los_Angeles,interior painter,90,manual,2026-08-30T12:00:00.000Z,https://northstar.example.com',
      'b,Other Name,+12025550101,San Rafael,CA,94901,America/Los_Angeles,interior painter,80,manual,2026-08-30T12:00:00.000Z,https://other.example.com',
      'c,Domain Twin,+12025550102,San Rafael,CA,94901,America/Los_Angeles,interior painter,70,manual,2026-08-30T12:00:00.000Z,https://www.northstar.example.com/jobs',
      'd,North Star Painting,+12025550103,San Rafael,CA,94901,America/Los_Angeles,deck staining,60,manual,2026-08-30T12:00:00.000Z,https://distinct.example.com',
    ].join('\n'));

    const result = deduplicateProspects(parsed.accepted);

    expect(result.accepted.map((row) => row.externalId)).toEqual(['a', 'd']);
    expect(result.rejected).toEqual([
      {
        rowNumber: 3,
        code: 'DUPLICATE_PHONE',
        message: 'duplicate normalized phone matches row 2',
        field: 'phone',
      },
      {
        rowNumber: 4,
        code: 'DUPLICATE_DOMAIN',
        message: 'duplicate normalized root domain matches row 2',
        field: 'website_url',
      },
    ]);
    expect(result.accepted[1]?.warnings).toEqual([
      {
        rowNumber: 5,
        code: 'ADVISORY_NAME_LOCALITY_DUPLICATE',
        message: 'business name and locality match row 2',
        field: 'business_name',
      },
    ]);
  });
});
