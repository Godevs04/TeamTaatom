/**
 * Merges app.json with guaranteed EAS projectId.
 * Full native config (ios, android, plugins, etc.) lives in app.json.
 * Env-specific extra.* values are written by scripts/update-app-json.js (postinstall on EAS).
 */
const appJson = require('./app.json');

const EAS_PROJECT_ID = 'c3b80b3d-23d8-4948-abfa-80963e4192d0';
const expo = appJson.expo || appJson;

module.exports = ({ config }) => ({
  ...expo,
  ...config,
  extra: {
    ...expo.extra,
    ...config.extra,
    EXPO_PROJECT_ID:
      config.extra?.EXPO_PROJECT_ID || expo.extra?.EXPO_PROJECT_ID || EAS_PROJECT_ID,
    eas: {
      ...expo.extra?.eas,
      ...config.extra?.eas,
      projectId:
        config.extra?.eas?.projectId || expo.extra?.eas?.projectId || EAS_PROJECT_ID,
    },
  },
});
