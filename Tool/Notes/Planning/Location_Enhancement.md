Cursor Prompt – Enhance Location Fetching + Metadata for Posts & Shorts

You are an AI pair programmer working on the TeamTaatom React Native (Expo) + Express + MongoDB app.
Your task is to fully implement and standardize Location Fetching + Metadata for Posts and Shorts, so that TripScore v2 can use accurate, trustworthy location information derived from the media (EXIF, asset info, GPS), not just manual input.

The focus here is frontend + API payload and small adjustments to how backend reads metadata.
TripScore v2 backend logic already exists (TripVisit, trustLevel, etc.) — we must feed it correct data.

0. High-Level Goals

When user uploads a photo (post) or video (short), we should:

Try to get real capture location from:

EXIF GPS (if available)

Asset location via MediaLibrary.getAssetInfoAsync

As a fallback, device GPS at selection/capture time

Optionally allow manual location selection as last fallback.

For every upload, we must send to backend:

latitude, longitude

address (reverse-geocoded)

hasExifGps: boolean

takenAt: Date (from media EXIF/asset if available)

source: 'taatom_camera_live' | 'gallery_exif' | 'gallery_no_exif' | 'manual_only'

fromCamera: boolean (true if in-app camera used)

Apply the same logic to:

createPost (photo post)

createShort (video short)

So backend TripVisit logic can classify:

high trust (in-app camera + GPS),

medium trust (gallery EXIF),

low/unverified (no EXIF, manual).

1. Frontend – LocationExtractionService
1.1 Create/Update a common location extraction helper

Locate the existing LocationExtractionService file (or equivalent) that is currently used for posts & shorts.

Goal: Define a single function that can be used by both post and short upload flows:

// Example signature – adjust name/file as per your project
export type ExtractedLocation = {
  lat: number | null;
  lng: number | null;
  address?: string | null;

  hasExifGps: boolean;      // true if location came from EXIF/asset embedded GPS
  takenAt?: Date | null;    // capture date from EXIF or asset metadata

  // For deciding source:
  // - 'exif'   => gallery with GPS in EXIF/asset.location
  // - 'asset'  => asset-based but no explicit EXIF GPS (if you differentiate)
  // - 'manual' => user-picked/typed
  rawSource: 'exif' | 'asset' | 'manual' | 'none';
};

export async function extractLocationFromMedia(
  assets: ImagePicker.ImagePickerAsset[],
  fallbackNow: Date
): Promise<ExtractedLocation | null> {
  // Implementation details (see below)
}

1.2 Implement extraction strategies (priority order)

Inside extractLocationFromMedia:

Strategy 1 – EXIF / asset location

For each asset:

Use MediaLibrary.getAssetInfoAsync(asset.assetId) (or equivalent) with includeExtra: true.

If assetInfo.location (or assetInfo.exif with GPS) exists:

Use its latitude, longitude.

Set hasExifGps = true.

Set takenAt from:

EXIF DateTimeOriginal or

assetInfo.creationTime if available.

Set rawSource = 'exif'.

Strategy 2 – Asset-based fallback (no explicit EXIF, but still location)

If EXIF GPS is not present but assetInfo.location has coordinates:

Use those coordinates.

hasExifGps = false.

takenAt = assetInfo.creationTime if available.

rawSource = 'asset'.

Strategy 3 – Device GPS fallback

If no EXIF/asset location found:

Optionally call Location.getCurrentPositionAsync (Expo Location) to get current device location.

This is not where the image was originally taken if it’s an old photo, but is better than nothing for new captures.

In this case:

hasExifGps = false.

takenAt = fallbackNow.

rawSource = 'none' (we’ll map this to manual or gallery_no_exif depending on UI flow).

Reverse geocode

For whichever lat/lng you finally choose:

Reverse-geocode to human-readable address (using your existing Google Maps / Expo Location reverse geocode function).

Return ExtractedLocation object described above.

If no location at all, return null.

2. Frontend – Posts Upload Flow

Locate the post creation screen & service:

Screen: something like frontend/app/(tabs)/post.tsx

Service: frontend/services/posts.ts (or similar) with createPost(data: CreatePostData)

2.1 Extend CreatePostData

In the CreatePostData type/interface used by createPost:

export interface CreatePostData {
  images: { uri: string; type: string; name: string }[];

  caption: string;

  address?: string;
  latitude?: number;
  longitude?: number;

  // Add these:
  hasExifGps?: boolean;
  takenAt?: Date;
  source?: 'taatom_camera_live' | 'gallery_exif' | 'gallery_no_exif' | 'manual_only';
  fromCamera?: boolean; // true if taken via in-app camera
}

2.2 When picking media for a post

In the post screen:

When user selects gallery photos:

Use launchImageLibraryAsync({ allowsMultipleSelection: true, exif: true }).

Pass the returned assets into extractLocationFromMedia(assets, new Date()).

If extraction returns a location:

Set local state: lat, lng, address.

Set hasExifGps and takenAt.

Set a rawSource in local state too.

Decide source for TripScore v2:

If this is a gallery selection:

let source: CreatePostData['source'];

if (locationResult?.rawSource === 'exif') {
  source = 'gallery_exif';
} else if (locationResult && locationResult.lat && locationResult.lng) {
  // We have some location, but not from explicit EXIF GPS
  source = 'gallery_no_exif';
} else {
  // No location at all yet, might later be manual
  source = 'manual_only';
}


If this post came from in-app camera (you have a separate camera flow):

Set source = 'taatom_camera_live'.

fromCamera = true.

When user manually edits / selects location on a map:

Update lat/lng, address in state.

If there was no EXIF/asset location, keep or change source to 'manual_only'.

2.3 Build the payload and call createPost

When user submits:

const data: CreatePostData = {
  images: selectedImages,
  caption,
  address: locationResult?.address ?? manualAddress ?? undefined,
  latitude: locationResult?.lat ?? manualLat ?? undefined,
  longitude: locationResult?.lng ?? manualLng ?? undefined,

  hasExifGps: !!locationResult?.hasExifGps,
  takenAt: locationResult?.takenAt ?? undefined,
  source,            // from the logic above
  fromCamera: isFromCameraFlow || false,
};

await createPost(data);

2.4 Ensure createPost appends metadata

In createPost (service function that builds FormData):

Confirm it does:

if (data.address) formData.append('address', data.address);
formData.append('latitude', data.latitude?.toString() || '0');
formData.append('longitude', data.longitude?.toString() || '0');

if (data.hasExifGps !== undefined) {
  formData.append('hasExifGps', data.hasExifGps ? 'true' : 'false');
}
if (data.takenAt) {
  formData.append('takenAt', data.takenAt.toISOString());
}
if (data.source) {
  formData.append('source', data.source);
}
if (data.fromCamera) {
  formData.append('fromCamera', 'true');
}


So backend gets everything it needs.

3. Frontend – Shorts Upload Flow

Now mirror the above logic for Shorts (video uploads).

Locate:

Short creation screen (e.g., frontend/app/(tabs)/shorts.tsx or similar).

Service: frontend/services/shorts.ts (or similar) with createShort(data: CreateShortData).

3.1 Extend CreateShortData
export interface CreateShortData {
  video: { uri: string; type: string; name: string };
  image?: { uri: string; type: string; name: string }; // optional thumbnail

  caption: string;

  address?: string;
  latitude?: number;
  longitude?: number;

  hasExifGps?: boolean;
  takenAt?: Date;
  source?: 'taatom_camera_live' | 'gallery_exif' | 'gallery_no_exif' | 'manual_only';
  fromCamera?: boolean;
}

3.2 When picking video for a short

On shorts screen:

When user picks a video from gallery:

Use launchImageLibraryAsync({ mediaTypes: Video, exif: true }).

Call extractLocationFromMedia([asset], new Date()).

Same logic as posts:

Set lat/lng, address, hasExifGps, takenAt, rawSource.

Derive source:

rawSource = 'exif' → source = 'gallery_exif'

rawSource = 'asset' → source = 'gallery_no_exif'

None → source = 'manual_only'.

If using an in-app camera for recording the short:

Get device GPS at capture time.

Set fromCamera = true.

Set source = 'taatom_camera_live'.

If user manually adjusts location on a map:

Update lat/lng, address.

If no EXIF-based location existed, let source remain 'manual_only'.

3.3 Build the payload and call createShort
const data: CreateShortData = {
  video: selectedVideo,
  image: selectedThumbnail, // optional
  caption,
  address: locationResult?.address ?? manualAddress ?? undefined,
  latitude: locationResult?.lat ?? manualLat ?? undefined,
  longitude: locationResult?.lng ?? manualLng ?? undefined,

  hasExifGps: !!locationResult?.hasExifGps,
  takenAt: locationResult?.takenAt ?? undefined,
  source,
  fromCamera: isFromCameraFlow || false,
};

await createShort(data);

3.4 Ensure createShort appends metadata

In the shorts service:

if (data.address) formData.append('address', data.address);
formData.append('latitude', data.latitude?.toString() || '0');
formData.append('longitude', data.longitude?.toString() || '0');

if (data.hasExifGps !== undefined) {
  formData.append('hasExifGps', data.hasExifGps ? 'true' : 'false');
}
if (data.takenAt) {
  formData.append('takenAt', data.takenAt.toISOString());
}
if (data.source) {
  formData.append('source', data.source);
}
if (data.fromCamera) {
  formData.append('fromCamera', 'true');
}

4. Backend – Light Adjustments / Validation

Backend already:

Reads hasExifGps, takenAt, source, fromCamera from req.body for posts/shorts.

Passes them as metadata into createTripVisitFromPost / createTripVisitFromShort.

You only need to ensure:

determineSource(metadata, post):

If metadata.fromCamera === true → source = 'taatom_camera_live'.

Else if metadata.hasExifGps === true → source = 'gallery_exif'.

Else if location exists (lat/lng != 0) → source = 'gallery_no_exif'.

Else → source = 'manual_only'.

assignTrustLevel(visit, metadata, previousVisits):

taatom_camera_live → high.

gallery_exif with plausible timeline → medium (or high, per your rules).

gallery_no_exif → low.

manual_only → unverified.

Keep your fraud checks (speed/distance) and mark suspicious as needed.

No major structural change required; just ensure logic aligns with metadata we now send from frontend.

5. Final Acceptance Criteria

You’re done when:

Posts & Shorts both:

Use extractLocationFromMedia to get real capture location where possible.

Fill hasExifGps, takenAt, source, fromCamera correctly.

Send consistent metadata to backend.

Backend:

Correctly classifies visits into source + trustLevel based on metadata.

TripVisits for posts and shorts look consistent in DB.

TripScore v2 (already implemented):

Counts visits from posts & shorts similarly.

Old issue “location not fetched correctly” is fixed in the upload flow, not just in scoring.