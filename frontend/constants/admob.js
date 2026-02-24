/**
 * AdMob configuration for Taatom.
 * app-ads.txt line: google.com, pub-6362359854606661, DIRECT, f08c47fec0942fa0
 *
 * IMPORTANT: App ID vs Ad Unit ID
 * - App ID (e.g. ca-app-pub-6362359854606661~9610954911): Identifies your app in AdMob.
 *   Set in app.json plugin "react-native-google-mobile-ads" (androidAppId / iosAppId).
 *   One per app (or one per platform if you have separate iOS/Android apps in AdMob).
 * - Ad Unit ID (e.g. ca-app-pub-6362359854606661/3257756403): Identifies a specific ad placement.
 *   Use test unit IDs in __DEV__ to avoid invalid traffic (Apple/Google policy).
 *   Use production unit IDs only in production builds.
 *
 * Apple policy: Do not use production ad unit IDs in development; use test IDs to avoid
 * invalid traffic and policy violations. See AdMob testing docs.
 */

export const ADMOB = {
  /** Publisher ID (used in app-ads.txt) */
  publisherId: 'pub-6362359854606661',

  /**
   * Android ad unit IDs.
   * Get these from AdMob → Your Android app → Ad units.
   * In __DEV__ we use test IDs (see NativeAdCard for native test ID).
   */
  android: {
    banner: __DEV__
      ? 'ca-app-pub-3940256099942544/6300978111'
      : 'ca-app-pub-6362359854606661/XXXXXXXXXX',
    interstitial: __DEV__
      ? 'ca-app-pub-3940256099942544/1033173712'
      : 'ca-app-pub-6362359854606661/XXXXXXXXXX',
    /** Native Advanced (in-feed) ad unit. Production: ca-app-pub-6362359854606661/3257756403 */
    native: __DEV__
      ? 'ca-app-pub-3940256099942544/2247696110'
      : 'ca-app-pub-6362359854606661/3257756403',
  },

  /**
   * iOS ad unit IDs.
   * Get these from AdMob → Your iOS app → Ad units.
   */
  ios: {
    banner: __DEV__
      ? 'ca-app-pub-3940256099942544/2934735716'
      : 'ca-app-pub-6362359854606661/XXXXXXXXXX',
    interstitial: __DEV__
      ? 'ca-app-pub-3940256099942544/4411468910'
      : 'ca-app-pub-6362359854606661/XXXXXXXXXX',
    /** Native Advanced (in-feed) ad unit. Production: ca-app-pub-6362359854606661/3257756403 */
    native: __DEV__
      ? 'ca-app-pub-3940256099942544/3986624511'
      : 'ca-app-pub-6362359854606661/3257756403',
  },
};
