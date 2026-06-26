/**
 * Feature Flags
 *
 * Central toggle file for features under compliance/business hold.
 * Flip a flag to `false` to re-enable the feature once cleared.
 */

/**
 * SUBSCRIPTION_COMING_SOON
 *
 * Set to `true` while the subscription / paid-creator feature is under
 * compliance review. When `true`, all subscription UI surfaces are replaced
 * with a non-interactive "Coming Soon" state. All existing subscription code
 * is retained and will resume working the moment this is set to `false`.
 */
export const SUBSCRIPTION_COMING_SOON = true;
