/**
 * Cashfree Android SDK requires this manifest flag for subscription checkout callbacks.
 * @see https://www.cashfree.com/docs/payments/subscription/subscription_checkout_android_sdk
 */
const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

function withCashfreeSubscriptionAndroid(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const app = AndroidConfig.getMainApplicationOrThrow(manifest);
    app['meta-data'] = app['meta-data'] || [];

    const name = 'cashfree_subscription_flow_enable';
    const existing = app['meta-data'].find(
      (item) => item.$?.['android:name'] === name,
    );
    if (!existing) {
      app['meta-data'].push({
        $: {
          'android:name': name,
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
