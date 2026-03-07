# Post Module – Developer Guide

In-depth technical documentation for the **Post** (create post / create short) module.

---

## 1. Purpose & User Flow

- **Screen:** `app/(tabs)/post.tsx` (tab: Post).
- **Purpose:** Create a **photo post** (single or carousel) or a **short** (video with optional music). Supports caption, location (current/EXIF/search), hashtags, and for shorts: song selection, trim, volume.
- **User flow:** User selects media (gallery/camera) → optionally adds location → adds caption/hashtags → for shorts selects song and trim → submits; progress and success/error are shown.

---

## 2. Key Functionality

| Feature | Description |
|---------|-------------|
| **Photo post** | Pick multiple images (max 10), optional location, caption; `createPostWithProgress`. |
| **Short** | Pick or record video, optional thumbnail, caption; optional song from library (start/end trim, volume); copyright acceptance; `createShort` / upload with progress. |
| **Location** | Current location, EXIF from media, or search (place name); sends `address`, `latitude`, `longitude`, `hasExifGps`, `source`, `takenAt`, `detectedPlace` for TripScore. |
| **Songs** | Shorts: `songs` service for library; SongSelector for trim (min 0.5s); `songId`, `songStartTime`, `songEndTime`, `songVolume`. |
| **Validation** | At least one image (post) or one video (short); signed-in check; max 10 images. |
| **Permissions** | Photo library / camera requested with custom messages; errors shown via CustomAlert/useAlert. |
| **Place search** | Search place by name; populate location fields; admin review message when place details sent. |

---

## 3. Backend API Used

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/posts` | Create photo post (FormData: images, caption, address, lat/long, hasExifGps, takenAt, source, fromCamera, songId, songStartTime, songEndTime, songVolume, spotType, travelInfo, detectedPlace*). |
| POST | `/api/v1/shorts` | Create short (FormData: video, optional image, caption, location, song*, copyrightAccepted, etc.). |

**Request (post):** `CreatePostData` in `services/posts.ts`: images[], caption, address?, latitude?, longitude?, hasExifGps?, takenAt?, source?, fromCamera?, songId?, songStartTime?, songEndTime?, songVolume?, spotType?, travelInfo?, detectedPlace?.

**Request (short):** `CreateShortData`: video { uri, type, name }, image?, caption, audioSource?, copyrightAccepted?, tags?, address?, lat/long?, song*.

---

## 4. Types & Schemas

- **CreatePostData / CreateShortData:** See `services/posts.ts`.
- **PostType:** `types/post.ts` (user, caption, imageUrl/images, videoUrl, location, likes, comments, song, etc.).
- **Locale / place:** Location search may use `search.ts` (location search) or similar; detected place sent as separate fields for admin review.

---

## 5. Components & Services

- **Screen:** `app/(tabs)/post.tsx` (large file: state, picker flows, form, submit).
- **Services:** `posts.ts` (`createPostWithProgress`, `createShort`), `songs.ts`, `search.ts` (location), `locationExtraction.ts` (EXIF).
- **Components:** SongSelector, ImageEditModal, NavBar, CustomAlert/useAlert for errors and success.
- **Utils:** Permissions (expo-image-picker, expo-camera), haptics, analytics.

---

## 6. Technical Logic (Summary)

- **Progress:** `createPostWithProgress` accepts `onProgress(0–1)`; axios `onUploadProgress` used to report upload progress.
- **FormData:** All post/short fields appended as FormData; arrays (e.g. images) appended in loop; booleans as `'true'`/`'false'`.
- **Location source:** `source` enum: `taatom_camera_live` | `gallery_exif` | `gallery_no_exif` | `manual_only`.
- **Detected place:** If present, sent as separate fields (detectedPlaceName, detectedPlaceCountry, etc.) for backend/admin.
- **Shorts:** Video + optional cover image; song trim enforced (e.g. min 0.5s); copyright acceptance required when using library music.

---

## 7. File Map

| File | Role |
|------|------|
| `app/(tabs)/post.tsx` | Create post/short UI, state, validation, submit. |
| `services/posts.ts` | createPostWithProgress, createShort; getPosts, like, comment, etc. |
| `services/songs.ts` | Song list, search by genre for shorts. |
| `services/search.ts` | Location search for place name. |
| `components/SongSelector.tsx` | Song picker and trim UI. |
| `types/post.ts` | PostType, CreatePostData/CreateShortData in posts.ts. |

---

## 8. CreatePostData – full schema (technical)

```ts
interface CreatePostData {
  images: Array<{ uri: string; type: string; name: string }>;
  caption: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  hasExifGps?: boolean;
  takenAt?: Date;
  source?: 'taatom_camera_live' | 'gallery_exif' | 'gallery_no_exif' | 'manual_only';
  fromCamera?: boolean;
  songId?: string;
  songStartTime?: number;
  songEndTime?: number;
  songVolume?: number;
  spotType?: string;
  travelInfo?: string;
  detectedPlace?: {
    name?: string; country?: string; countryCode?: string; city?: string;
    stateProvince?: string; continent?: string; latitude?: number; longitude?: number;
    placeId?: string; formattedAddress?: string;
  };
}
```

**FormData append rules (posts):** Each image appended as `formData.append('images', { uri, type, name })`. Scalar fields: caption (required), address, latitude, longitude as string; hasExifGps, fromCamera as `'true'`/`'false'`; takenAt as ISO string; source as string; songId, songStartTime, songEndTime, songVolume; spotType, travelInfo. detectedPlace: each key sent as `detectedPlaceName`, `detectedPlaceCountry`, `detectedPlaceCountryCode`, `detectedPlaceCity`, `detectedPlaceStateProvince`, `detectedPlaceLatitude`, `detectedPlaceLongitude`, `detectedPlacePlaceId`, `detectedPlaceFormattedAddress` (empty string if missing). Content-Type header set to `undefined` so browser sets multipart boundary.

---

## 9. CreateShortData – full schema (technical)

```ts
interface CreateShortData {
  video: { uri: string; type: string; name: string };
  image?: { uri: string; type: string; name: string };
  caption: string;
  audioSource?: 'taatom_library' | 'user_original';
  copyrightAccepted?: boolean;
  copyrightAcceptedAt?: string;
  tags?: string[];
  address?: string; latitude?: number; longitude?: number;
  hasExifGps?: boolean; takenAt?: Date; source?: string; fromCamera?: boolean;
  songId?: string; songStartTime?: number; songEndTime?: number; songVolume?: number;
  spotType?: string; travelInfo?: string;
}
```

**FormData (shorts):** `formData.append('video', { uri, type, name })`; optional `formData.append('image', ...)`. caption, tags (JSON.stringify if array), address, lat/long, hasExifGps, takenAt, source, fromCamera, song fields, spotType, travelInfo. audioSource and copyrightAccepted/copyrightAcceptedAt for backend compliance. Upload uses axios with `onUploadProgress`; optional timeout and progress stall detection in createShortWithProgress.

---

## 10. Validation rules (UI layer)

| Rule | Check | User message / behaviour |
|------|--------|---------------------------|
| Signed in | `getUserFromStorage()` or token | "You must be signed in to post." |
| Post: at least one image | `selectedImages.length >= 1` | "Please select at least one image first." |
| Post: max 10 images | `selectedImages.length <= 10` | "Maximum 10 images are allowed" (or similar). |
| Short: one video | video asset selected | "Please select a video first." |
| Short: song trim | If song selected, end - start >= 0.5s | "Please select at least 0.5 seconds of the song." |
| Short: song selected when using library | If audioSource is taatom_library, songId required | "Please select a song first." / validation before submit. |
| Copyright | When using library music, copyright acceptance required | Checkbox/flow before submit. |

All errors surfaced via useAlert (showError) or CustomAlert so no default system Alert.

---

## 11. Progress callback (createPostWithProgress / createShortWithProgress)

- **createPostWithProgress(data, onProgress):** Axios config `onUploadProgress: (e) => { if (e.total) onProgress?.(e.loaded / e.total); }`. Progress 0–1 used in UI progress bar.
- **createShortWithProgress(data, onProgress):** Same pattern; service may also implement timeout (e.g. DEFAULT_TIMEOUT) and stall detection (progress not advancing) with warning log; response may be JSON or need manual parse in edge cases.

---

## 12. Permissions (functional)

- **Photo library (pick):** Request with expo-image-picker; on denial show CustomAlert/useAlert: "Please grant photo library permissions." (or "Permission needed"). Same for camera (capture).
- **Camera (record video / take photo):** Request camera permission; on denial show message; retry after user enables in settings.
- **Location (optional):** For "current location" or EXIF; if denied, location fields left empty or user can search place manually.

---

## 13. Location flow (technical)

- **Current location:** Expo Location or similar; get coords then reverse-geocode for address (or send only coords); set `source: 'manual_only'` or appropriate value.
- **EXIF:** locationExtraction or asset metadata; read GPS and optionally takenAt; set hasExifGps, takenAt, source `gallery_exif` or `gallery_no_exif`.
- **Search:** User types place name → searchLocation (search.ts) → pick result → fill address, latitude, longitude; for admin review also populate detectedPlace (name, country, city, etc.) and send as separate FormData fields.

---

## 14. Post submit flow (step-by-step)

1. User taps Submit (post mode).
2. Validate: signed in, at least one image, max 10 images; else showError and return.
3. Build CreatePostData: images from state, caption, location fields from state (address, lat, long, hasExifGps, takenAt, source, fromCamera), optional detectedPlace, optional song fields for carousel-with-music if applicable.
4. Call `createPostWithProgress(data, (p) => setUploadProgress(p))`.
5. On success: showSuccess (e.g. "Your post has been shared."), clear form, optionally navigate (e.g. to home or profile).
6. On error: showError(parsedError.userMessage).

---

## 15. Short submit flow (step-by-step)

1. User taps Submit (short mode).
2. Validate: signed in, video selected; if using library song then song + trim (≥ 0.5s) and copyright accepted.
3. Build CreateShortData: video, optional image, caption, audioSource, copyrightAccepted/copyrightAcceptedAt, tags, location fields, song fields.
4. Call `createShortWithProgress(data, (p) => setUploadProgress(p))`.
5. On success: showSuccess ("Your short has been uploaded."), clear form, navigate or stay.
6. On error: showError; handle timeout/stall if service throws.

---

## 16. Place search & admin review

- **API:** `GET /api/v1/search/location` with query; returns list of places.
- **UI:** User selects a place; form fills address, lat, long; optionally a "detected place" object is built (name, country, city, stateProvince, placeId, formattedAddress, etc.) for backend.
- **Admin review:** Backend may use detectedPlace* fields to suggest or approve location for TripScore; frontend shows success message like "Place details populated! The place will be sent for admin review when you submit the post."

---

*Feed that shows these posts: [01-HOME-MODULE.md](./01-HOME-MODULE.md). Backend API list: [11-BACKEND-API-REFERENCE.md](./11-BACKEND-API-REFERENCE.md).*
