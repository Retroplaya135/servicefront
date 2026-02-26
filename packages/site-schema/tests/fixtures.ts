type JsonObject = { [key: string]: JsonValue };
type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;

export interface RawSiteSpecFixture {
  schemaVersion: number;
  contact: {
    phone: string;
    [key: string]: JsonValue;
  };
  pages: Array<{
    sections: Array<{
      component: string;
      [key: string]: JsonValue;
    }>;
    [key: string]: JsonValue;
  }>;
  [key: string]: JsonValue;
}

export const minimalPaintingSiteFixture: RawSiteSpecFixture = {
  schemaVersion: 1,
  identity: {
    displayName: 'Schema Test Painting',
    businessType: 'painting_contractor',
    city: 'Manteca',
    state: 'CA',
  },
  contact: {
    phone: '+12025550123',
    primaryCta: 'request_estimate',
  },
  services: [
    {
      key: 'interior_painting',
      name: 'Interior Painting',
      summary: 'Careful preparation and clean interior painting for lived-in homes.',
      enabled: true,
    },
  ],
  pages: [
    {
      path: '/',
      title: 'Home',
      enabled: true,
      sections: [
        {
          id: 'home-hero',
          component: 'hero',
          variant: 'trust_split',
          enabled: true,
        },
      ],
    },
  ],
  theme: {
    recipeKey: 'painting-trusted-local',
    accent: '#244A3B',
    tone: 'balanced',
  },
  seo: {
    siteTitle: 'Schema Test Painting Demo',
    defaultDescription: 'Fictional schema test fixture for a local residential painting company.',
    robots: 'noindex,nofollow,noarchive',
  },
  forms: {
    estimateFormEnabled: true,
    successMessage: 'Thanks. This schema test form does not contact a real business.',
  },
  provenance: {
    generatedAt: '2026-08-30T20:00:00Z',
    generationMode: 'fictional_demo',
    evidence: [],
  },
};
