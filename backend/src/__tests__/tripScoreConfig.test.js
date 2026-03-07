/**
 * Unit tests for TripScore config (no MongoDB required).
 * These run in CI; integration tests in other files are skipped when MONGO_URL is not set.
 */

const {
  TRUSTED_TRUST_LEVELS,
  VERIFIED_STATUSES,
  ALLOW_LOW_TRUST,
  ALLOW_SUSPICIOUS_TRUST,
  MAX_REALISTIC_SPEED_KMH,
  MIN_DISTANCE_FOR_SPEED_CHECK_KM
} = require('../config/tripScoreConfig');

describe('tripScoreConfig (unit)', () => {
  it('exports TRUSTED_TRUST_LEVELS as array with high and medium', () => {
    expect(TRUSTED_TRUST_LEVELS).toEqual(['high', 'medium']);
  });

  it('exports VERIFIED_STATUSES for TripScore v2.1', () => {
    expect(VERIFIED_STATUSES).toContain('auto_verified');
    expect(VERIFIED_STATUSES).toContain('approved');
    expect(VERIFIED_STATUSES).toHaveLength(2);
  });

  it('disables low-trust and suspicious contributions by default', () => {
    expect(ALLOW_LOW_TRUST).toBe(false);
    expect(ALLOW_SUSPICIOUS_TRUST).toBe(false);
  });

  it('exports fraud detection thresholds', () => {
    expect(MAX_REALISTIC_SPEED_KMH).toBe(1000);
    expect(MIN_DISTANCE_FOR_SPEED_CHECK_KM).toBe(100);
  });
});
