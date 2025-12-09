/**
 * TripScore v2 Configuration
 * 
 * Configuration constants for TripScore v2 trust level weighting and filtering.
 * These values control which trust levels contribute to TripScore calculations.
 */

/**
 * Trust levels that contribute to TripScore calculations
 * Only visits with trustLevel in ['high', 'medium'] are counted by default
 */
const TRUSTED_TRUST_LEVELS = ['high', 'medium'];

/**
 * Low trust level weight (0 = excluded, 0.2 = 20% weight, etc.)
 * Currently set to 0 to exclude low-trust visits from TripScore
 * Can be adjusted in future if founder wants low-trust visits to have minimal impact
 */
const LOW_TRUST_WEIGHT = 0;

/**
 * Whether to allow low-trust visits to contribute to TripScore
 * Currently disabled - only high and medium trust visits count
 */
const ALLOW_LOW_TRUST = false;

/**
 * Suspicious visit handling
 * Suspicious visits are never counted in TripScore, but are tracked for monitoring
 */
const ALLOW_SUSPICIOUS_TRUST = false;
const SUSPICIOUS_TRUST_WEIGHT = 0;

/**
 * Unverified visit handling
 * Unverified visits (manual-only locations) are excluded from TripScore
 */
const ALLOW_UNVERIFIED_TRUST = false;
const UNVERIFIED_TRUST_WEIGHT = 0;

/**
 * Fraud Detection Thresholds
 * These constants control when visits are marked as suspicious due to impossible travel patterns
 */
const MAX_REALISTIC_SPEED_KMH = 1000; // Maximum realistic travel speed in km/h (commercial flights ~900 km/h)
const MIN_DISTANCE_FOR_SPEED_CHECK_KM = 100; // Minimum distance (km) to trigger speed check (no need to check tiny hops)

module.exports = {
  TRUSTED_TRUST_LEVELS,
  LOW_TRUST_WEIGHT,
  ALLOW_LOW_TRUST,
  ALLOW_SUSPICIOUS_TRUST,
  SUSPICIOUS_TRUST_WEIGHT,
  ALLOW_UNVERIFIED_TRUST,
  UNVERIFIED_TRUST_WEIGHT,
  MAX_REALISTIC_SPEED_KMH,
  MIN_DISTANCE_FOR_SPEED_CHECK_KM
};

