import { SiteSpecSchema, type SiteSpec } from '@servicefront/site-schema';
import { getTemplateRecipe, type TemplateKey } from '@servicefront/template-registry';
import { getSupportedOwnedImageUrls, hasSupportedPublicTrustEvidence } from './evidence-support.js';
import { selectTemplateRecipe } from './recipe-selector.js';
import { normalizeProspectServices } from './service-normalizer.js';
import type { GenerateDeterministicSiteSpecInput, ProspectEvidence, ProspectFacts } from './prospect-facts.js';

type Page = SiteSpec['pages'][number];
type Section = Page['sections'][number];
type Media = NonNullable<SiteSpec['media']>[number];

export class DeterministicSiteGenerationError extends Error {
  constructor(readonly code: 'DUPLICATE_MEDIA_ASSET_ID' | 'ID_FACTORY_REQUIRED' | 'NO_SAFE_SERVICES') {
    super(code);
    this.name = 'DeterministicSiteGenerationError';
  }
}

export function generateDeterministicSiteSpec(input: GenerateDeterministicSiteSpecInput): SiteSpec {
  if (typeof input.idFactory !== 'function') {
    throw new DeterministicSiteGenerationError('ID_FACTORY_REQUIRED');
  }

  const recipeKey = input.recipeOverride ?? selectTemplateRecipe(input.prospect);
  const recipe = getTemplateRecipe(recipeKey);
  const services = normalizeProspectServices(input.prospect.services);

  if (services.length === 0) {
    throw new DeterministicSiteGenerationError('NO_SAFE_SERVICES');
  }

  const evidence = [...input.prospect.evidence, ...licensedAssetEvidence(input)].sort(compareEvidence);
  const trust = buildTrust(input.prospect);
  const primaryService = services[0];
  const spec: SiteSpec = {
    schemaVersion: 1,
    identity: buildIdentity(input.prospect, recipeKey, primaryService),
    contact: buildContact(input.prospect),
    services,
    serviceAreas: [input.prospect.city],
    ...(trust ? { trust } : {}),
    testimonials: [],
    media: buildMedia(input),
    pages: recipe.pages.map((path) => buildPage(path, recipeKey, input.prospect, services)),
    theme: {
      recipeKey,
      accent: recipe.tokens.accentOptions[0] ?? '#244A3B',
      tone: recipeKey === 'painting-premium' ? 'light' : 'balanced',
      heroVariant: recipe.componentVariants.hero?.[0],
      galleryVariant: recipe.componentVariants.project_gallery?.[0],
    },
    seo: {
      siteTitle: siteTitleFor(input.prospect),
      defaultDescription: defaultDescriptionFor(input.prospect),
      robots: 'noindex,nofollow,noarchive',
      structuredDataEnabled: false,
    },
    forms: {
      estimateFormEnabled: true,
      successMessage: 'Thanks. The business will follow up about the painting estimate.',
      privacyNotice: 'This private preview request is used only to follow up about the painting project.',
    },
    provenance: {
      generatedAt: input.now,
      generationMode: 'deterministic',
      evidence,
    },
  };

  return SiteSpecSchema.parse(spec);
}

function buildIdentity(
  prospect: ProspectFacts,
  recipeKey: TemplateKey,
  primaryService: SiteSpec['services'][number] | undefined,
): SiteSpec['identity'] {
  return {
    displayName: prospect.businessName,
    businessType: 'painting_contractor',
    tagline: fitText(headlineFor(recipeKey, primaryService?.name ?? 'Painting Services'), 160),
    city: prospect.city,
    state: prospect.state,
    ...(prospect.postalCode ? { postalCode: prospect.postalCode } : {}),
    ...(prospect.logoAssetId ? { logoAssetId: prospect.logoAssetId, textWordmark: false } : { textWordmark: true }),
  };
}

function buildContact(prospect: ProspectFacts): SiteSpec['contact'] {
  return {
    phone: prospect.phone,
    ...(prospect.email ? { email: prospect.email } : {}),
    displayPhone: prospect.phone,
    primaryCta: 'request_estimate',
  };
}

function buildTrust(prospect: ProspectFacts): SiteSpec['trust'] | undefined {
  if (!hasPublicTrustFacts(prospect) || !hasSupportedPublicTrustEvidence(prospect)) {
    return undefined;
  }

  return {
    rating: prospect.rating,
    reviewCount: prospect.reviewCount,
    guarantees: [],
  } satisfies SiteSpec['trust'];
}

function buildMedia(input: GenerateDeterministicSiteSpecInput): Media[] {
  const ownedMediaIds = new Set<string>();
  const ownedMedia = getSupportedOwnedImageUrls(input.prospect).map((sourceUrl, index) => {
    const assetId = input.idFactory(`prospect-${index}-${sourceUrl}`);

    if (ownedMediaIds.has(assetId)) {
      throw new DeterministicSiteGenerationError('DUPLICATE_MEDIA_ASSET_ID');
    }

    ownedMediaIds.add(assetId);

    return {
      assetId,
      role: index === 0 ? 'hero' : 'project',
      alt: `${input.prospect.businessName} supplied painting image`,
      rightsStatus: 'client_owned',
      sourceUrl,
      placeholder: false,
      focalX: 0.5,
      focalY: 0.5,
    } satisfies Media;
  });

  if (ownedMedia.length > 0) {
    return ownedMedia;
  }

  return uniqueFirstSeen(input.fallbackMediaAssetIds).slice(0, 6).map((assetId, index) => ({
    assetId,
    role: index === 0 ? 'hero' : index < 3 ? 'project' : 'service',
    alt: `Licensed concept image for ${input.prospect.businessName}`,
    rightsStatus: 'licensed',
    sourceUrl: `https://assets.example.invalid/fallback/${assetId}.jpg`,
    placeholder: true,
    focalX: 0.5,
    focalY: 0.5,
  }) satisfies Media);
}

function buildPage(
  path: string,
  recipeKey: TemplateKey,
  prospect: ProspectFacts,
  services: readonly SiteSpec['services'][number][],
): Page {
  const service = services.find((candidate) => candidate.pagePath === path);
  const title = pageTitle(path, service);

  return {
    path,
    title,
    enabled: true,
    sections: sectionsForPath(path, title, recipeKey, prospect, services[0]),
  };
}

function sectionsForPath(
  path: string,
  title: string,
  recipeKey: TemplateKey,
  prospect: ProspectFacts,
  primaryService: SiteSpec['services'][number] | undefined,
): Section[] {
  if (path === '/request-estimate') {
    return [
      section('estimate-request', 'estimate_form', 'detailed', true),
      section('estimate-final', 'final_cta', 'standard', true),
    ];
  }

  if (path === '/about') {
    return [
      section('about-hero', 'hero', heroVariant(recipeKey), true, `About ${prospect.businessName}`, `${prospect.businessName} is presented as a private painting website concept for ${prospect.city} homeowners.`),
      section('about-story', 'about_story', 'standard', true),
      section('about-areas', 'service_areas', 'standard', true),
      section('about-final', 'final_cta', 'standard', true),
    ];
  }

  if (path !== '/') {
    return [
      section(`${slug(path)}-hero`, 'hero', 'service', true, title, `Professional ${title.toLowerCase()} in ${prospect.city} and nearby communities.`),
      section(`${slug(path)}-services`, 'service_grid', 'detail', true),
      section(`${slug(path)}-form`, 'estimate_form', 'standard', true),
    ];
  }

  return [
    section('home-hero', 'hero', heroVariant(recipeKey), true, fitText(headlineFor(recipeKey, primaryService?.name ?? 'Painting Services'), 160), homeBody(recipeKey, prospect)),
    section('home-trust', 'trust_bar', 'standard', true),
    section('home-services', 'service_grid', serviceGridVariant(recipeKey), true),
    section('home-gallery', 'project_gallery', galleryVariant(recipeKey), true),
    section('home-process', 'process', 'three_step', true),
    section('home-reviews', 'review_wall', reviewVariant(recipeKey), true),
    section('home-form', 'estimate_form', 'standard', true),
    section('home-final', 'final_cta', 'standard', true),
  ];
}

function section(
  id: string,
  component: Section['component'],
  variant: string,
  enabled: boolean,
  headline?: string,
  body?: string,
): Section {
  return {
    id,
    component,
    variant,
    enabled,
    ...(headline ? { headline } : {}),
    ...(body ? { body } : {}),
  };
}

function licensedAssetEvidence(input: GenerateDeterministicSiteSpecInput): ProspectEvidence[] {
  if (getSupportedOwnedImageUrls(input.prospect).length > 0 || input.fallbackMediaAssetIds.length === 0) {
    return [];
  }

  return [{
    id: 'licensed-fallback-media',
    kind: 'licensed_asset',
    source: 'licensed fallback media pack',
    capturedAt: input.now,
    notes: 'Representative painting imagery for private preview concept; not prospect project work.',
  }];
}

function hasPublicTrustFacts(prospect: ProspectFacts): prospect is ProspectFacts & { rating: number; reviewCount: number } {
  const rating = prospect.rating;
  const reviewCount = prospect.reviewCount;

  return Number.isFinite(rating)
    && typeof rating === 'number'
    && rating >= 1
    && rating <= 5
    && Number.isInteger(reviewCount)
    && typeof reviewCount === 'number'
    && reviewCount >= 0;
}

function compareEvidence(left: ProspectEvidence, right: ProspectEvidence): number {
  return left.id.localeCompare(right.id);
}

function headlineFor(recipeKey: TemplateKey, primaryService: string): string {
  if (recipeKey === 'painting-premium') {
    return `${primaryService} That Makes Your Home Feel New Again`;
  }

  if (recipeKey === 'painting-gallery-first') {
    return `Professional ${primaryService} in Your Area`;
  }

  return 'Careful Preparation. Clean Worksites. A Finish Built to Last.';
}

function homeBody(recipeKey: TemplateKey, prospect: ProspectFacts): string {
  if (recipeKey === 'painting-gallery-first') {
    return `A private concept for presenting painting projects, services, and estimate requests around ${prospect.city}.`;
  }

  if (recipeKey === 'painting-premium') {
    return `A refined private concept for homeowners comparing painting services in ${prospect.city}.`;
  }

  return `A private painting website concept for ${prospect.city} homeowners who need a clear next step.`;
}

function pageTitle(path: string, service: SiteSpec['services'][number] | undefined): string {
  if (service) {
    return service.name;
  }

  const titles: Record<string, string> = {
    '/': 'Home',
    '/about': 'About',
    '/request-estimate': 'Request Estimate',
    '/interior-painting': 'Interior Painting',
    '/exterior-painting': 'Exterior Painting',
    '/cabinet-refinishing': 'Cabinet Refinishing',
  };

  return titles[path] ?? 'Painting Services';
}

function siteTitleFor(prospect: ProspectFacts): string {
  return fitText(`${prospect.businessName} | ${prospect.city} Painting`, 70);
}

function uniqueFirstSeen(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    unique.push(value);
  }

  return unique;
}

function defaultDescriptionFor(prospect: ProspectFacts): string {
  return fitText(
    `Private website concept for ${prospect.businessName}, a residential painting contractor serving ${prospect.city}, ${prospect.state}.`,
    170,
  );
}

function fitText(value: string, maxLength: number): string {
  const normalized = value.trim().replace(/\s+/g, ' ');

  if (normalized.length <= maxLength) {
    return normalized;
  }

  if (maxLength <= 1) {
    return normalized.slice(0, maxLength);
  }

  const clipped = normalized.slice(0, maxLength).replace(/\s+\S*$/, '').trim();

  return clipped.length > 0 ? clipped : normalized.slice(0, maxLength).trim();
}

function heroVariant(recipeKey: TemplateKey): string {
  return recipeKey === 'painting-premium' ? 'editorial' : recipeKey === 'painting-gallery-first' ? 'gallery_impact' : 'trust_split';
}

function serviceGridVariant(recipeKey: TemplateKey): string {
  return recipeKey === 'painting-premium' ? 'minimal_columns' : recipeKey === 'painting-gallery-first' ? 'image_cards' : 'trust_cards';
}

function galleryVariant(recipeKey: TemplateKey): string {
  return recipeKey === 'painting-premium' ? 'editorial_masonry' : recipeKey === 'painting-gallery-first' ? 'before_after_led' : 'clean_grid';
}

function reviewVariant(recipeKey: TemplateKey): string {
  return recipeKey === 'painting-premium' ? 'quiet_quotes' : recipeKey === 'painting-gallery-first' ? 'bold_quotes' : 'review_cards';
}

function slug(path: string): string {
  return path.replace(/^\//, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'home';
}
