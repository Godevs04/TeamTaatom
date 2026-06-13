/**
 * Bump when profile onboarding flow changes and all users should run it again once.
 * @type {number}
 */
const PROFILE_ONBOARDING_VERSION = 2;

/** Onboarding validation limits — keep in sync with frontend constants. */
const ONBOARDING_MIN_LANGUAGES = 1;
const ONBOARDING_MAX_LANGUAGES = 8;

module.exports = {
  PROFILE_ONBOARDING_VERSION,
  ONBOARDING_MIN_LANGUAGES,
  ONBOARDING_MAX_LANGUAGES,
};
