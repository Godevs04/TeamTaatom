/**
 * AdMob configuration for Taatom.
 * app-ads.txt line: google.com, pub-6362359854606661, DIRECT, f08c47fec0942fa0
 *
 * Replace the placeholder ad unit IDs below with your real IDs from AdMob console:
 * AdMob → Apps → Your app → Ad units → use the IDs (e.g. ca-app-pub-6362359854606661/1234567890).
 */

export const ADMOB = {
  /** Publisher ID (used in app-ads.txt) */
  publisherId: 'pub-6362359854606661',

  /**
   * Android ad unit IDs.
   * Get these from AdMob → Your Android app → Ad units.
   * Use test IDs in development: ca-app-pub-3940256099942544/6300978111 (banner).
   */
  android: {
    banner: __DEV__
      ? 'ca-app-pub-3940256099942544/6300978111'
      : 'ca-app-pub-6362359854606661/XXXXXXXXXX', // Replace with your Android banner unit ID
    interstitial: __DEV__
      ? 'ca-app-pub-3940256099942544/1033173712'
      : 'ca-app-pub-6362359854606661/XXXXXXXXXX', // Replace with your Android interstitial unit ID
  },

  /**
   * iOS ad unit IDs.
   * Get these from AdMob → Your iOS app → Ad units.
   * Use test IDs in development: ca-app-pub-3940256099942544/2934735716 (banner).
   */
  ios: {
    banner: __DEV__
      ? 'ca-app-pub-3940256099942544/2934735716'
      : 'ca-app-pub-6362359854606661/XXXXXXXXXX', // Replace with your iOS banner unit ID
    interstitial: __DEV__
      ? 'ca-app-pub-3940256099942544/4411468910'
      : 'ca-app-pub-6362359854606661/XXXXXXXXXX', // Replace with your iOS interstitial unit ID
  },
};
