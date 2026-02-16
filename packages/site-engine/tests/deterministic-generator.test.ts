import { describe, expect, test } from 'vitest';
import { SiteSpecSchema } from '@servicefront/site-schema';
import {
  generateDeterministicSiteSpec,
  getSupportedOwnedImageUrls,
  normalizeProspectServices,
  selectTemplateRecipe,
  type ProspectFacts,
} from '../src/index.js';

const evidence = [
  {
    id: 'lead',
    kind: 'lead_source' as const,
    source: 'fixture',
    capturedAt: '2026-08-30T18:00:00Z',
  },
];

const publicProfileEvidence = [
  {
    id: 'profile',
    kind: 'public_profile' as const,
    source: 'https://maps.example.invalid/sample-painting-co/reviews',
    capturedAt: '2026-08-30T18:30:00Z',
    notes: 'Public rating and review count captured from the business profile.',
  },
];

const clientConfirmationEvidence = [
  {
    id: 'client-confirmation',
    kind: 'client_confirmation' as const,
    source: 'owner phone confirmation',
    capturedAt: '2026-08-30T18:45:00Z',
    notes: 'Public rating and review count confirmed during owner phone confirmation.',
  },
];

const unrelatedPublicProfileEvidence = [
  {
    id: 'public-about',
    kind: 'public_profile' as const,
    source: 'https://example.invalid/about',
    capturedAt: '2026-08-30T18:46:00Z',
    notes: 'Public company bio and office address.',
  },
];

const unavailablePublicTrustEvidence = [
  {
    id: 'profile-unavailable',
    kind: 'public_profile' as const,
    source: 'https://maps.example.invalid/sample-painting-co/reviews',
    capturedAt: '2026-08-30T18:47:00Z',
    notes: 'No rating or review count was captured because reviews were unavailable.',
  },
  {
    id: 'call-unavailable',
    kind: 'client_confirmation' as const,
    source: 'owner follow-up call',
    capturedAt: '2026-08-30T18:48:00Z',
    notes: 'Public rating and review count unavailable during owner follow-up call.',
  },
];

const ownedImageUrl = 'https://example.invalid/owned.jpg';

const ownedImageEvidence = [
  {
    id: 'owned-image',
    kind: 'client_asset' as const,
    source: ownedImageUrl,
    capturedAt: '2026-08-30T18:40:00Z',
    notes: 'Owner supplied this image.',
  },
  {
    id: 'owned-image-permission',
    kind: 'client_confirmation' as const,
    source: 'owner email approval',
    capturedAt: '2026-08-30T18:41:00Z',
    notes: `Private preview permission confirmed for ${ownedImageUrl}.`,
  },
];

const blankSourcePermissionEvidence = [
  {
    id: 'owned-image',
    kind: 'client_asset' as const,
    source: ownedImageUrl,
    capturedAt: '2026-08-30T18:40:00Z',
    notes: 'Owner supplied this image.',
  },
  {
    id: 'owned-image-permission',
    kind: 'client_confirmation' as const,
    source: '',
    capturedAt: '2026-08-30T18:41:00Z',
    notes: `Private preview permission confirmed for ${ownedImageUrl}.`,
  },
];

const baseProspect: ProspectFacts = {
  businessName: 'Sample Painting Co',
  phone: '+12025550101',
  city: 'Menifee',
  state: 'CA',
  services: ['interior painter', 'cabinet painter'],
  rating: 4.8,
  reviewCount: 34,
  websiteCondition: 'dated',
  evidence,
};

const fallbackMediaAssetIds = [
  '00000000-0000-0000-0000-000000000501',
  '00000000-0000-0000-0000-000000000502',
  '00000000-0000-0000-0000-000000000503',
];

const deterministicIdFactory = () => '00000000-0000-0000-0000-000000000999';

function withoutPublicReviewFacts(prospect: ProspectFacts): ProspectFacts {
  const { rating: _rating, reviewCount: _reviewCount, ...rest } = prospect;

  return rest;
}

function withoutReviewCount(prospect: ProspectFacts): ProspectFacts {
  const { reviewCount: _reviewCount, ...rest } = prospect;

  return rest;
}

function withoutRating(prospect: ProspectFacts): ProspectFacts {
  const { rating: _rating, ...rest } = prospect;

  return rest;
}

function supportedImageEvidence(url: string, id: string) {
  return [
    {
      id: `${id}-asset`,
      kind: 'client_asset' as const,
      source: url,
      capturedAt: '2026-08-30T18:40:00Z',
      notes: 'Owner supplied this image.',
    },
    {
      id: `${id}-permission`,
      kind: 'client_confirmation' as const,
      source: `owner approval for ${id}`,
      capturedAt: '2026-08-30T18:41:00Z',
      notes: `Private preview permission confirmed for ${url}.`,
    },
  ];
}

function deniedImageEvidence(url: string, id: string) {
  return [
    {
      id: `${id}-asset`,
      kind: 'client_asset' as const,
      source: url,
      capturedAt: '2026-08-30T18:40:00Z',
      notes: 'Owner supplied this image.',
    },
    {
      id: `${id}-permission-denied`,
      kind: 'client_confirmation' as const,
      source: `owner decision for ${id}`,
      capturedAt: '2026-08-30T18:41:00Z',
      notes: `Private preview denied for ${url}.`,
    },
  ];
}

function loosePreviewImageEvidence(url: string, id: string) {
  return [
    {
      id: `${id}-asset`,
      kind: 'client_asset' as const,
      source: url,
      capturedAt: '2026-08-30T18:40:00Z',
      notes: 'Owner supplied this image.',
    },
    {
      id: `${id}-permission-loose`,
      kind: 'client_confirmation' as const,
      source: `owner approval for ${id}`,
      capturedAt: '2026-08-30T18:41:00Z',
      notes: `Private preview approved for ${url}.`,
    },
  ];
}

describe('deterministic SiteSpec generation', () => {
  test('creates a valid preview spec using only verified facts', () => {
    const result = generateDeterministicSiteSpec({
      prospect: baseProspect,
      fallbackMediaAssetIds,
      now: '2026-08-30T19:00:00Z',
      idFactory: deterministicIdFactory,
    });

    expect(SiteSpecSchema.parse(result)).toEqual(result);
    expect(result.identity.displayName).toBe('Sample Painting Co');
    expect(result.contact.phone).toBe('+12025550101');
    expect(result.contact.hours).toBeUndefined();
    expect(result.services.map((service) => service.name)).toContain('Cabinet Refinishing');
    expect(result.seo.robots).toBe('noindex,nofollow,noarchive');
    expect(result.provenance.generationMode).toBe('deterministic');
  });

  test('does not invent licensing, insurance, years, guarantees, testimonials, or review counts', () => {
    const result = generateDeterministicSiteSpec({
      prospect: {
        ...withoutPublicReviewFacts(baseProspect),
      },
      fallbackMediaAssetIds,
      now: '2026-08-30T19:00:00Z',
      idFactory: deterministicIdFactory,
    });

    expect(result.trust?.licensed).toBeUndefined();
    expect(result.trust?.insured).toBeUndefined();
    expect(result.trust?.yearsInBusiness).toBeUndefined();
    expect(result.trust?.guarantees ?? []).toEqual([]);
    expect(result.trust?.rating).toBeUndefined();
    expect(result.trust?.reviewCount).toBeUndefined();
    expect(result.testimonials ?? []).toEqual([]);
  });

  test('requires recorded evidence before exposing public rating or review count', () => {
    const result = generateDeterministicSiteSpec({
      prospect: {
        ...baseProspect,
        evidence: [],
      },
      fallbackMediaAssetIds,
      now: '2026-08-30T19:00:00Z',
      idFactory: deterministicIdFactory,
    });

    expect(result.trust?.rating).toBeUndefined();
    expect(result.trust?.reviewCount).toBeUndefined();
  });

  test('does not expose public trust facts when only unrelated evidence is recorded', () => {
    const result = generateDeterministicSiteSpec({
      prospect: baseProspect,
      fallbackMediaAssetIds,
      now: '2026-08-30T19:00:00Z',
      idFactory: deterministicIdFactory,
    });

    expect(result.trust).toBeUndefined();
  });

  test('does not expose public trust facts for unrelated public profile evidence', () => {
    const result = generateDeterministicSiteSpec({
      prospect: {
        ...baseProspect,
        evidence: unrelatedPublicProfileEvidence,
      },
      fallbackMediaAssetIds,
      now: '2026-08-30T19:00:00Z',
      idFactory: deterministicIdFactory,
    });

    expect(result.trust).toBeUndefined();
  });

  test('does not expose public trust facts for negated or unavailable review evidence', () => {
    const result = generateDeterministicSiteSpec({
      prospect: {
        ...baseProspect,
        evidence: unavailablePublicTrustEvidence,
      },
      fallbackMediaAssetIds,
      now: '2026-08-30T19:00:00Z',
      idFactory: deterministicIdFactory,
    });

    expect(result.trust).toBeUndefined();
  });

  test('does not invent business hours for sparse prospects', () => {
    const result = generateDeterministicSiteSpec({
      prospect: {
        ...withoutPublicReviewFacts(baseProspect),
      },
      fallbackMediaAssetIds,
      now: '2026-08-30T19:00:00Z',
      idFactory: deterministicIdFactory,
    });

    expect(result.contact.hours).toBeUndefined();
  });

  test('does not expose a rating without a matching review count', () => {
    const result = generateDeterministicSiteSpec({
      prospect: {
        ...withoutReviewCount(baseProspect),
        evidence: publicProfileEvidence,
      },
      fallbackMediaAssetIds,
      now: '2026-08-30T19:00:00Z',
      idFactory: deterministicIdFactory,
    });

    expect(result.trust).toBeUndefined();
  });

  test('does not expose a review count without a matching rating', () => {
    const result = generateDeterministicSiteSpec({
      prospect: {
        ...withoutRating(baseProspect),
        evidence: publicProfileEvidence,
      },
      fallbackMediaAssetIds,
      now: '2026-08-30T19:00:00Z',
      idFactory: deterministicIdFactory,
    });

    expect(result.trust).toBeUndefined();
  });

  test('exposes public trust facts when both metrics and public profile evidence are recorded', () => {
    const result = generateDeterministicSiteSpec({
      prospect: {
        ...baseProspect,
        evidence: publicProfileEvidence,
      },
      fallbackMediaAssetIds,
      now: '2026-08-30T19:00:00Z',
      idFactory: deterministicIdFactory,
    });

    expect(result.trust).toEqual({
      rating: 4.8,
      reviewCount: 34,
      guarantees: [],
    });
  });

  test('exposes public trust facts when both metrics and client confirmation evidence are recorded', () => {
    const result = generateDeterministicSiteSpec({
      prospect: {
        ...baseProspect,
        evidence: clientConfirmationEvidence,
      },
      fallbackMediaAssetIds,
      now: '2026-08-30T19:00:00Z',
      idFactory: deterministicIdFactory,
    });

    expect(result.trust).toEqual({
      rating: 4.8,
      reviewCount: 34,
      guarantees: [],
    });
  });

  test('normalizes explicit safe service aliases and preserves safe unknowns without dedicated routes', () => {
    expect(normalizeProspectServices(['interior painter', 'limewash accents', '<script>alert(1)</script>'])).toEqual([
      {
        key: 'interior_painting',
        name: 'Interior Painting',
        summary: 'Careful preparation and clean interior painting for lived-in homes.',
        enabled: true,
        pagePath: '/interior-painting',
      },
      {
        key: 'operator_review_limewash_accents',
        name: 'Limewash Accents',
        summary: 'Listed service to confirm during operator review.',
        enabled: true,
      },
    ]);
  });

  test('selects recipes deterministically and resolves ties to trusted local', () => {
    const galleryUrls = new Array(6).fill(null).map((_, index) => `https://example.invalid/project-${index}.jpg`);

    expect(selectTemplateRecipe(baseProspect)).toBe('painting-premium');
    expect(selectTemplateRecipe({
      ...baseProspect,
      services: ['exterior painter'],
      imageUrls: galleryUrls,
      evidence: [
        ...publicProfileEvidence,
        ...galleryUrls.flatMap((url, index) => supportedImageEvidence(url, `project-${index}`)),
      ],
    })).toBe('painting-gallery-first');
    expect(selectTemplateRecipe({ ...withoutPublicReviewFacts(baseProspect), services: ['interior painter'] })).toBe('painting-trusted-local');
    expect(selectTemplateRecipe({
      ...withoutPublicReviewFacts(baseProspect),
      city: 'Newport Beach',
      services: ['exterior painter'],
    })).toBe('painting-trusted-local');
  });

  test('does not score bare https image urls as usable photography for gallery-first or premium selection', () => {
    expect(selectTemplateRecipe({
      ...withoutPublicReviewFacts(baseProspect),
      services: ['interior painter'],
      imageUrls: new Array(6).fill('https://example.invalid/gallery-only.jpg'),
    })).toBe('painting-trusted-local');

    expect(selectTemplateRecipe({
      ...withoutPublicReviewFacts(baseProspect),
      services: ['commercial painter'],
      imageUrls: [
        'https://example.invalid/premium-1.jpg',
        'https://example.invalid/premium-2.jpg',
        'https://example.invalid/premium-3.jpg',
      ],
    })).toBe('painting-trusted-local');
  });

  test('does not score denied private-preview image evidence as usable photography', () => {
    const galleryUrls = new Array(6).fill(null).map((_, index) => `https://example.invalid/denied-gallery-${index}.jpg`);
    const premiumUrls = [
      'https://example.invalid/denied-premium-1.jpg',
      'https://example.invalid/denied-premium-2.jpg',
      'https://example.invalid/denied-premium-3.jpg',
    ];

    expect(selectTemplateRecipe({
      ...withoutPublicReviewFacts(baseProspect),
      services: ['interior painter'],
      imageUrls: galleryUrls,
      evidence: galleryUrls.flatMap((url, index) => deniedImageEvidence(url, `denied-gallery-${index}`)),
    })).toBe('painting-trusted-local');

    expect(selectTemplateRecipe({
      ...withoutPublicReviewFacts(baseProspect),
      services: ['commercial painter'],
      imageUrls: premiumUrls,
      evidence: premiumUrls.flatMap((url, index) => deniedImageEvidence(url, `denied-premium-${index}`)),
    })).toBe('painting-trusted-local');
  });

  test('scores permission-backed image urls as usable photography for gallery-first and premium selection', () => {
    const galleryUrls = new Array(6).fill(null).map((_, index) => `https://example.invalid/gallery-${index}.jpg`);
    const premiumUrls = [
      'https://example.invalid/premium-1.jpg',
      'https://example.invalid/premium-2.jpg',
      'https://example.invalid/premium-3.jpg',
    ];

    expect(selectTemplateRecipe({
      ...withoutPublicReviewFacts(baseProspect),
      services: ['interior painter'],
      imageUrls: galleryUrls,
      evidence: galleryUrls.flatMap((url, index) => supportedImageEvidence(url, `gallery-${index}`)),
    })).toBe('painting-gallery-first');

    expect(selectTemplateRecipe({
      ...withoutPublicReviewFacts(baseProspect),
      services: ['commercial painter'],
      imageUrls: premiumUrls,
      evidence: premiumUrls.flatMap((url, index) => supportedImageEvidence(url, `premium-${index}`)),
    })).toBe('painting-premium');
  });

  test('counts only unique permission-backed owned image urls for recipe scoring', () => {
    expect(selectTemplateRecipe({
      ...withoutPublicReviewFacts(baseProspect),
      services: ['interior painter'],
      imageUrls: new Array(6).fill('https://example.invalid/duplicate-gallery.jpg'),
      evidence: supportedImageEvidence('https://example.invalid/duplicate-gallery.jpg', 'duplicate-gallery'),
    })).toBe('painting-trusted-local');

    expect(selectTemplateRecipe({
      ...withoutPublicReviewFacts(baseProspect),
      services: ['commercial painter'],
      imageUrls: [
        'https://example.invalid/duplicate-premium.jpg',
        'https://example.invalid/duplicate-premium.jpg',
        'https://example.invalid/duplicate-premium.jpg',
      ],
      evidence: supportedImageEvidence('https://example.invalid/duplicate-premium.jpg', 'duplicate-premium'),
    })).toBe('painting-trusted-local');
  });

  test('uses the strict private-preview permission marker when scoring owned image urls', () => {
    const galleryUrls = new Array(6).fill(null).map((_, index) => `https://example.invalid/loose-gallery-${index}.jpg`);

    expect(selectTemplateRecipe({
      ...withoutPublicReviewFacts(baseProspect),
      services: ['interior painter'],
      imageUrls: galleryUrls,
      evidence: galleryUrls.flatMap((url, index) => loosePreviewImageEvidence(url, `loose-gallery-${index}`)),
    })).toBe('painting-trusted-local');
  });

  test('honors a validated operator recipe override', () => {
    const result = generateDeterministicSiteSpec({
      prospect: baseProspect,
      fallbackMediaAssetIds,
      now: '2026-08-30T19:00:00Z',
      recipeOverride: 'painting-gallery-first',
      idFactory: deterministicIdFactory,
    });

    expect(result.theme.recipeKey).toBe('painting-gallery-first');
  });

  test('rejects an invalid runtime operator recipe override', () => {
    expect(() => generateDeterministicSiteSpec({
      prospect: baseProspect,
      fallbackMediaAssetIds,
      now: '2026-08-30T19:00:00Z',
      recipeOverride: 'painting-unknown',
      idFactory: deterministicIdFactory,
    } as never)).toThrow(/TEMPLATE_NOT_FOUND/);
  });

  test('requires an injected id factory for deterministic generation', () => {
    expect(() => generateDeterministicSiteSpec({
      prospect: baseProspect,
      fallbackMediaAssetIds,
      now: '2026-08-30T19:00:00Z',
    } as never)).toThrow(/ID_FACTORY_REQUIRED/);
  });

  test('rejects prospects when services normalize to empty or unsafe input only', () => {
    expect(() => generateDeterministicSiteSpec({
      prospect: {
        ...withoutPublicReviewFacts(baseProspect),
        services: ['<script>alert(1)</script>'],
      },
      fallbackMediaAssetIds,
      now: '2026-08-30T19:00:00Z',
      idFactory: deterministicIdFactory,
    })).toThrow(/NO_SAFE_SERVICES/);
  });

  test('bounds generated copy for max-schema-valid prospect fields', () => {
    const result = generateDeterministicSiteSpec({
      prospect: {
        ...withoutPublicReviewFacts(baseProspect),
        businessName: 'A'.repeat(100),
        city: 'B'.repeat(80),
        state: 'C'.repeat(40),
        services: ['cabinet painter', 'decorative limewash accent finishing for large entry spaces'],
        evidence: publicProfileEvidence,
      },
      fallbackMediaAssetIds,
      now: '2026-08-30T19:00:00Z',
      idFactory: deterministicIdFactory,
    });

    expect(SiteSpecSchema.parse(result)).toEqual(result);
    expect(result.seo.siteTitle.length).toBeLessThanOrEqual(70);
    expect(result.seo.defaultDescription.length).toBeLessThanOrEqual(170);
    expect(result.identity.tagline?.length ?? 0).toBeLessThanOrEqual(160);
    expect(result.pages.flatMap((page) => page.sections).every((section) => (section.headline?.length ?? 0) <= 160)).toBe(true);
    expect(result.pages.flatMap((page) => page.sections).every((section) => (section.body?.length ?? 0) <= 1800)).toBe(true);
  });

  test('does not treat bare https image URLs as client-owned without supporting evidence', () => {
    const result = generateDeterministicSiteSpec({
      prospect: {
        ...baseProspect,
        imageUrls: [ownedImageUrl, 'http://example.invalid/not-private.jpg'],
      },
      fallbackMediaAssetIds,
      now: '2026-08-30T19:00:00Z',
      idFactory: () => '00000000-0000-0000-0000-000000000777',
    });

    expect(result.media).toEqual([
      expect.objectContaining({
        assetId: fallbackMediaAssetIds[0],
        rightsStatus: 'licensed',
        placeholder: true,
      }),
      expect.objectContaining({
        assetId: fallbackMediaAssetIds[1],
        rightsStatus: 'licensed',
        placeholder: true,
      }),
      expect.objectContaining({
        assetId: fallbackMediaAssetIds[2],
        rightsStatus: 'licensed',
        placeholder: true,
      }),
    ]);
    expect(result.provenance.evidence).toContainEqual(expect.objectContaining({
      kind: 'licensed_asset',
    }));
  });

  test('uses injected ids for permission-backed prospect-owned images only when source and approval evidence exist', () => {
    const result = generateDeterministicSiteSpec({
      prospect: {
        ...baseProspect,
        imageUrls: [ownedImageUrl, 'http://example.invalid/not-private.jpg'],
        evidence: [...publicProfileEvidence, ...ownedImageEvidence],
      },
      fallbackMediaAssetIds,
      now: '2026-08-30T19:00:00Z',
      idFactory: () => '00000000-0000-0000-0000-000000000777',
    });

    expect(result.media).toEqual([
      expect.objectContaining({
        assetId: '00000000-0000-0000-0000-000000000777',
        rightsStatus: 'client_owned',
        sourceUrl: ownedImageUrl,
        placeholder: false,
      }),
    ]);
    expect(result.provenance.evidence).not.toContainEqual(expect.objectContaining({
      kind: 'licensed_asset',
    }));
  });

  test('exposes one shared strict gate for supported owned image urls', () => {
    expect(getSupportedOwnedImageUrls({
      ...baseProspect,
      imageUrls: [
        ownedImageUrl,
        ownedImageUrl,
        'https://example.invalid/loose.jpg',
        'http://example.invalid/not-safe.jpg',
      ],
      evidence: [
        ...ownedImageEvidence,
        ...loosePreviewImageEvidence('https://example.invalid/loose.jpg', 'loose'),
        ...supportedImageEvidence('http://example.invalid/not-safe.jpg', 'not-safe'),
      ],
    })).toEqual([ownedImageUrl]);
  });

  test('rejects owned image permission when the approval note targets a longer URL', () => {
    const shortUrl = 'https://example.invalid/photo.jpg';
    const longerUrl = 'https://example.invalid/photo.jpg-before.jpg';
    const prospect = {
      ...baseProspect,
      imageUrls: [shortUrl],
      evidence: [
        ...publicProfileEvidence,
        {
          id: 'short-image-asset',
          kind: 'client_asset' as const,
          source: shortUrl,
          capturedAt: '2026-08-30T18:40:00Z',
          notes: 'Owner supplied this image.',
        },
        {
          id: 'longer-image-permission',
          kind: 'client_confirmation' as const,
          source: 'owner email approval',
          capturedAt: '2026-08-30T18:41:00Z',
          notes: `Private preview permission confirmed for ${longerUrl}.`,
        },
      ],
    };

    expect(getSupportedOwnedImageUrls(prospect)).toEqual([]);

    const result = generateDeterministicSiteSpec({
      prospect,
      fallbackMediaAssetIds,
      now: '2026-08-30T19:00:00Z',
      idFactory: () => '00000000-0000-0000-0000-000000000777',
    });

    expect(result.media).toEqual([
      expect.objectContaining({
        assetId: fallbackMediaAssetIds[0],
        rightsStatus: 'licensed',
        placeholder: true,
      }),
      expect.objectContaining({
        assetId: fallbackMediaAssetIds[1],
        rightsStatus: 'licensed',
        placeholder: true,
      }),
      expect.objectContaining({
        assetId: fallbackMediaAssetIds[2],
        rightsStatus: 'licensed',
        placeholder: true,
      }),
    ]);
  });

  test('dedupes permission-backed prospect-owned image urls in first-seen order before rendering', () => {
    const secondOwnedImageUrl = 'https://example.invalid/owned-2.jpg';
    const result = generateDeterministicSiteSpec({
      prospect: {
        ...baseProspect,
        imageUrls: [ownedImageUrl, ownedImageUrl, secondOwnedImageUrl],
        evidence: [
          ...publicProfileEvidence,
          ...ownedImageEvidence,
          ...supportedImageEvidence(secondOwnedImageUrl, 'owned-2'),
        ],
      },
      fallbackMediaAssetIds,
      now: '2026-08-30T19:00:00Z',
      idFactory: (label) => (
        label.includes('prospect-0')
          ? '00000000-0000-0000-0000-000000000701'
          : '00000000-0000-0000-0000-000000000702'
      ),
    });

    expect(result.media?.map((entry) => entry.sourceUrl)).toEqual([ownedImageUrl, secondOwnedImageUrl]);
    expect(result.media?.map((entry) => entry.assetId)).toEqual([
      '00000000-0000-0000-0000-000000000701',
      '00000000-0000-0000-0000-000000000702',
    ]);
  });

  test('uses neutral estimate form copy without unsupported team claims', () => {
    const result = generateDeterministicSiteSpec({
      prospect: baseProspect,
      fallbackMediaAssetIds,
      now: '2026-08-30T19:00:00Z',
      idFactory: deterministicIdFactory,
    });

    expect(result.forms.successMessage).toContain('business');
    expect(result.forms.successMessage).not.toMatch(/\bteam\b|\bteam member\b/i);
  });

  test('does not accept owned-image approval without a recorded approval source', () => {
    const result = generateDeterministicSiteSpec({
      prospect: {
        ...baseProspect,
        imageUrls: [ownedImageUrl],
        evidence: [...publicProfileEvidence, ...blankSourcePermissionEvidence],
      },
      fallbackMediaAssetIds,
      now: '2026-08-30T19:00:00Z',
      idFactory: deterministicIdFactory,
    });

    expect(result.media).toEqual([
      expect.objectContaining({
        assetId: fallbackMediaAssetIds[0],
        rightsStatus: 'licensed',
        placeholder: true,
      }),
      expect.objectContaining({
        assetId: fallbackMediaAssetIds[1],
        rightsStatus: 'licensed',
        placeholder: true,
      }),
      expect.objectContaining({
        assetId: fallbackMediaAssetIds[2],
        rightsStatus: 'licensed',
        placeholder: true,
      }),
    ]);
  });

  test('dedupes fallback media asset ids in first-seen order before capping at six', () => {
    const [firstFallbackId, secondFallbackId, thirdFallbackId] = fallbackMediaAssetIds;
    const result = generateDeterministicSiteSpec({
      prospect: baseProspect,
      fallbackMediaAssetIds: [
        firstFallbackId!,
        firstFallbackId!,
        secondFallbackId!,
        thirdFallbackId!,
        thirdFallbackId!,
        '00000000-0000-0000-0000-000000000504',
        '00000000-0000-0000-0000-000000000505',
        '00000000-0000-0000-0000-000000000506',
        '00000000-0000-0000-0000-000000000507',
      ],
      now: '2026-08-30T19:00:00Z',
      idFactory: deterministicIdFactory,
    });

    const media = result.media ?? [];

    expect(media.map((entry) => entry.assetId)).toEqual([
      firstFallbackId!,
      secondFallbackId!,
      thirdFallbackId!,
      '00000000-0000-0000-0000-000000000504',
      '00000000-0000-0000-0000-000000000505',
      '00000000-0000-0000-0000-000000000506',
    ]);
  });

  test('returns no media and no licensed evidence when no owned media qualifies and no fallback ids are provided', () => {
    const result = generateDeterministicSiteSpec({
      prospect: baseProspect,
      fallbackMediaAssetIds: [],
      now: '2026-08-30T19:00:00Z',
      idFactory: deterministicIdFactory,
    });

    expect(result.media).toEqual([]);
    expect(result.provenance.evidence).not.toContainEqual(expect.objectContaining({
      kind: 'licensed_asset',
    }));
  });

  test('rejects duplicate owned-media ids from the injected id factory', () => {
    expect(() => generateDeterministicSiteSpec({
      prospect: {
        ...baseProspect,
        imageUrls: [ownedImageUrl, 'https://example.invalid/owned-2.jpg'],
        evidence: [
          ...publicProfileEvidence,
          ...ownedImageEvidence,
          {
            id: 'owned-image-2',
            kind: 'client_asset',
            source: 'https://example.invalid/owned-2.jpg',
            capturedAt: '2026-08-30T18:42:00Z',
            notes: 'Owner supplied this image.',
          },
          {
            id: 'owned-image-2-permission',
            kind: 'client_confirmation',
            source: 'owner email approval for gallery follow-up',
            capturedAt: '2026-08-30T18:43:00Z',
            notes: 'Private preview permission confirmed for https://example.invalid/owned-2.jpg.',
          },
        ],
      },
      fallbackMediaAssetIds,
      now: '2026-08-30T19:00:00Z',
      idFactory: deterministicIdFactory,
    })).toThrow(/DUPLICATE_MEDIA_ASSET_ID/);
  });

  test('marks fallback media as licensed placeholders with evidence provenance', () => {
    const result = generateDeterministicSiteSpec({
      prospect: baseProspect,
      fallbackMediaAssetIds,
      now: '2026-08-30T19:00:00Z',
      idFactory: deterministicIdFactory,
    });

    expect(result.media).toEqual([
      expect.objectContaining({
        assetId: fallbackMediaAssetIds[0],
        role: 'hero',
        rightsStatus: 'licensed',
        placeholder: true,
      }),
      expect.objectContaining({
        assetId: fallbackMediaAssetIds[1],
        role: 'project',
        rightsStatus: 'licensed',
        placeholder: true,
      }),
      expect.objectContaining({
        assetId: fallbackMediaAssetIds[2],
        role: 'project',
        rightsStatus: 'licensed',
        placeholder: true,
      }),
    ]);
    expect(result.provenance.evidence).toContainEqual(expect.objectContaining({
      kind: 'licensed_asset',
      source: 'licensed fallback media pack',
    }));
  });

  test('is deep-equal for the same normalized input and injected dependencies', () => {
    const input = {
      prospect: baseProspect,
      fallbackMediaAssetIds,
      now: '2026-08-30T19:00:00Z',
      idFactory: (label: string) => `00000000-0000-0000-0000-${label.padStart(12, '0').slice(0, 12)}`,
    };

    expect(generateDeterministicSiteSpec(input)).toEqual(generateDeterministicSiteSpec(input));
  });

  test('keeps composed copy within schema limits for long but valid prospect strings', () => {
    const longProspect: ProspectFacts = {
      ...baseProspect,
      businessName: 'A'.repeat(100),
      city: 'B'.repeat(80),
      state: 'CA',
      evidence: publicProfileEvidence,
    };

    const result = generateDeterministicSiteSpec({
      prospect: longProspect,
      fallbackMediaAssetIds,
      now: '2026-08-30T19:00:00Z',
      idFactory: deterministicIdFactory,
    });

    expect(result.seo.siteTitle.length).toBeLessThanOrEqual(70);
    expect(result.seo.defaultDescription.length).toBeLessThanOrEqual(170);
    expect(result.pages.every((page) => (
      page.title.length <= 120
      && page.sections.every((section) => (
        (section.headline?.length ?? 0) <= 160
        && (section.body?.length ?? 0) <= 1800
      ))
    ))).toBe(true);
  });

  test('uses stable injected owned-media ids and no internal id fallback', () => {
    const input = {
      prospect: {
        ...baseProspect,
        imageUrls: [ownedImageUrl],
        evidence: [...publicProfileEvidence, ...ownedImageEvidence],
      },
      fallbackMediaAssetIds,
      now: '2026-08-30T19:00:00Z',
      idFactory: deterministicIdFactory,
    };

    const first = generateDeterministicSiteSpec(input);
    const second = generateDeterministicSiteSpec(input);

    expect(first.media).toEqual(second.media);
    expect(first.media?.[0]?.assetId).toBe('00000000-0000-0000-0000-000000000999');
  });
});
