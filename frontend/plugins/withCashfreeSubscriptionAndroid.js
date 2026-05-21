/**
 * Cashfree Android SDK requires this manifest flag for subscription checkout callbacks.
 * @see https://www.cashfree.com/docs/payments/subscription/subscription_checkout_android_sdk
 */
const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

const META_NAME = 'cashfree_subscription_flow_enable';

function withCashfreeSubscriptionAndroid(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    app['meta-data'] = app['meta-data'] || [];

    const existing = app['meta-data'].find((item) => item.$?.['android:name'] === META_NAME);
    if (!existing) {
      app['meta-data'].push({
        $: {
          'android:name': META_NAME,
          'android:value': 'true',
          'tools:replace': 'android:value',
        },
      });
    } else {
      existing.$['android:value'] = 'true';
    }

    return config;
  });
}

module.exports = withCashfreeSubscriptionAndroid;
