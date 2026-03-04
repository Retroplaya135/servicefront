import { templateKeys, type TemplateRecipe } from '@servicefront/site-schema';
import { paintingGalleryFirstRecipe } from './recipes/painting-gallery-first.js';
import { paintingPremiumRecipe } from './recipes/painting-premium.js';
import { paintingTrustedLocalRecipe } from './recipes/painting-trusted-local.js';

export type TemplateKey = (typeof templateKeys)[number];

export class TemplateNotFoundError extends Error {
  constructor(readonly key: string) {
    super(`TEMPLATE_NOT_FOUND: ${key}`);
    this.name = 'TemplateNotFoundError';
  }
}

const recipes: Readonly<Record<TemplateKey, TemplateRecipe>> = {
  'painting-gallery-first': paintingGalleryFirstRecipe,
  'painting-premium': paintingPremiumRecipe,
  'painting-trusted-local': paintingTrustedLocalRecipe,
};

function cloneRecipe(recipe: TemplateRecipe): TemplateRecipe {
  return structuredClone(recipe);
}

export function getTemplateRecipe(key: TemplateKey): TemplateRecipe {
  const recipe = recipes[key];

  if (!recipe) {
    throw new TemplateNotFoundError(key);
  }

  return cloneRecipe(recipe);
}

export function listActiveTemplateRecipes(): TemplateRecipe[] {
  return templateKeys
    .map((key) => recipes[key])
    .filter((recipe) => recipe.status === 'active')
    .map(cloneRecipe);
}
