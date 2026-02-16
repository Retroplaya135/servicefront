import type { ProspectEvidence, ProspectFacts } from './prospect-facts.js';

const privatePreviewPermissionMarker = 'private preview permission confirmed for';
const publicTrustCapturedMarker = 'public rating and review count captured';
const publicTrustConfirmedMarker = 'public rating and review count confirmed';

export function countSupportedOwnedImages(facts: ProspectFacts): number {
  return getSupportedOwnedImageUrls(facts).length;
}

export function getSupportedOwnedImageUrls(facts: ProspectFacts): string[] {
  const seen = new Set<string>();
  const supportedUrls: string[] = [];

  for (const sourceUrl of facts.imageUrls ?? []) {
    if (seen.has(sourceUrl) || !isSafeUrl(sourceUrl) || !hasSupportedOwnedImageEvidence(facts, sourceUrl)) {
      continue;
    }

    seen.add(sourceUrl);
    supportedUrls.push(sourceUrl);
  }

  return supportedUrls;
}

export function hasSupportedOwnedImageEvidence(facts: ProspectFacts, sourceUrl: string): boolean {
  return hasRecordedClientAssetSource(facts, sourceUrl) && hasRecordedPrivatePreviewPermission(facts, sourceUrl);
}

export function hasSupportedPublicTrustEvidence(facts: ProspectFacts): boolean {
  return facts.evidence.some((evidence) => (
    (evidence.kind === 'public_profile' || evidence.kind === 'client_confirmation')
    && evidence.source.trim().length > 0
    && evidence.capturedAt.trim().length > 0
    && hasSupportedPublicTrustMarker(evidence)
  ));
}

function hasSupportedPublicTrustMarker(evidence: ProspectEvidence): boolean {
  const text = evidenceText(evidence);

  return containsText(text, publicTrustCapturedMarker) || containsText(text, publicTrustConfirmedMarker);
}

function hasRecordedClientAssetSource(facts: ProspectFacts, sourceUrl: string): boolean {
  return facts.evidence.some((evidence) => (
    evidence.kind === 'client_asset'
    && evidence.source.trim() === sourceUrl
    && evidence.capturedAt.trim().length > 0
  ));
}

function hasRecordedPrivatePreviewPermission(facts: ProspectFacts, sourceUrl: string): boolean {
  return facts.evidence.some((evidence) => (
    evidence.kind === 'client_confirmation'
    && evidence.source.trim().length > 0
    && evidence.capturedAt.trim().length > 0
    && normalizedText(evidence.notes) === normalizedText(`${privatePreviewPermissionMarker} ${sourceUrl}.`)
  ));
}

function containsText(value: string | undefined, expected: string): boolean {
  return value?.toLowerCase().includes(expected.toLowerCase()) ?? false;
}

function normalizedText(value: string | undefined): string {
  return value?.trim().replace(/\s+/g, ' ').toLowerCase() ?? '';
}

function evidenceText(evidence: ProspectEvidence): string {
  return `${evidence.source}\n${evidence.notes ?? ''}`;
}

function isSafeUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.protocol === 'https:';
  } catch {
    return false;
  }
}
