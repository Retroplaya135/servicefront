import { SiteSpecSchema, type SiteSpec } from '@servicefront/site-schema';
import {
  paintingGalleryFirstFixture,
  paintingPremiumFixture,
  paintingTrustedLocalFixture,
} from '@servicefront/test-utils';
import { describe, expect, test } from 'vitest';
import paintingGalleryFirstExample from '../../../examples/site-painting-gallery-first.json' with { type: 'json' };
import paintingPremiumExample from '../../../examples/site-painting-premium.json' with { type: 'json' };
import paintingTrustedLocalExample from '../../../examples/site-painting-trusted-local.json' with { type: 'json' };
import { getTemplateRecipe, listActiveTemplateRecipes, type TemplateKey } from '../src/registry.js';

const expectedTemplateKeys = [
  'painting-gallery-first',
  'painting-premium',
  'painting-trusted-local',
] as const;

const fixtureByTemplateKey: Record<TemplateKey, SiteSpec> = {
  'painting-gallery-first': paintingGalleryFirstFixture,
  'painting-premium': paintingPremiumFixture,
  'painting-trusted-local': paintingTrustedLocalFixture,
};

const exampleByTemplateKey: Record<TemplateKey, unknown> = {
  'painting-gallery-first': paintingGalleryFirstExample,
  'painting-premium': paintingPremiumExample,
  'painting-trusted-local': paintingTrustedLocalExample,
};

describe('painting template registry', () => {
  test('registers exactly three active painting recipes', () => {
    expect(listActiveTemplateRecipes().map((recipe) => recipe.key).sort()).toEqual(expectedTemplateKeys);
  });

  test('recipes expose intentionally distinct hero and gallery variants', () => {
    const recipes = listActiveTemplateRecipes();

    expect(new Set(recipes.flatMap((recipe) => recipe.componentVariants.hero)).size).toBe(3);
    expect(new Set(recipes.flatMap((recipe) => recipe.componentVariants.project_gallery)).size).toBe(3);
  });

  test('unknown recipe lookup fails explicitly', () => {
    expect(() => getTemplateRecipe('unknown' as never)).toThrow(/TEMPLATE_NOT_FOUND/);
  });

  test('exports validated fictional SiteSpec fixtures for each active recipe', () => {
    for (const key of expectedTemplateKeys) {
      const fixture = fixtureByTemplateKey[key];
      const parsed = SiteSpecSchema.parse(fixture);

      expect(fixture).toEqual(exampleByTemplateKey[key]);
      expect(parsed.theme.recipeKey).toBe(key);
      expect(parsed.provenance.generationMode).toBe('fictional_demo');
      expect(parsed.testimonials?.every((testimonial) => testimonial.sourceType === 'fictional_demo')).toBe(
        true,
      );
    }
  });

  test('lookups and listings cannot mutate the global registry', () => {
    const listedRecipe = listActiveTemplateRecipes()[0]!;
    const lookedUpRecipe = getTemplateRecipe('painting-premium');

    listedRecipe.componentVariants.hero!.push('mutated');
    lookedUpRecipe.tokens.accentOptions[0] = '#FFFFFF';

    const listedAgain = listActiveTemplateRecipes();
    const lookedUpAgain = getTemplateRecipe('painting-premium');

    expect(listedAgain[0]?.componentVariants.hero).not.toContain('mutated');
    expect(lookedUpAgain.tokens.accentOptions[0]).toBe('#8A6A4A');
  });
});
