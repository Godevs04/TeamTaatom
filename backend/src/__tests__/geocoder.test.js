// Mock global.fetch BEFORE requiring geocoder.js so the local fetch variable binds to the mock
global.fetch = jest.fn().mockImplementation(() => {
  return Promise.resolve({
    json: () => Promise.resolve({
      status: 'OK',
      results: [
        {
          geometry: {
            location: {
              lat: 51.5007,
              lng: -0.1246
            }
          },
          formatted_address: 'Big Ben, London SW1A 0AA, UK',
          address_components: [
            {
              long_name: 'London',
              short_name: 'London',
              types: ['locality']
            },
            {
              long_name: 'England',
              short_name: 'ENG',
              types: ['administrative_area_level_1']
            },
            {
              long_name: 'United Kingdom',
              short_name: 'GB',
              types: ['country']
            }
          ]
        }
      ]
    })
  });
});

const { geocodeAddress } = require('../utils/geocoder');

describe('Geocoder Utility', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return null if address is empty or default', async () => {
    const res1 = await geocodeAddress('');
    const res2 = await geocodeAddress('Unknown Location');
    expect(res1).toBeNull();
    expect(res2).toBeNull();
  });

  it('should return null for non-canonical addresses if GOOGLE_MAPS_API_KEY is not set', async () => {
    process.env.GOOGLE_MAPS_API_KEY = '';
    const res = await geocodeAddress('Some Unknown Place');
    expect(res).toBeNull();
  });

  it('should successfully geocode and return parsed data', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'mock-key';
    const res = await geocodeAddress('Big Ben');
    expect(res).not.toBeNull();
    expect(res.lat).toBe(51.5007);
    expect(res.lng).toBe(-0.1246);
    expect(res.city).toBe('London');
    expect(res.country).toBe('United Kingdom');
    expect(res.continent).toBe('EUROPE');
  });

  it('should canonicalize London Eye without relying on generic geocoder ordering', async () => {
    process.env.GOOGLE_MAPS_API_KEY = '';
    const res = await geocodeAddress('London Eye');
    expect(res).not.toBeNull();
    expect(res.lat).toBe(51.503324);
    expect(res.lng).toBe(-0.119543);
    expect(res.city).toBe('London');
    expect(res.country).toBe('United Kingdom');
  });
});
