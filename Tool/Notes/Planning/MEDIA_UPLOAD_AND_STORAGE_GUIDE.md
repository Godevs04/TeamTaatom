# Media Upload and Storage Architecture Guide

**Document Version:** 1.0  
**Last Updated:** January 2025  
**Purpose:** Complete guide for understanding how images, shorts (videos), and location data are uploaded, processed, and stored in the Taatom application.

---

## Table of Contents

1. [Overview](#overview)
2. [Complete Upload Flow](#complete-upload-flow)
3. [Location Extraction from Images](#location-extraction-from-images)
4. [Storage Architecture](#storage-architecture)
5. [Database Models and Collections](#database-models-and-collections)
6. [API Endpoints](#api-endpoints)
7. [Error Handling](#error-handling)
8. [Best Practices](#best-practices)

---

## Overview

The Taatom application allows users to upload:
- **Photos** (up to 10 images per post)
- **Shorts** (videos up to 60 minutes)
- **Location Data** (extracted from EXIF or manually entered)

All media is stored in **Sevalla Object Storage** (Cloudflare R2, S3-compatible), and metadata is stored in **MongoDB**.

### Key Technologies

- **Frontend:** React Native (Expo)
- **Backend:** Node.js (Express)
- **Storage:** Sevalla Object Storage (R2, S3-compatible)
- **Database:** MongoDB (Mongoose ODM)
- **Location Services:** Expo Location, Google Geocoding API

---

## Complete Upload Flow

### 1. Frontend: User Initiates Upload

**File:** `frontend/app/(tabs)/post.tsx`

#### Photo Upload Flow:

```typescript
// User selects images from gallery or camera
const pickImage = async () => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: true,
    quality: 1,
  });
  
  if (!result.canceled) {
    setSelectedImages(result.assets);
    
    // Extract location from EXIF data
    const locationResult = await LocationExtractionService.extractFromPhotos(
      result.assets,
      Date.now()
    );
    
    if (locationResult) {
      setLocation({ lat: locationResult.lat, lng: locationResult.lng });
      setAddress(locationResult.address || '');
    }
  }
};
```

#### Short (Video) Upload Flow:

```typescript
// User selects video from gallery or records new video
const pickVideo = async () => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Videos,
    allowsEditing: true,
    quality: 1,
  });
  
  if (!result.canceled) {
    setSelectedVideo(result.assets[0].uri);
    
    // Extract location from video metadata
    const locationResult = await LocationExtractionService.extractFromPhotos(
      result.assets,
      Date.now()
    );
    
    if (locationResult) {
      setLocation({ lat: locationResult.lat, lng: locationResult.lng });
      setAddress(locationResult.address || '');
    }
  }
};
```

### 2. Frontend: Prepare FormData

**File:** `frontend/services/posts.ts`

#### Photo Post FormData:

```typescript
export const createPost = async (data: CreatePostData) => {
  const formData = new FormData();
  
  // Add all images
  data.images.forEach((image) => {
    formData.append('images', {
      uri: image.uri,
      type: image.type,      // e.g., 'image/jpeg'
      name: image.name,      // e.g., 'IMG_1234.jpg'
    } as any);
  });
  
  // Add metadata
  formData.append('caption', data.caption);
  formData.append('address', data.address || '');
  formData.append('latitude', data.latitude?.toString() || '0');
  formData.append('longitude', data.longitude?.toString() || '0');
  
  // Optional: Song attachment
  if (data.songId) {
    formData.append('songId', data.songId);
    formData.append('songStartTime', data.songStartTime?.toString() || '0');
    formData.append('songVolume', data.songVolume?.toString() || '0.5');
  }
  
  // Optional: EXIF metadata
  if (data.hasExifGps) {
    formData.append('hasExifGps', 'true');
  }
  if (data.takenAt) {
    formData.append('takenAt', data.takenAt.toISOString());
  }
  if (data.source) {
    formData.append('source', data.source); // 'taatom_camera_live', 'gallery_exif', etc.
  }
  
  // Send to backend
  const response = await fetch(getApiUrl('/api/v1/posts'), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      // Don't set Content-Type - let fetch handle FormData
    },
    body: formData,
  });
  
  return response.json();
};
```

#### Short FormData:

```typescript
export const createShort = async (data: CreateShortData) => {
  const formData = new FormData();
  
  // Add video
  formData.append('video', {
    uri: data.video.uri,
    type: data.video.type,    // e.g., 'video/mp4'
    name: data.video.name,    // e.g., 'VID_1234.mp4'
  } as any);
  
  // Optional: Custom thumbnail image
  if (data.image) {
    formData.append('image', {
      uri: data.image.uri,
      type: data.image.type,
      name: data.image.name,
    } as any);
  }
  
  // Add metadata (same as photo post)
  formData.append('caption', data.caption);
  formData.append('address', data.address || '');
  formData.append('latitude', data.latitude?.toString() || '0');
  formData.append('longitude', data.longitude?.toString() || '0');
  
  // Send to backend
  const response = await fetch(getApiUrl('/api/v1/shorts'), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });
  
  return response.json();
};
```

### 3. Backend: Receive and Process Upload

**File:** `backend/src/controllers/postController.js`

#### Photo Upload Handler:

```javascript
const createPost = async (req, res) => {
  try {
    // Multer middleware has already parsed files
    const files = req.files ? req.files.images : (req.file ? [req.file] : []);
    
    if (!files || files.length === 0) {
      return sendError(res, 'FILE_4001', 'Please upload at least one image');
    }
    
    if (files.length > 10) {
      return sendError(res, 'BIZ_7003', 'Maximum 10 images are allowed');
    }
    
    // Extract form data
    const { 
      caption, 
      address, 
      latitude, 
      longitude, 
      tags, 
      songId, 
      songStartTime, 
      songEndTime, 
      songVolume,
      hasExifGps,
      takenAt,
      source
    } = req.body;
    
    // Upload all images to Sevalla Object Storage
    const imageUrls = [];
    const storageKeys = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const extension = file.originalname.split('.').pop() || 'jpg';
      
      // Generate storage key
      const storageKey = buildMediaKey({
        type: 'post',
        userId: req.user._id.toString(),
        filename: file.originalname,
        extension
      });
      
      // Upload to Sevalla Object Storage
      const uploadResult = await uploadObject(
        file.buffer,      // File buffer from Multer
        storageKey,      // Generated storage key
        file.mimetype    // MIME type (e.g., 'image/jpeg')
      );
      
      imageUrls.push(uploadResult.url);
      storageKeys.push(storageKey);
    }
    
    // Parse tags and extract hashtags/mentions
    let parsedTags = [];
    if (tags) {
      try {
        parsedTags = JSON.parse(tags);
      } catch (e) {
        parsedTags = [];
      }
    }
    
    const extractedHashtags = extractHashtags(caption || '');
    const extractedMentions = extractMentions(caption || '');
    const allHashtags = [...new Set([...parsedTags, ...extractedHashtags])];
    
    // Resolve mentions to user IDs
    const mentionUserIds = [];
    if (extractedMentions.length > 0) {
      const mentionedUsers = await User.find({ 
        username: { $in: extractedMentions } 
      }).select('_id').lean();
      mentionUserIds.push(...mentionedUsers.map(u => u._id));
    }
    
    // Create Post document
    const post = new Post({
      user: req.user._id,
      caption,
      imageUrl: imageUrls[0],           // Primary image (backward compatibility)
      images: imageUrls,                // All images
      storageKey: storageKeys[0],       // Primary storage key
      storageKeys: storageKeys,         // All storage keys
      cloudinaryPublicIds: storageKeys, // Backward compatibility
      tags: allHashtags,
      mentions: mentionUserIds,
      type: 'photo',
      location: {
        address: address || 'Unknown Location',
        coordinates: {
          latitude: parseFloat(latitude) || 0,
          longitude: parseFloat(longitude) || 0
        }
      },
      song: songId ? {
        songId: songId,
        startTime: parseFloat(songStartTime) || 0,
        endTime: songEndTime ? parseFloat(songEndTime) : null,
        volume: parseFloat(songVolume) || 0.5
      } : undefined
    });
    
    await post.save();
    
    // Create TripVisit for TripScore v2 (non-blocking)
    try {
      const { createTripVisitFromPost } = require('../services/tripVisitService');
      const metadata = {
        source: source || 'manual_only',
        hasExifGps: hasExifGps === 'true' || hasExifGps === true,
        takenAt: takenAt ? new Date(takenAt) : null,
        fromCamera: source === 'taatom_camera_live'
      };
      await createTripVisitFromPost(post, metadata).catch(err => 
        logger.warn('Failed to create TripVisit for post:', err)
      );
    } catch (tripVisitError) {
      logger.warn('TripVisit creation failed (non-critical):', tripVisitError);
    }
    
    // Increment song usage count if song is attached
    if (songId) {
      try {
        const Song = require('../models/Song');
        await Song.findByIdAndUpdate(songId, { $inc: { usageCount: 1 } });
      } catch (songError) {
        logger.error('Error incrementing song usage count:', songError);
      }
    }
    
    // Invalidate cache
    await deleteCacheByPattern('posts:*');
    
    return sendSuccess(res, 201, 'Post created successfully', { post });
    
  } catch (error) {
    logger.error('Create post error:', error);
    return sendError(res, 'SRV_6001', 'Error creating post');
  }
};
```

#### Short Upload Handler:

```javascript
const createShort = async (req, res) => {
  try {
    const videoFile = (req.files && Array.isArray(req.files.video) && req.files.video[0]) || req.file;
    const imageFile = (req.files && Array.isArray(req.files.image) && req.files.image[0]) || null;
    
    if (!videoFile) {
      return sendError(res, 'FILE_4001', 'Please upload a video');
    }
    
    const { caption, address, latitude, longitude, tags, songId, songStartTime, songVolume } = req.body;
    
    // Upload video to Sevalla Object Storage
    const extension = videoFile.originalname.split('.').pop() || 'mp4';
    const videoStorageKey = buildMediaKey({
      type: 'short',
      userId: req.user._id.toString(),
      filename: videoFile.originalname,
      extension
    });
    
    const videoUploadResult = await uploadObject(
      videoFile.buffer,
      videoStorageKey,
      videoFile.mimetype
    );
    
    // Upload thumbnail if provided, otherwise use video URL as thumbnail
    let thumbnailUrl = '';
    let thumbnailStorageKey = null;
    if (imageFile) {
      const thumbExtension = imageFile.originalname.split('.').pop() || 'jpg';
      thumbnailStorageKey = buildMediaKey({
        type: 'short',
        userId: req.user._id.toString(),
        filename: `thumb_${imageFile.originalname}`,
        extension: thumbExtension
      });
      const thumbResult = await uploadObject(
        imageFile.buffer,
        thumbnailStorageKey,
        imageFile.mimetype
      );
      thumbnailUrl = thumbResult.url;
    } else {
      thumbnailUrl = videoUploadResult.url; // Use video URL as thumbnail
    }
    
    // Create Short document (uses Post model with type: 'short')
    const short = new Post({
      user: req.user._id,
      caption,
      imageUrl: thumbnailUrl,              // Thumbnail URL
      videoUrl: videoUploadResult.url,     // Video URL
      storageKey: videoStorageKey,         // Video storage key
      cloudinaryPublicId: videoStorageKey, // Backward compatibility
      tags: allHashtags,
      type: 'short',
      location: {
        address: address || 'Unknown Location',
        coordinates: {
          latitude: parseFloat(latitude) || 0,
          longitude: parseFloat(longitude) || 0
        }
      },
      song: songId ? {
        songId: songId,
        startTime: parseFloat(songStartTime) || 0,
        volume: parseFloat(songVolume) || 0.5
      } : undefined
    });
    
    await short.save();
    
    // Create TripVisit for TripScore v2 (non-blocking)
    try {
      const { createTripVisitFromShort } = require('../services/tripVisitService');
      const metadata = {
        source: req.body.source || 'manual_only',
        hasExifGps: req.body.hasExifGps === 'true' || req.body.hasExifGps === true,
        takenAt: req.body.takenAt ? new Date(req.body.takenAt) : null,
        fromCamera: req.body.fromCamera === 'true' || req.body.fromCamera === true
      };
      await createTripVisitFromShort(short, metadata).catch(err => 
        logger.warn('Failed to create TripVisit for short:', err)
      );
    } catch (tripVisitError) {
      logger.warn('TripVisit creation failed (non-critical):', tripVisitError);
    }
    
    return sendSuccess(res, 201, 'Short created successfully', { short });
    
  } catch (error) {
    logger.error('Create short error:', error);
    return sendError(res, 'SRV_6001', 'Error creating short');
  }
};
```

### 4. Storage Service: Upload to Sevalla Object Storage

**File:** `backend/src/services/storage.js`

```javascript
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Initialize S3-compatible client for Sevalla Object Storage
const s3Client = new S3Client({
  region: process.env.SEVALLA_STORAGE_REGION || 'auto',
  endpoint: process.env.SEVALLA_STORAGE_ENDPOINT,
  credentials: {
    accessKeyId: process.env.SEVALLA_STORAGE_ACCESS_KEY,
    secretAccessKey: process.env.SEVALLA_STORAGE_SECRET_KEY,
  },
  forcePathStyle: true,
});

const BUCKET_NAME = process.env.SEVALLA_STORAGE_BUCKET;

/**
 * Build a deterministic storage key for a file
 */
const buildMediaKey = ({ type, userId, filename, extension }) => {
  const timestamp = Date.now();
  const uniqueId = uuidv4().split('-')[0];
  
  let sanitizedFilename = '';
  if (filename) {
    sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/\.[^/.]+$/, '');
  }
  
  const ext = extension || (filename ? filename.split('.').pop() : 'jpg');
  
  let basePath = '';
  switch (type) {
    case 'post':
    case 'short':
      basePath = `posts/${timestamp}-${uniqueId}${sanitizedFilename ? `-${sanitizedFilename}` : ''}`;
      break;
    case 'profile':
      basePath = `profiles/${userId || 'unknown'}/${timestamp}-${uniqueId}`;
      break;
    case 'song':
      basePath = `songs/${timestamp}-${uniqueId}${sanitizedFilename ? `-${sanitizedFilename}` : ''}`;
      break;
    case 'locale':
      basePath = `locales/${timestamp}-${uniqueId}${sanitizedFilename ? `-${sanitizedFilename}` : ''}`;
      break;
    default:
      basePath = `misc/${timestamp}-${uniqueId}${sanitizedFilename ? `-${sanitizedFilename}` : ''}`;
  }
  
  return `${basePath}.${ext}`;
};

/**
 * Upload a file buffer to Sevalla Object Storage
 */
const uploadObject = async (buffer, key, contentType) => {
  try {
    if (!BUCKET_NAME) {
      throw new Error('SEVALLA_STORAGE_BUCKET is not configured');
    }
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'max-age=31536000', // 1 year HTTP cache
    });
    
    await s3Client.send(command);
    
    // Generate pre-signed download URL (valid for 7 days)
    const downloadUrl = await getDownloadUrl(key, 604800);
    
    logger.debug('File uploaded successfully:', { key, contentType });
    
    return {
      url: downloadUrl,
      key: key,
      bucket: BUCKET_NAME
    };
  } catch (error) {
    logger.error('Error uploading file:', error);
    throw error;
  }
};

/**
 * Generate a pre-signed GET URL for downloading/viewing a file
 */
const getDownloadUrl = async (key, expiresIn = 3600) => {
  try {
    if (!BUCKET_NAME) {
      throw new Error('SEVALLA_STORAGE_BUCKET is not configured');
    }
    
    // AWS S3-compatible services have a maximum expiration of 7 days (604800 seconds)
    const MAX_EXPIRATION = 604800;
    const validExpiresIn = Math.min(expiresIn, MAX_EXPIRATION);
    
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    
    const url = await getSignedUrl(s3Client, command, { expiresIn: validExpiresIn });
    
    logger.debug('Generated download URL:', { key, expiresIn: validExpiresIn });
    return url;
  } catch (error) {
    logger.error('Error generating download URL:', error);
    throw error;
  }
};
```

---

## Location Extraction from Images

**File:** `frontend/services/locationExtraction.ts`

### Overview

The application uses multiple strategies to extract location data from photos/videos:

1. **EXIF GPS Data** (highest priority)
2. **MediaLibrary Asset ID** (fallback)
3. **Filename Matching** (last resort)

### Strategy 1: EXIF GPS Data

```typescript
private static async getLocationFromEXIF(
  assets: any[]
): Promise<LocationResult | null> {
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      return null;
    }
    
    for (const asset of assets) {
      const assetId = (asset as any).id;
      if (!assetId) continue;
      
      try {
        // Get asset info including EXIF data
        const assetInfo = await MediaLibrary.getAssetInfoAsync(assetId);
        const location = this.parseLocation(assetInfo.location);
        
        if (location) {
          // Reverse geocode to get address
          const address = await getAddressFromCoords(location.lat, location.lng);
          return { ...location, address };
        }
      } catch (error) {
        logger.debug('Error getting asset by ID', error);
      }
    }
    
    return null;
  } catch (error) {
    logger.error('EXIF extraction failed', error);
    return null;
  }
}
```

### Strategy 2: MediaLibrary Asset ID

```typescript
private static async getLocationByAssetId(
  assets: any[]
): Promise<LocationResult | null> {
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      return null;
    }
    
    for (const asset of assets) {
      const assetId = (asset as any).id;
      if (!assetId) continue;
      
      try {
        const assetInfo = await MediaLibrary.getAssetInfoAsync(assetId);
        const location = this.parseLocation(assetInfo.location);
        
        if (location) {
          const address = await getAddressFromCoords(location.lat, location.lng);
          return { ...location, address };
        }
      } catch (error) {
        // Continue to next asset
      }
    }
    
    return null;
  } catch (error) {
    logger.error('Asset ID location extraction failed', error);
    return null;
  }
}
```

### Strategy 3: Filename Matching

```typescript
private static async getLocationByFilename(
  assets: any[],
  selectionTime: number
): Promise<LocationResult | null> {
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      return null;
    }
    
    // Get recent assets from MediaLibrary
    const recentAssets = await MediaLibrary.getAssetsAsync({
      first: 30,
      mediaType: MediaLibrary.MediaType.photo,
      sortBy: MediaLibrary.SortBy.modificationTime,
    });
    
    // Try to match by filename
    for (const selectedAsset of assets) {
      const selectedFileName = selectedAsset.fileName;
      if (!selectedFileName) continue;
      
      for (const mediaAsset of recentAssets.assets) {
        try {
          const assetInfo = await MediaLibrary.getAssetInfoAsync(mediaAsset.id);
          const assetFileName = assetInfo.localUri?.split('/').pop() || '';
          
          if (
            assetFileName.toLowerCase().includes(selectedFileName.toLowerCase()) ||
            selectedFileName.toLowerCase().includes(assetFileName.toLowerCase())
          ) {
            const location = this.parseLocation(assetInfo.location);
            if (location) {
              const address = await getAddressFromCoords(location.lat, location.lng);
              return { ...location, address };
            }
          }
        } catch (error) {
          // Continue searching
        }
      }
    }
    
    return null;
  } catch (error) {
    logger.error('Filename location extraction failed', error);
    return null;
  }
}
```

### Reverse Geocoding

**File:** `frontend/utils/locationUtils.ts`

```typescript
export const getAddressFromCoords = async (
  latitude: number, 
  longitude: number
): Promise<string> => {
  try {
    // Try Google Geocoding API first
    const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (GOOGLE_MAPS_API_KEY) {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.results && data.results.length > 0) {
        return data.results[0].formatted_address;
      }
    }
    
    // Fallback to Expo Location (Android)
    if (Platform.OS === 'android') {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (results.length > 0) {
        const a = results[0];
        const parts = [a.name || a.street, a.city, a.region, a.country].filter(Boolean);
        return parts.join(', ');
      }
    }
    
    // Final fallback
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  } catch (error) {
    logger.error('Reverse geocoding error:', error);
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  }
};
```

---

## Storage Architecture

### Sevalla Object Storage (Cloudflare R2)

**Configuration:** Environment variables in `backend/.env`

```env
SEVALLA_STORAGE_ENDPOINT=https://your-r2-endpoint.com
SEVALLA_STORAGE_REGION=auto
SEVALLA_STORAGE_ACCESS_KEY=your-access-key
SEVALLA_STORAGE_SECRET_KEY=your-secret-key
SEVALLA_STORAGE_BUCKET=your-bucket-name
```

### Storage Key Structure

```
posts/1735689600000-a1b2c3d4-IMG_1234.jpg
posts/1735689600000-e5f6g7h8-VID_5678.mp4
profiles/user123/1735689600000-i9j0k1l2.jpg
songs/1735689600000-m3n4o5p6-song.mp3
locales/1735689600000-q7r8s9t0-locale.jpg
```

### Storage Operations

1. **Upload:** `uploadObject(buffer, key, contentType)` → Returns pre-signed download URL
2. **Download:** `getDownloadUrl(key, expiresIn)` → Returns pre-signed GET URL (max 7 days)
3. **Delete:** `deleteObject(key)` → Permanently deletes file
4. **Exists:** `objectExists(key)` → Checks if file exists

### Pre-signed URLs

- **Upload URLs:** Not currently used (server-side upload)
- **Download URLs:** Generated on-demand, valid for up to 7 days
- **Security:** URLs expire automatically, preventing unauthorized access

---

## Database Models and Collections

### 1. Post Model

**File:** `backend/src/models/Post.js`  
**Collection:** `posts`

```javascript
{
  _id: ObjectId,
  user: ObjectId (ref: 'User'),
  caption: String (max 1000 chars),
  mentions: [ObjectId] (ref: 'User'),
  
  // Media URLs (pre-signed URLs from Sevalla)
  imageUrl: String,              // Primary image (backward compatibility)
  images: [String],             // All images (for multi-image posts)
  videoUrl: String,             // Video URL (for shorts)
  
  // Storage keys (Sevalla Object Storage)
  storageKey: String,           // Primary storage key
  storageKeys: [String],        // All storage keys
  cloudinaryPublicIds: [String], // Backward compatibility (populated with storageKeys)
  
  // Content type
  type: String ('photo' | 'short'),
  
  // Location data
  location: {
    address: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  
  // Engagement
  tags: [String],               // Hashtags
  likes: [ObjectId] (ref: 'User'),
  comments: [{
    user: ObjectId (ref: 'User'),
    text: String (max 500 chars),
    mentions: [ObjectId] (ref: 'User'),
    createdAt: Date
  }],
  views: Number,
  
  // Song attachment
  song: {
    songId: ObjectId (ref: 'Song'),
    startTime: Number,
    endTime: Number | null,
    volume: Number (0-1)
  },
  
  // Status flags
  isActive: Boolean,
  isArchived: Boolean,
  isHidden: Boolean,
  commentsDisabled: Boolean,
  
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `{ user: 1, createdAt: -1 }` - User posts sorted by date
- `{ createdAt: -1 }` - All posts sorted by date
- `{ type: 1, isActive: 1, createdAt: -1 }` - Type-based feed queries
- `{ 'location.coordinates': '2dsphere' }` - Geospatial queries
- `{ tags: 1 }` - Hashtag searches

### 2. TripVisit Model (TripScore v2)

**File:** `backend/src/models/TripVisit.js`  
**Collection:** `tripvisits`

```javascript
{
  _id: ObjectId,
  user: ObjectId (ref: 'User'),
  post: ObjectId (ref: 'Post'), // Can be null for shorts
  contentType: String ('post' | 'short'),
  
  // Location data
  lat: Number,
  lng: Number,
  continent: String,
  country: String,
  city: String,
  address: String,
  
  // Source and trust level
  source: String ('taatom_camera_live' | 'gallery_exif' | 'gallery_no_exif' | 'manual_only'),
  trustLevel: String ('high' | 'medium' | 'low' | 'unverified' | 'suspicious'),
  
  // Timestamps
  takenAt: Date,        // From EXIF or capture time
  uploadedAt: Date,     // From post/short createdAt
  
  // Status
  isActive: Boolean,
  
  // Metadata for fraud detection
  metadata: {
    exifAvailable: Boolean,
    exifTimestamp: Date,
    distanceFromPrevious: Number,  // km
    timeFromPrevious: Number,       // hours
    flaggedReason: String
  },
  
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `{ user: 1, continent: 1, country: 1 }` - Geographic queries
- `{ user: 1, takenAt: 1 }` - Time-based queries
- `{ user: 1, trustLevel: 1 }` - Trust level filtering
- `{ user: 1, lat: 1, lng: 1 }` - Deduplication

### 3. User Model

**File:** `backend/src/models/User.js`  
**Collection:** `users`

```javascript
{
  _id: ObjectId,
  fullName: String,
  username: String (unique, lowercase),
  email: String (unique, lowercase),
  password: String (hashed),
  bio: String (max 300 chars),
  
  // Profile picture
  profilePic: String,              // URL (pre-signed)
  profilePicStorageKey: String,    // Sevalla storage key
  
  // Social
  followers: [ObjectId] (ref: 'User'),
  following: [ObjectId] (ref: 'User'),
  blockedUsers: [ObjectId] (ref: 'User'),
  
  // Settings
  settings: {
    privacy: {
      shareActivity: Boolean,
      // ... other privacy settings
    }
  },
  
  createdAt: Date,
  updatedAt: Date
}
```

### 4. Song Model

**File:** `backend/src/models/Song.js`  
**Collection:** `songs`

```javascript
{
  _id: ObjectId,
  title: String,
  artist: String,
  duration: Number,              // seconds
  
  // Storage
  storageKey: String,            // Sevalla storage key
  storageUrl: String,            // Pre-signed URL
  cloudinaryKey: String,         // Backward compatibility
  cloudinaryUrl: String,         // Backward compatibility
  
  thumbnailUrl: String,
  genre: String,
  isActive: Boolean,
  uploadedBy: ObjectId (ref: 'User'),
  uploadDate: Date,
  usageCount: Number,
  
  createdAt: Date,
  updatedAt: Date
}
```

### 5. Locale Model

**File:** `backend/src/models/Locale.js`  
**Collection:** `locales`

```javascript
{
  _id: ObjectId,
  name: String,
  country: String,
  countryCode: String,
  stateProvince: String,
  stateCode: String,
  description: String,
  
  // Storage
  storageKey: String,            // Sevalla storage key
  storageUrl: String,            // Pre-signed URL
  cloudinaryKey: String,         // Backward compatibility
  cloudinaryUrl: String,         // Backward compatibility
  
  isActive: Boolean,
  createdBy: ObjectId (ref: 'User'),
  displayOrder: Number,
  
  createdAt: Date,
  updatedAt: Date
}
```

### Other Models

- **Activity** (`activities`) - User activity feed
- **Notification** (`notifications`) - Push notifications
- **Chat** (`chats`) - Direct messages
- **Collection** (`collections`) - User collections/saved posts
- **Hashtag** (`hashtags`) - Hashtag tracking
- **Comment** (`comments`) - Standalone comments (if separated)
- **Report** (`reports`) - Content reports
- **SuperAdmin** (`superadmins`) - Admin users

---

## API Endpoints

### Photo Upload

**Endpoint:** `POST /api/v1/posts`  
**Authentication:** Required (Bearer token)  
**Content-Type:** `multipart/form-data`

**Request Body:**
```
images: File[] (1-10 images)
caption: String
address: String (optional)
latitude: Number (optional)
longitude: Number (optional)
tags: JSON string array (optional)
songId: ObjectId (optional)
songStartTime: Number (optional)
songEndTime: Number (optional)
songVolume: Number (optional, 0-1)
hasExifGps: Boolean (optional)
takenAt: ISO Date string (optional)
source: String (optional, 'taatom_camera_live' | 'gallery_exif' | 'gallery_no_exif' | 'manual_only')
```

**Response:**
```json
{
  "success": true,
  "message": "Post created successfully",
  "data": {
    "post": {
      "_id": "...",
      "user": "...",
      "caption": "...",
      "imageUrl": "https://...",
      "images": ["https://...", "https://..."],
      "storageKey": "posts/...",
      "storageKeys": ["posts/...", "posts/..."],
      "location": {
        "address": "...",
        "coordinates": {
          "latitude": 0,
          "longitude": 0
        }
      },
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

### Short Upload

**Endpoint:** `POST /api/v1/shorts`  
**Authentication:** Required (Bearer token)  
**Content-Type:** `multipart/form-data`

**Request Body:**
```
video: File (required)
image: File (optional, custom thumbnail)
caption: String
address: String (optional)
latitude: Number (optional)
longitude: Number (optional)
tags: JSON string array (optional)
songId: ObjectId (optional)
songStartTime: Number (optional)
songVolume: Number (optional, 0-1)
hasExifGps: Boolean (optional)
takenAt: ISO Date string (optional)
source: String (optional)
```

**Response:** Same structure as photo upload, but with `videoUrl` instead of `imageUrl`.

---

## Error Handling

### Frontend Errors

**File:** `frontend/app/(tabs)/post.tsx`

```typescript
try {
  const response = await createPostWithProgress(postData, (progress) => {
    setUploadProgress({
      current: uploadedCount + 1,
      total: totalImages,
      percentage: Math.min(overallProgress, 100)
    });
  });
  
  // Success
  Alert.alert('Success!', 'Your post has been shared.');
} catch (error: any) {
  // Error handling
  logger.error('Post creation failed', error);
  setUploadError(error?.message || 'Upload failed. Please try again.');
  Alert.alert('Upload failed', error?.message || 'Please try again later.');
}
```

### Backend Errors

**File:** `backend/src/controllers/postController.js`

```javascript
try {
  // Upload logic
} catch (uploadError) {
  // Clean up any successfully uploaded images if subsequent uploads fail
  if (storageKeys.length > 0) {
    await Promise.all(
      storageKeys.map(key => 
        deleteObject(key).catch(err => 
          logger.error('Error cleaning up failed upload:', err)
        )
      )
    );
  }
  throw uploadError;
}
```

### Error Codes

- `FILE_4001` - No file uploaded
- `FILE_4004` - Upload failed
- `BIZ_7003` - Maximum images exceeded (10)
- `VAL_2001` - Validation failed
- `SRV_6001` - Internal server error

---

## Best Practices

### 1. Image Optimization

**File:** `frontend/utils/imageOptimization.ts`

- Compress images before upload
- Use appropriate quality settings
- Resize large images
- Support multiple formats (JPEG, PNG, WebP)

### 2. Location Extraction

- Always try EXIF first (most accurate)
- Fallback to MediaLibrary if EXIF unavailable
- Cache reverse geocoding results
- Handle permission denials gracefully

### 3. Storage

- Use deterministic storage keys
- Generate pre-signed URLs with appropriate expiration
- Clean up failed uploads
- Monitor storage usage

### 4. Database

- Index frequently queried fields
- Use compound indexes for complex queries
- Soft delete (isActive flag) instead of hard delete
- Maintain backward compatibility with legacy fields

### 5. Error Handling

- Log all errors with context
- Clean up partial uploads on failure
- Provide user-friendly error messages
- Retry transient failures

### 6. Performance

- Use async/await for non-blocking operations
- Batch operations where possible
- Cache frequently accessed data
- Optimize image sizes before upload

---

## Summary Flow Diagram

```
User selects image/video
    ↓
Extract location from EXIF/MediaLibrary
    ↓
Prepare FormData with media + metadata
    ↓
POST /api/v1/posts or /api/v1/shorts
    ↓
Backend receives files via Multer
    ↓
Upload files to Sevalla Object Storage
    ↓
Generate pre-signed download URLs
    ↓
Create Post document in MongoDB
    ↓
Create TripVisit document (TripScore v2)
    ↓
Invalidate cache
    ↓
Return success response
    ↓
Frontend displays success message
```

---

## Environment Variables

### Backend (`backend/.env`)

```env
# Sevalla Object Storage
SEVALLA_STORAGE_ENDPOINT=https://your-r2-endpoint.com
SEVALLA_STORAGE_REGION=auto
SEVALLA_STORAGE_ACCESS_KEY=your-access-key
SEVALLA_STORAGE_SECRET_KEY=your-secret-key
SEVALLA_STORAGE_BUCKET=your-bucket-name

# MongoDB
MONGODB_URI=mongodb://localhost:27017/taatom

# Google Maps API (for reverse geocoding)
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

### Frontend (`frontend/.env`)

```env
# API Base URL
EXPO_PUBLIC_API_URL=http://localhost:3000

# Google Maps API (for reverse geocoding)
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

---

## Troubleshooting

### Common Issues

1. **Upload fails with "Storage credentials are invalid"**
   - Check `SEVALLA_STORAGE_*` environment variables
   - Verify credentials are correct
   - Ensure bucket exists

2. **Location extraction returns null**
   - Check MediaLibrary permissions
   - Verify EXIF data exists in image
   - Check Google Maps API key

3. **Pre-signed URL expires too quickly**
   - URLs expire after 7 days (maximum)
   - Regenerate URLs when needed
   - Consider caching URLs

4. **TripVisit not created**
   - Check location coordinates are valid (not 0,0)
   - Verify TripVisit service is working
   - Check logs for errors

---

## TripScore v2 Integration

### Location Metadata for TripScore

Posts and Shorts both share the same location extraction logic via `LocationExtractionService`.

**Metadata Fields Sent to Backend:**
- `hasExifGps`: Boolean - true if location came from EXIF GPS
- `takenAt`: Date - capture timestamp from EXIF or asset metadata
- `source`: String - `'taatom_camera_live' | 'gallery_exif' | 'gallery_no_exif' | 'manual_only'`
- `fromCamera`: Boolean - true if taken via in-app camera

**Source → Trust Level Mapping:**
- `taatom_camera_live` → `high` trust (always counts)
- `gallery_exif` → `medium` trust (counts unless fraud detected)
- `gallery_no_exif` → `low` trust (excluded from TripScore)
- `manual_only` → `unverified` (excluded from TripScore)

Only visits with `high` or `medium` trust levels contribute to TripScore. See `Tool/Notes/Enhance/TRIPSCORE_V2_FINAL_RULES.md` for complete rules.

---

**Document Version:** 1.0  
**Last Updated:** January 2025  
**Maintained By:** TeamTaatom Development Team

