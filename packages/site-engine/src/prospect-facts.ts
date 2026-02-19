import type { TemplateKey } from '@servicefront/template-registry';
import type { SiteSpec } from '@servicefront/site-schema';

export type ProspectEvidence = SiteSpec['provenance']['evidence'][number];

export type WebsiteCondition = 'none' | 'broken' | 'dated' | 'acceptable' | 'strong';

export type ProspectFacts = {
  businessName: string;
  phone: string;
  city: string;
  state: string;
  postalCode?: string;
  email?: string;
  ownerName?: string;
  websiteUrl?: string;
  websiteCondition?: WebsiteCondition;
  services: readonly string[];
  rating?: number;
  reviewCount?: number;
  latestReviewAt?: string;
  logoAssetId?: string;
  imageUrls?: readonly string[];
  notes?: string;
  evidence: readonly ProspectEvidence[];
};

export type GenerateDeterministicSiteSpecInput = {
  prospect: ProspectFacts;
  fallbackMediaAssetIds: readonly string[];
  now: string;
  idFactory: (label: string) => string;
  recipeOverride?: TemplateKey;
};
