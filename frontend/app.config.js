/**
 * Merges app.json (or app.base.json on EAS) with guaranteed EAS projectId.
 * Env-specific extra.* values are written by scripts/update-app-json.js (postinstall on EAS).
 */
const fs = require('fs');
const path = require('path');

const EAS_PROJECT_ID = 'c3b80b3d-23d8-4948-abfa-80963e4192d0';

function loadExpoFromDisk() {
  for (const file of ['app.json', 'app.base.json']) {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return parsed.expo || parsed;
    }
  }
  throw new Error(
    'Missing app.json and app.base.json. Commit app.base.json (and app.json) under frontend/.',
  );
}

const expo = loadExpoFromDisk();

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
