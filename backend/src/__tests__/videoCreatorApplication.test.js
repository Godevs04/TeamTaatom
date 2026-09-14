const {
  validateCreatorApplication,
} = require('../constants/videoCreatorApplication');

describe('validateCreatorApplication', () => {
  const valid = {
    contentNiche: 'travel_vlogs',
    experienceLevel: 'intermediate',
    sampleLinks: 'https://youtube.com/watch?v=abc123',
    postingFrequency: 'monthly',
    audienceRegions: 'India, Southeast Asia',
    equipment: 'iPhone 15',
    whyTaatom: 'I want to share authentic travel stories with travelers.',
    guidelinesAccepted: true,
  };

  it('accepts a complete application', () => {
    const result = validateCreatorApplication({ application: valid });
    expect(result.ok).toBe(true);
    expect(result.application.contentNiche).toBe('travel_vlogs');
    expect(result.application.guidelinesAccepted).toBe(true);
  });

  it('requires guidelines acceptance', () => {
    const result = validateCreatorApplication({
      application: { ...valid, guidelinesAccepted: false },
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/guidelines/i);
  });

  it('requires niche detail when other', () => {
    const result = validateCreatorApplication({
      application: { ...valid, contentNiche: 'other', contentNicheOther: '' },
    });
    expect(result.ok).toBe(false);
  });

  it('requires sample links', () => {
    const result = validateCreatorApplication({
      application: { ...valid, sampleLinks: 'short' },
    });
    expect(result.ok).toBe(false);
  });
});
