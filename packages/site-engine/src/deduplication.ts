import type { LeadImportRow, LeadRowIssue } from './lead-import.js';

export type DeduplicationResult = {
  accepted: LeadImportRow[];
  rejected: LeadRowIssue[];
};

export function deduplicateProspects(rows: readonly LeadImportRow[]): DeduplicationResult {
  const accepted: LeadImportRow[] = [];
  const rejected: LeadRowIssue[] = [];
  const rowByPhone = new Map<string, number>();
  const rowByDomain = new Map<string, number>();
  const rowByNameLocality = new Map<string, number>();

  for (const row of rows) {
    const phoneMatch = rowByPhone.get(row.phone);
    if (phoneMatch !== undefined) {
      rejected.push({
        rowNumber: row.rowNumber,
        code: 'DUPLICATE_PHONE',
        message: `duplicate normalized phone matches row ${phoneMatch}`,
        field: 'phone',
      });
      continue;
    }

    if (row.normalizedRootDomain) {
      const domainMatch = rowByDomain.get(row.normalizedRootDomain);
      if (domainMatch !== undefined) {
        rejected.push({
          rowNumber: row.rowNumber,
          code: 'DUPLICATE_DOMAIN',
          message: `duplicate normalized root domain matches row ${domainMatch}`,
          field: 'website_url',
        });
        continue;
      }
    }

    const warnings = [...(row.warnings ?? [])];
    const nameLocalityKey = normalizeNameLocality(row);
    const nameLocalityMatch = rowByNameLocality.get(nameLocalityKey);
    if (nameLocalityMatch !== undefined) {
      warnings.push({
        rowNumber: row.rowNumber,
        code: 'ADVISORY_NAME_LOCALITY_DUPLICATE',
        message: `business name and locality match row ${nameLocalityMatch}`,
        field: 'business_name',
      });
    }

    accepted.push(warnings.length > 0 ? { ...row, warnings } : row);
    rowByPhone.set(row.phone, row.rowNumber);
    if (row.normalizedRootDomain) rowByDomain.set(row.normalizedRootDomain, row.rowNumber);
    if (!rowByNameLocality.has(nameLocalityKey)) rowByNameLocality.set(nameLocalityKey, row.rowNumber);
  }

  return { accepted, rejected };
}

function normalizeNameLocality(row: LeadImportRow): string {
  return [
    row.businessName.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' '),
    row.city.toLowerCase(),
    row.state.toLowerCase(),
  ].join('|');
}
