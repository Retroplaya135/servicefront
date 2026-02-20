import type { TemplateKey } from '@servicefront/template-registry';
import { countSupportedOwnedImages } from './evidence-support.js';
import type { ProspectFacts } from './prospect-facts.js';
import { normalizeProspectServices } from './service-normalizer.js';

export function selectTemplateRecipe(facts: ProspectFacts): TemplateKey {
  const services = normalizeProspectServices(facts.services);
  const serviceNames = new Set(services.map((service) => service.key));
  const usableImageCount = countSupportedOwnedImages(facts);
  const premiumScore = scorePremium(facts, serviceNames, usableImageCount);
  const galleryScore = scoreGallery(facts, serviceNames, usableImageCount);

  if (premiumScore > galleryScore && premiumScore > 0) {
    return 'painting-premium';
  }

  if (galleryScore > premiumScore && galleryScore > 0) {
    return 'painting-gallery-first';
  }

  return 'painting-trusted-local';
}

function scorePremium(facts: ProspectFacts, serviceNames: ReadonlySet<string>, usableImageCount: number): number {
  let score = 0;

  if (serviceNames.has('cabinet_refinishing')) {
    score += 1;
  }

  if (/\b(premium|luxury|custom|fine finish|cabinet)\b/i.test(facts.notes ?? '')) {
    score += 1;
  }

  if (/\b(newport beach|laguna beach|beverly hills|palm beach|scottsdale)\b/i.test(facts.city)) {
    score += 1;
  }

  if (usableImageCount >= 3) {
    score += 1;
  }

  return score;
}

function scoreGallery(facts: ProspectFacts, serviceNames: ReadonlySet<string>, usableImageCount: number): number {
  let score = 0;

  if (usableImageCount >= 6) {
    score += 2;
  }

  if (serviceNames.has('exterior_painting') || serviceNames.has('residential_painting')) {
    score += 1;
  }

  if (/\b(instagram|facebook|portfolio|gallery|before after|before-and-after)\b/i.test(facts.notes ?? '')) {
    score += 1;
  }

  return score;
}
