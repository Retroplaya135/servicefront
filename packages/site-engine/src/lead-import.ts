import { parse as parseCsv } from 'csv-parse/sync';
import type { ProspectFacts, WebsiteCondition } from './prospect-facts.js';

const requiredHeaders = [
  'external_id',
  'business_name',
  'phone',
  'city',
  'state',
  'postal_code',
  'time_zone',
  'services',
  'lead_score',
  'source',
  'source_captured_at',
] as const;

const optionalHeaders = [
  'email',
  'owner_name',
  'website_url',
  'website_condition',
  'rating',
  'review_count',
  'latest_review_at',
  'logo_url',
  'image_urls',
  'notes',
] as const;

const allHeaders = new Set<string>([...requiredHeaders, ...optionalHeaders]);
const websiteConditions = new Set<WebsiteCondition>(['none', 'broken', 'dated', 'acceptable', 'strong']);
const maxInputBytes = 3 * 1024 * 1024;
const maxRows = 2_000;
const maxRecordSize = 8 * 1024;

export type LeadImportRow = {
  rowNumber: number;
  externalId: string;
  businessName: string;
  phone: string;
  originalPhone: string;
  city: string;
  state: string;
  postalCode: string;
  timeZone: string;
  services: string[];
  leadScore: number;
  source: string;
  sourceCapturedAt: string;
  email?: string;
  ownerName?: string;
  websiteUrl?: string;
  normalizedRootDomain?: string;
  websiteCondition?: WebsiteCondition;
  rating?: number;
  reviewCount?: number;
  latestReviewAt?: string;
  logoUrl?: string;
  imageUrls?: string[];
  notes?: string;
  facts: ProspectFacts;
  warnings?: LeadRowIssue[];
};

export type LeadRowIssue = {
  rowNumber: number;
  code: string;
  message: string;
  field?: string;
};

export type LeadImportResult = {
  accepted: LeadImportRow[];
  rejected: LeadRowIssue[];
};

type RawLeadRecord = Record<string, string | undefined>;

export class CsvImportError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'CsvImportError';
  }
}

export function parseLeadCsv(input: string | Uint8Array): LeadImportResult {
  assertInputSize(input);

  let rows: RawLeadRecord[];
  let parsedHeaders: string[] | undefined;
  try {
    rows = parseCsv(input, {
      bom: true,
      columns: (headers: string[]) => {
        parsedHeaders = headers;
        assertHeaders(headers);
        return headers;
      },
      skip_empty_lines: true,
      trim: true,
      max_record_size: maxRecordSize,
    }) as RawLeadRecord[];
  } catch (error) {
    if (error instanceof CsvImportError) throw error;
    throw new CsvImportError('CSV_PARSE_ERROR', error instanceof Error ? error.message : 'CSV could not be parsed');
  }

  if (!parsedHeaders) {
    throw new CsvImportError('EMPTY_CSV', 'CSV must include a header row');
  }

  if (rows.length > maxRows) {
    throw new CsvImportError('TOO_MANY_ROWS', `CSV exceeds ${maxRows} data rows`);
  }

  const accepted: LeadImportRow[] = [];
  const rejected: LeadRowIssue[] = [];

  rows.forEach((record, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const parsed = parseRecord(record, rowNumber);

    if ('issue' in parsed) {
      rejected.push(parsed.issue);
    } else {
      accepted.push(parsed.row);
    }
  });

  return { accepted, rejected };
}

function assertInputSize(input: string | Uint8Array): void {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input).byteLength : input.byteLength;
  if (bytes > maxInputBytes) {
    throw new CsvImportError('CSV_TOO_LARGE', `CSV exceeds ${maxInputBytes} bytes`);
  }
}

function assertHeaders(headers: readonly string[]): void {
  const duplicate = firstDuplicate(headers);
  if (duplicate) {
    throw new CsvImportError('DUPLICATE_HEADER', `CSV header contains duplicate column: ${duplicate}`);
  }

  const missing = requiredHeaders.find((header) => !headers.includes(header));
  if (missing) {
    throw new CsvImportError('INVALID_HEADERS', `CSV required headers must include: ${requiredHeaders.join(',')}`);
  }

  const unknown = headers.find((header) => !allHeaders.has(header));
  if (unknown) {
    throw new CsvImportError('UNKNOWN_HEADER', `CSV header contains unsupported column: ${unknown}`);
  }
}

function parseRecord(record: RawLeadRecord, rowNumber: number): { row: LeadImportRow } | { issue: LeadRowIssue } {
  const requiredIssue = firstMissingRequired(record, rowNumber);
  if (requiredIssue) return { issue: requiredIssue };

  const businessName = value(record, 'business_name');
  if (businessName.length > 100) {
    return { issue: { rowNumber, code: 'INVALID_BUSINESS_NAME', message: 'business_name must be 1 to 100 characters', field: 'business_name' } };
  }

  const city = value(record, 'city');
  if (city.length > 80) {
    return { issue: { rowNumber, code: 'INVALID_CITY', message: 'city must be 1 to 80 characters', field: 'city' } };
  }

  const state = value(record, 'state');
  if (state.length < 2 || state.length > 40) {
    return { issue: { rowNumber, code: 'INVALID_STATE', message: 'state must be 2 to 40 characters', field: 'state' } };
  }

  const postalCode = value(record, 'postal_code');
  if (postalCode.length > 16) {
    return { issue: { rowNumber, code: 'INVALID_POSTAL_CODE', message: 'postal_code must be at most 16 characters', field: 'postal_code' } };
  }

  const phone = normalizePhone(value(record, 'phone'));
  if (!phone) {
    return { issue: { rowNumber, code: 'INVALID_PHONE', message: 'phone must normalize to E.164', field: 'phone' } };
  }

  const timeZone = value(record, 'time_zone');
  if (!isValidTimeZone(timeZone)) {
    return { issue: { rowNumber, code: 'INVALID_TIME_ZONE', message: 'time_zone must be an IANA time zone', field: 'time_zone' } };
  }

  const services = splitPipeList(value(record, 'services'));
  if (services.length === 0 || services.length > 12) {
    return { issue: { rowNumber, code: 'INVALID_SERVICES', message: 'services must contain 1 to 12 values', field: 'services' } };
  }

  if (services.some((service) => service.length > 60)) {
    return { issue: { rowNumber, code: 'INVALID_SERVICES', message: 'services must be at most 60 characters each', field: 'services' } };
  }

  const leadScore = parseNumber(value(record, 'lead_score'));
  if (leadScore === undefined || leadScore < 0 || leadScore > 100) {
    return { issue: { rowNumber, code: 'INVALID_LEAD_SCORE', message: 'lead_score must be a number from 0 to 100', field: 'lead_score' } };
  }

  const sourceCapturedAt = normalizeIsoTimestamp(value(record, 'source_captured_at'));
  if (!sourceCapturedAt) {
    return { issue: { rowNumber, code: 'INVALID_SOURCE_CAPTURED_AT', message: 'source_captured_at must be an ISO timestamp', field: 'source_captured_at' } };
  }

  const optional = parseOptional(record, rowNumber);
  if ('issue' in optional) return { issue: optional.issue };

  const source = value(record, 'source');
  if (source.length > 500) {
    return { issue: { rowNumber, code: 'INVALID_SOURCE', message: 'source must be 1 to 500 characters', field: 'source' } };
  }
  const originalPhone = value(record, 'phone');
  const evidence = [
    {
      id: `row-${rowNumber}-source`,
      kind: 'lead_source' as const,
      source,
      capturedAt: sourceCapturedAt,
      notes: `Imported prospect row ${rowNumber} from ${source}.`,
    },
    {
      id: `row-${rowNumber}-phone`,
      kind: 'lead_source' as const,
      source,
      capturedAt: sourceCapturedAt,
      notes: `Imported phone: ${originalPhone}`.slice(0, 800),
    },
  ];

  const facts: ProspectFacts = {
    businessName,
    phone,
    city,
    state,
    postalCode,
    services,
    evidence,
    ...(optional.email ? { email: optional.email } : {}),
    ...(optional.ownerName ? { ownerName: optional.ownerName } : {}),
    ...(optional.websiteUrl ? { websiteUrl: optional.websiteUrl } : {}),
    ...(optional.websiteCondition ? { websiteCondition: optional.websiteCondition } : {}),
    ...(optional.rating !== undefined ? { rating: optional.rating } : {}),
    ...(optional.reviewCount !== undefined ? { reviewCount: optional.reviewCount } : {}),
    ...(optional.latestReviewAt ? { latestReviewAt: optional.latestReviewAt } : {}),
    ...(optional.imageUrls ? { imageUrls: optional.imageUrls } : {}),
    ...(optional.notes ? { notes: optional.notes } : {}),
  };

  return {
    row: {
      rowNumber,
      externalId: value(record, 'external_id'),
      businessName,
      phone,
      originalPhone,
      city,
      state,
      postalCode,
      timeZone,
      services,
      leadScore,
      source,
      sourceCapturedAt,
      facts,
      ...(optional.email ? { email: optional.email } : {}),
      ...(optional.ownerName ? { ownerName: optional.ownerName } : {}),
      ...(optional.websiteUrl ? { websiteUrl: optional.websiteUrl } : {}),
      ...(optional.normalizedRootDomain ? { normalizedRootDomain: optional.normalizedRootDomain } : {}),
      ...(optional.websiteCondition ? { websiteCondition: optional.websiteCondition } : {}),
      ...(optional.rating !== undefined ? { rating: optional.rating } : {}),
      ...(optional.reviewCount !== undefined ? { reviewCount: optional.reviewCount } : {}),
      ...(optional.latestReviewAt ? { latestReviewAt: optional.latestReviewAt } : {}),
      ...(optional.logoUrl ? { logoUrl: optional.logoUrl } : {}),
      ...(optional.imageUrls ? { imageUrls: optional.imageUrls } : {}),
      ...(optional.notes ? { notes: optional.notes } : {}),
    },
  };
}

function parseOptional(record: RawLeadRecord, rowNumber: number):
  | {
    email?: string;
    ownerName?: string;
    websiteUrl?: string;
    normalizedRootDomain?: string;
    websiteCondition?: WebsiteCondition;
    rating?: number;
    reviewCount?: number;
    latestReviewAt?: string;
    logoUrl?: string;
    imageUrls?: string[];
    notes?: string;
  }
  | { issue: LeadRowIssue } {
  const email = optionalValue(record, 'email');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { issue: { rowNumber, code: 'INVALID_EMAIL', message: 'email must be valid', field: 'email' } };
  }

  const websiteUrl = optionalValue(record, 'website_url');
  const normalizedWebsite = websiteUrl ? normalizeUrl(websiteUrl) : undefined;
  if (websiteUrl && !normalizedWebsite) {
    return { issue: { rowNumber, code: 'INVALID_WEBSITE_URL', message: 'website_url must be http or https', field: 'website_url' } };
  }

  const websiteCondition = optionalValue(record, 'website_condition');
  if (websiteCondition && !websiteConditions.has(websiteCondition as WebsiteCondition)) {
    return { issue: { rowNumber, code: 'INVALID_WEBSITE_CONDITION', message: 'website_condition is not supported', field: 'website_condition' } };
  }

  const ratingText = optionalValue(record, 'rating');
  const rating = ratingText ? parseNumber(ratingText) : undefined;
  if (ratingText && (rating === undefined || rating < 1 || rating > 5)) {
    return { issue: { rowNumber, code: 'INVALID_RATING', message: 'rating must be a number from 1 to 5', field: 'rating' } };
  }

  const reviewCountText = optionalValue(record, 'review_count');
  const reviewCount = reviewCountText ? parseInteger(reviewCountText) : undefined;
  if (reviewCountText && (reviewCount === undefined || reviewCount < 0)) {
    return { issue: { rowNumber, code: 'INVALID_REVIEW_COUNT', message: 'review_count must be a non-negative integer', field: 'review_count' } };
  }

  const latestReviewAtText = optionalValue(record, 'latest_review_at');
  const latestReviewAt = latestReviewAtText ? normalizeIsoTimestamp(latestReviewAtText) : undefined;
  if (latestReviewAtText && !latestReviewAt) {
    return { issue: { rowNumber, code: 'INVALID_LATEST_REVIEW_AT', message: 'latest_review_at must be an ISO timestamp', field: 'latest_review_at' } };
  }

  const logoUrl = optionalValue(record, 'logo_url');
  if (logoUrl && !normalizeUrl(logoUrl)) {
    return { issue: { rowNumber, code: 'INVALID_LOGO_URL', message: 'logo_url must be http or https', field: 'logo_url' } };
  }

  const imageUrls = splitPipeList(optionalValue(record, 'image_urls') ?? '');
  if (imageUrls.length > 80) {
    return { issue: { rowNumber, code: 'INVALID_IMAGE_URLS', message: 'image_urls must contain at most 80 values', field: 'image_urls' } };
  }

  const invalidImageUrl = imageUrls.find((url) => !normalizeUrl(url));
  if (invalidImageUrl) {
    return { issue: { rowNumber, code: 'INVALID_IMAGE_URL', message: 'image_urls must contain only http or https URLs', field: 'image_urls' } };
  }

  const ownerName = optionalValue(record, 'owner_name');
  const normalizedLogoUrl = logoUrl ? normalizeUrl(logoUrl) : undefined;
  const notes = optionalValue(record, 'notes');
  if (notes && notes.length > 800) {
    return { issue: { rowNumber, code: 'INVALID_NOTES', message: 'notes must be at most 800 characters', field: 'notes' } };
  }

  return {
    ...(email ? { email } : {}),
    ...(ownerName ? { ownerName } : {}),
    ...(normalizedWebsite ? { websiteUrl: normalizedWebsite.href, normalizedRootDomain: rootDomainFor(normalizedWebsite) } : {}),
    ...(websiteCondition ? { websiteCondition: websiteCondition as WebsiteCondition } : {}),
    ...(rating !== undefined ? { rating } : {}),
    ...(reviewCount !== undefined ? { reviewCount } : {}),
    ...(latestReviewAt ? { latestReviewAt } : {}),
    ...(normalizedLogoUrl ? { logoUrl: normalizedLogoUrl.href } : {}),
    ...(imageUrls.length > 0 ? { imageUrls: imageUrls.map((url) => normalizeUrl(url)?.href).filter(isString) } : {}),
    ...(notes ? { notes } : {}),
  };
}

function firstMissingRequired(record: RawLeadRecord, rowNumber: number): LeadRowIssue | undefined {
  for (const header of requiredHeaders) {
    if (!value(record, header)) {
      return { rowNumber, code: 'MISSING_REQUIRED_FIELD', message: `${header} is required`, field: header };
    }
  }
  return undefined;
}

export function normalizePhone(input: string): string | undefined {
  const trimmed = input.trim();
  if (/^\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed;

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return undefined;
}

export function rootDomainFor(url: URL): string {
  return url.hostname.toLowerCase().replace(/^www\./, '');
}

function normalizeUrl(input: string): URL | undefined {
  try {
    const url = new URL(input);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : undefined;
  } catch {
    return undefined;
  }
}

function normalizeIsoTimestamp(input: string): string | undefined {
  const timestamp = Date.parse(input);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

function isValidTimeZone(input: string): boolean {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: input }).format(new Date('2026-01-01T00:00:00.000Z'));
    return true;
  } catch {
    return false;
  }
}

function splitPipeList(input: string): string[] {
  return input.split('|').map((value) => value.trim()).filter(Boolean);
}

function parseNumber(input: string): number | undefined {
  if (!/^-?\d+(?:\.\d+)?$/.test(input.trim())) return undefined;
  const value = Number(input);
  return Number.isFinite(value) ? value : undefined;
}

function parseInteger(input: string): number | undefined {
  if (!/^\d+$/.test(input.trim())) return undefined;
  const value = Number(input);
  return Number.isSafeInteger(value) ? value : undefined;
}

function firstDuplicate(values: readonly string[]): string | undefined {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) return value;
    seen.add(value);
  }
  return undefined;
}

function value(record: RawLeadRecord, key: string): string {
  return (record[key] ?? '').trim();
}

function optionalValue(record: RawLeadRecord, key: string): string | undefined {
  const text = value(record, key);
  return text ? text : undefined;
}

function isString(value: string | undefined): value is string {
  return typeof value === 'string';
}
