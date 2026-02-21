import type { SiteSpec } from '@servicefront/site-schema';

export type NormalizedProspectService = SiteSpec['services'][number];

const canonicalServices = {
  'interior painter': {
    key: 'interior_painting',
    name: 'Interior Painting',
    summary: 'Careful preparation and clean interior painting for lived-in homes.',
    pagePath: '/interior-painting',
  },
  'exterior painter': {
    key: 'exterior_painting',
    name: 'Exterior Painting',
    summary: 'Preparation-led exterior painting for a polished, durable appearance.',
    pagePath: '/exterior-painting',
  },
  'cabinet painter': {
    key: 'cabinet_refinishing',
    name: 'Cabinet Refinishing',
    summary: 'A refined cabinet transformation without replacing the full kitchen.',
    pagePath: '/cabinet-refinishing',
  },
  'house painter': {
    key: 'residential_painting',
    name: 'Residential Painting',
    summary: 'Interior and exterior residential painting with a clean estimate process.',
  },
  'deck staining': {
    key: 'deck_staining',
    name: 'Deck Staining',
    summary: 'Preparation-focused deck staining for outdoor living spaces.',
  },
  'commercial painter': {
    key: 'commercial_painting',
    name: 'Commercial Painting',
    summary: 'Painting support for light commercial spaces and property updates.',
  },
} as const satisfies Record<string, Omit<NormalizedProspectService, 'enabled'>>;

export function normalizeProspectServices(input: readonly string[]): NormalizedProspectService[] {
  const services = new Map<string, NormalizedProspectService>();

  for (const rawService of input) {
    const normalizedText = normalizeServiceText(rawService);

    if (!normalizedText) {
      continue;
    }

    const known = canonicalServices[normalizedText as keyof typeof canonicalServices];
    const service = known
      ? ({ ...known, enabled: true } satisfies NormalizedProspectService)
      : buildOperatorReviewService(normalizedText);

    services.set(service.key, service);
  }

  return Array.from(services.values());
}

export function isCanonicalServiceKey(key: string): boolean {
  return Object.values(canonicalServices).some((service) => service.key === key);
}

function normalizeServiceText(value: string): string | undefined {
  const trimmed = value.trim().toLowerCase().replace(/\s+/g, ' ');

  if (!trimmed || !/^[a-z0-9][a-z0-9 /&+-]{1,58}[a-z0-9]$/.test(trimmed)) {
    return undefined;
  }

  return trimmed;
}

function buildOperatorReviewService(normalizedText: string): NormalizedProspectService {
  const displayName = titleCase(normalizedText);
  const key = `operator_review_${normalizedText.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`.slice(0, 50);

  return {
    key,
    name: displayName,
    summary: 'Listed service to confirm during operator review.',
    enabled: true,
  };
}

function titleCase(value: string): string {
  return value
    .split(' ')
    .map((part) => part ? `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}` : part)
    .join(' ');
}
