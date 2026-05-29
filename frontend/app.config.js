/**
 * Ensures EAS / expo-updates always see extra.eas.projectId.
 * app.json is still updated by scripts/update-app-json.js for env-specific values.
 */
const EAS_PROJECT_ID = 'c3b80b3d-23d8-4948-abfa-80963e4192d0';

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    EXPO_PROJECT_ID: config.extra?.EXPO_PROJECT_ID || EAS_PROJECT_ID,
    eas: {
      ...config.extra?.eas,
      projectId: config.extra?.eas?.projectId || EAS_PROJECT_ID,
    },
  },
});
