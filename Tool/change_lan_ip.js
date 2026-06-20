const fs = require('fs');
const path = require('path');

const newIp = process.argv[2];
if (!newIp) {
  console.error('ERROR: Please specify the new LAN IP: node change_lan_ip.js <LAN_IP>');
  process.exit(1);
}

const projectRoot = path.join(__dirname, '..');
console.log(`Updating LAN IP to ${newIp} across all configurations...`);

// Helper to update a file if it exists
function updateFile(filePath, regex, replacement) {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(projectRoot, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }
  let content = fs.readFileSync(fullPath, 'utf8');
  content = content.replace(regex, replacement);
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`Successfully updated: ${filePath}`);
}

// 1. Update frontend/.env
updateFile(
  'frontend/.env',
  /^(API_BASE_URL=)http:\/\/[0-9A-Za-z\.-]+(:[0-9]+)/m,
  `$1http://${newIp}$2`
);
updateFile(
  'frontend/.env',
  /^(EXPO_PUBLIC_API_BASE_URL=)http:\/\/[0-9A-Za-z\.-]+(:[0-9]+)/m,
  `$1http://${newIp}$2`
);
updateFile(
  'frontend/.env',
  /^(EXPO_PUBLIC_WEB_SHARE_URL=)http:\/\/[0-9A-Za-z\.-]+(:[0-9]+)/m,
  `$1http://${newIp}$2`
);
updateFile(
  'frontend/.env',
  /^(EXPO_PUBLIC_PRIVACY_POLICY_URL=)http:\/\/[0-9A-Za-z\.-]+(:[0-9]+)/m,
  `$1http://${newIp}$2`
);
updateFile(
  'frontend/.env',
  /^(EXPO_PUBLIC_TERMS_OF_SERVICE_URL=)http:\/\/[0-9A-Za-z\.-]+(:[0-9]+)/m,
  `$1http://${newIp}$2`
);
updateFile(
  'frontend/.env',
  /^(EXPO_PUBLIC_SUPPORT_URL=)http:\/\/[0-9A-Za-z\.-]+(:[0-9]+)/m,
  `$1http://${newIp}$2`
);

// 2. Update backend/.env
updateFile(
  'backend/.env',
  /^(FRONTEND_URL=http:\/\/)[0-9\.]+(:[0-9]+)/m,
  `$1${newIp}$2`
);
updateFile(
  'backend/.env',
  /^(WEB_FRONTEND_URL=http:\/\/)[0-9\.]+(:[0-9]+)/m,
  `$1${newIp}$2`
);
updateFile(
  'backend/.env',
  /^(API_BASE_URL=http:\/\/)[0-9\.]+(:[0-9]+)/m,
  `$1${newIp}$2`
);
updateFile(
  'backend/.env',
  /^(SUPERADMIN_URL=http:\/\/)[0-9\.]+(:[0-9]+)/m,
  `$1${newIp}$2`
);

// 3. Update backend/src/app.js (CORS patterns & devPatterns)
const appJsPath = path.join(projectRoot, 'backend/src/app.js');
if (fs.existsSync(appJsPath)) {
  let appJs = fs.readFileSync(appJsPath, 'utf8');
  
  // Replace direct IP strings (like 'http://192.168.1.10:8081')
  appJs = appJs.replace(/'http:\/\/192\.168\.[0-9]+\.[0-9]+(:[0-9]+)'/g, `'http://${newIp}$1'`);
  appJs = appJs.replace(/"http:\/\/192\.168\.[0-9]+\.[0-9]+(:[0-9]+)"/g, `"http://${newIp}$1"`);
  appJs = appJs.replace(/'http:\/\/10\.[0-9]+\.[0-9]+\.[0-9]+(:[0-9]+)'/g, `'http://${newIp}$1'`);
  appJs = appJs.replace(/"http:\/\/10\.[0-9]+\.[0-9]+\.[0-9]+(:[0-9]+)"/g, `"http://${newIp}$1"`);
  
  // Ensure both 192.168.x.x and 10.x.x.x are in devPatterns array
  if (appJs.includes('/^http:\\/\\/192\\.168\\.\\d+\\.\\d+:\\d+$/') && !appJs.includes('/^http:\\/\\/10\\.\\d+\\.\\d+\\.\\d+:\\d+$/')) {
    appJs = appJs.replace(
      /(\/\^http:\\\/\\\/192\\\.168\\\.\\d\+\\\.\\d\+:\\d\+\$\/,)/,
      `$1\n      /^http:\\/\\/10\\.\\d+\\.\\d+\\.\\d+:\\d+$/,`
    );
  }
  
  fs.writeFileSync(appJsPath, appJs, 'utf8');
  console.log('Successfully updated CORS patterns in backend/src/app.js');
}

// 4. Update superAdmin/.env
updateFile(
  'superAdmin/.env',
  /^(VITE_API_URL=http:\/\/)[0-9\.]+(:[0-9]+)/m,
  `$1${newIp}$2`
);

// 5. Update web/.env.local
updateFile(
  'web/.env.local',
  /^(BACKEND_ORIGIN=)http:\/\/[0-9\.]+(:[0-9]+)/m,
  `$1http://${newIp}$2`
);
updateFile(
  'web/.env.local',
  /^(NEXT_PUBLIC_WEB_URL=)http:\/\/[0-9\.]+(:[0-9]+)/m,
  `$1http://${newIp}$2`
);
updateFile(
  'web/.env.local',
  /^(BACKEND_PROXY_TARGET=)http:\/\/[0-9\.]+(:[0-9]+)/m,
  `$1http://${newIp}$2`
);

console.log('IP Update completed successfully.');
