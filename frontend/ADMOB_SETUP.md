# AdMob integration (Taatom)

## app-ads.txt

The line below is already set up:

```
google.com, pub-6362359854606661, DIRECT, f08c47fec0942fa0
```

- **Web:** Served at `https://your-domain.com/app-ads.txt` (see `web/public/app-ads.txt`). Deploy the web app and ensure your domain is listed in Google Play / App Store as the developer website so AdMob can verify.
- **AdMob:** In AdMob → Apps → Set up app-ads.txt, add your developer website domain and wait 24+ hours for verification.

## Mobile app (iOS / Android)

### 1. App IDs in app.json

Replace the placeholder App IDs in `app.json` (inside the `react-native-google-mobile-ads` plugin):

- **Android:** `ca-app-pub-6362359854606661~0000000000` → your Android app ID from AdMob (AdMob → Apps → Your Android app → App settings).
- **iOS:** `ca-app-pub-6362359854606661~0000000000` → your iOS app ID from AdMob.

Format: `ca-app-pub-6362359854606661~XXXXXXXXXX` (the part after `~` is your app’s ID in AdMob).

### 2. Ad unit IDs in constants/admob.js

Replace the placeholder ad unit IDs in `frontend/constants/admob.js`:

- **Production:** Replace each `ca-app-pub-6362359854606661/XXXXXXXXXX` with your real banner (and optional interstitial) unit IDs from AdMob → Your app → Ad units.
- **Development:** The file already uses Google’s test ad unit IDs in `__DEV__`, so test ads will show during development.

### 3. Show a banner in the app

Use the shared component anywhere (e.g. bottom of home feed, settings, or a dedicated “Promotions” section):

```jsx
import AdBanner from '../components/AdBanner';

// In your screen:
<AdBanner />
// or
<AdBanner size="LARGE_BANNER" />
```

Sizes: `BANNER` (default), `LARGE_BANNER`, `MEDIUM_RECTANGLE`, `FULL_BANNER`, `LEADERBOARD`.

### 4. Build

AdMob uses native code. Use a **development build** (e.g. `expo run:ios` / `expo run:android` or EAS Build). It will **not** run in Expo Go.

After updating App IDs or ad unit IDs, run a new native build (or at least `npx expo prebuild --clean` if you use prebuild).
