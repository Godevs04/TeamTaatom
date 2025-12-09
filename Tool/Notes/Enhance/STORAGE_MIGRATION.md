# Storage Migration: Cloudinary & AWS S3 → Sevalla Object Storage (Cloudflare R2)

## Overview

This document describes the migration from **Cloudinary** and **AWS S3** to **Sevalla Object Storage** (Cloudflare R2, S3-compatible) for all file storage and media handling in the Taatom application.

## Migration Date

**Completed:** January 2025

## Architecture

### Previous Architecture

- **Cloudinary**: Used for images, videos, and audio files (posts, profile pictures, songs, locales)
- **AWS S3**: Legacy storage for songs and locales (with CloudFront CDN)
- **Direct Uploads**: Files uploaded via multer → buffer → Cloudinary/S3

### New Architecture

- **Sevalla Object Storage (R2)**: Unified S3-compatible storage for all media
- **Storage Service**: Centralized abstraction layer (`backend/src/services/storage.js`)
- **Server-Side Uploads**: Current production flow uses backend uploads (multer → buffer → R2)
- **Pre-signed URLs**: Infrastructure exists (`getUploadUrl`) but not yet wired to client flows (future enhancement)
- **Backward Compatibility**: Legacy Cloudinary URLs still supported for existing content

## Storage Service

### Location
`backend/src/services/storage.js`

### Key Functions

- `buildMediaKey(params)`: Generates deterministic storage keys based on type, userId, filename
- `uploadObject(buffer, key, contentType)`: Server-side upload to R2
- `getUploadUrl(key, contentType, expiresIn)`: Generates pre-signed PUT URL for client uploads
- `getDownloadUrl(key, expiresIn)`: Generates pre-signed GET URL for viewing
- `deleteObject(key)`: Deletes file from storage
- `objectExists(key)`: Checks if object exists
- `getPublicUrl(key, baseUrl)`: Gets public URL (if bucket is public)

### Storage Key Structure

```
posts/{timestamp}-{uniqueId}-{filename}.{ext}
profiles/{userId}/{timestamp}-{uniqueId}.{ext}
songs/{timestamp}-{uniqueId}-{filename}.{ext}
locales/{timestamp}-{uniqueId}-{filename}.{ext}
shorts/{timestamp}-{uniqueId}-{filename}.{ext}
```

## Environment Variables

### Backend (.env)

```env
# Sevalla Object Storage Configuration
SEVALLA_STORAGE_ENDPOINT=https://your-endpoint.r2.cloudflarestorage.com
SEVALLA_STORAGE_REGION=auto
SEVALLA_STORAGE_ACCESS_KEY=your-access-key
SEVALLA_STORAGE_SECRET_KEY=your-secret-key
SEVALLA_STORAGE_BUCKET=your-bucket-name
SEVALLA_STORAGE_PUBLIC_URL=https://your-public-domain.com  # Optional, for public bucket
```

### Legacy Variables (Deprecated)

The following Cloudinary variables are no longer required for new uploads but may still exist for backward compatibility:

```env
# Cloudinary (deprecated - kept for legacy URL handling)
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

## Database Schema Changes

### Models Updated

All models now support both new storage fields and legacy fields for backward compatibility:

#### Post Model
- **New Fields**: `storageKey` (String), `storageKeys` (Array) - **Primary storage fields for new uploads**
- **Legacy Fields**: `cloudinaryPublicId`, `cloudinaryPublicIds` (Array)
  - **For new uploads**: Populated with R2 storage keys for backward compatibility (e.g., `cloudinaryPublicIds: storageKeys`)
  - **For old records**: May contain original Cloudinary public IDs
  - **Usage**: Read for display/deletion fallback; not used for new uploads

#### User Model
- **New Field**: `profilePicStorageKey` (String) - **Primary storage field for new uploads**
- **Legacy Field**: `profilePic` (URL string)
  - **For new uploads**: Contains R2 pre-signed URL
  - **For old records**: May contain Cloudinary URL
  - **Usage**: Always used for display; storage key used for deletion

#### Song Model
- **New Fields**: `storageKey` (String), `storageUrl` (String) - **Primary storage fields for new uploads**
- **Legacy Fields**: `cloudinaryKey`, `cloudinaryUrl`, `s3Key`, `s3Url`
  - **For new uploads**: Populated with R2 values for backward compatibility (e.g., `cloudinaryKey: storageKey`, `cloudinaryUrl: uploadResult.url`)
  - **For old records**: May contain original Cloudinary/S3 keys/URLs
  - **Usage**: Read for deletion fallback; not used for new uploads

#### Locale Model
- **New Fields**: `storageKey` (String), `storageUrl` (String) - **Primary storage fields for new uploads**
- **Legacy Fields**: `cloudinaryKey`, `cloudinaryUrl`, `imageKey`, `imageUrl`
  - **For new uploads**: Populated with R2 values for backward compatibility (e.g., `cloudinaryKey: storageKey`, `cloudinaryUrl: uploadResult.url`)
  - **For old records**: May contain original Cloudinary/S3 keys/URLs
  - **Usage**: Read for deletion fallback; not used for new uploads

### Field Population Strategy

**For New Uploads:**
- ✅ **Primary fields** (`storageKey`, `storageKeys`, `storageUrl`) are populated with R2 values
- ✅ **Legacy fields** are also populated with R2 values for backward compatibility (ensures existing code paths continue to work)
- ✅ **No Cloudinary/S3 API calls** are made for new uploads

**For Old Records:**
- Legacy fields contain original Cloudinary/S3 values
- Used only for:
  - Display (if URL is still valid)
  - Deletion fallback (if R2 deletion fails or storage key missing)

## Upload Flow

### Current Implementation (Server-Side Upload) ✅ **PRODUCTION**

The current production flow for both mobile app and SuperAdmin uses server-side uploads:

1. **Client** → Sends file via multipart/form-data to backend endpoint (e.g., `POST /api/v1/posts`, `POST /api/v1/profile/:id`)
2. **Backend** → Receives file via multer (memory storage)
3. **Backend** → Generates storage key using `buildMediaKey()`
4. **Backend** → Uploads file buffer to R2 using `uploadObject()` (server-side)
5. **Backend** → Stores storage key and pre-signed URL in database
6. **Backend** → Returns response with media URL (pre-signed GET URL, expires in 7 days)

**Note**: The `getUploadUrl()` function exists in the storage service but is **not currently used** in any production flow. It is reserved for future client-side direct uploads.

### Future Enhancement (Pre-signed Client Uploads) 🔮 **PLANNED**

A future enhancement will enable direct client-to-R2 uploads:

1. **Client** → Requests upload URL from backend (`POST /api/v1/media/upload-request`)
2. **Backend** → Generates storage key and pre-signed PUT URL using `getUploadUrl()`
3. **Backend** → Returns `{ uploadUrl, key }` to client
4. **Client** → Uploads file directly to R2 using PUT request
5. **Client** → Notifies backend of completion (`POST /api/v1/media/upload-complete`)
6. **Backend** → Stores metadata in database

This enhancement is **not yet implemented** and requires new API endpoints and frontend changes.

## View Flow

### Current Implementation

- **New Uploads**: URLs are pre-signed GET URLs from R2 with expiration up to **7 days** (604800 seconds)
  - Default expiration: 1 hour (3600 seconds) for on-demand URL generation
  - Maximum expiration: 7 days (604800 seconds) - automatically capped by storage service
  - URLs generated by `uploadObject()` use 7-day expiration
- **Legacy URLs**: Cloudinary URLs are used as-is (with optional optimization for backward compatibility)

### URL Types

1. **R2 Pre-signed URLs**: `https://endpoint.com/bucket/key?signature=...`
   - Expiration: Up to 7 days maximum (S3-compatible requirement)
   - Automatically capped by storage service even if longer duration requested
   - Used for all new uploads
2. **Legacy Cloudinary URLs**: `https://res.cloudinary.com/...`
   - Used only for pre-migration content
   - Backward compatibility maintained

## Deletion Flow

1. **Backend** → Receives delete request
2. **Backend** → Retrieves storage key from database (priority: `storageKey` > `cloudinaryKey` > legacy fields)
3. **Backend** → Calls `deleteObject(key)` to delete from R2
4. **Backend** → Falls back to Cloudinary delete if R2 delete fails (for legacy content)
5. **Backend** → Removes record from database

## Controllers Updated

### Backend Controllers

- ✅ `postController.js`: Post images and videos (uses `uploadObject()` from storage service)
- ✅ `profileController.js`: Profile pictures (uses `uploadObject()` from storage service)
- ✅ `songController.js`: Audio files (uses `uploadObject()` from storage service)
- ✅ `localeController.js`: Locale images (uses `uploadObject()` from storage service)
- ✅ `cascadeDelete.js`: Cascade deletion logic (uses `deleteObject()` from storage service)
- ✅ `jobs/processors/image.js`: Image processing jobs (migrated to use storage service)

### Legacy Code (Backward Compatibility Only)

The following files/functions are kept for backward compatibility but are **NOT used for new uploads**:

#### Deprecated Config Files

- **`config/cloudinary.js`** ⚠️ **DEPRECATED**
  - **Status**: Currently imported and used only for legacy cleanup operations
  - **Usage**:
    - Legacy deletion fallback (when R2 deletion fails for old Cloudinary assets)
    - URL optimization for existing Cloudinary URLs (`getOptimizedImageUrl`, `getVideoThumbnailUrl`)
  - **Not used for**: New uploads, new deletions (primary path), or any production upload flow
  - **Removal**: Scheduled for removal after all legacy Cloudinary assets are migrated or deleted

- **`config/s3.js`** ⚠️ **DEPRECATED**
  - **Status**: Legacy file, not actively imported or used in any code path
  - **Removal**: Safe to remove after one final repository-wide verification

#### Deprecated Functions

- Cloudinary functions (`uploadImage`, `deleteImage`, `uploadSong`, `deleteSong`, `uploadLocaleImage`, `deleteLocaleImage`):
  - **Status**: Imported but only used as fallback when R2 deletion fails for legacy content
  - **Not used for**: New uploads or primary deletion path
  - **Removal**: Will be removed along with `config/cloudinary.js`

## Frontend Updates

### Changes Made

- ✅ Updated comments in `imageLoader.ts` to clarify backward compatibility
- ✅ Cloudinary URL optimization functions remain (only apply to Cloudinary URLs)
- ✅ New R2 URLs are used as-is (no optimization needed)

### Files Modified

- `frontend/utils/imageLoader.ts`: Added backward compatibility comments
- All other frontend files remain unchanged (URL optimization is already conditional)

## SuperAdmin Updates

### Changes Made

- ✅ Updated delete confirmation messages to say "storage" instead of "S3"
- ✅ No other changes needed (uses same backend APIs)

### Files Modified

- `SuperAdmin/src/pages/Locales.jsx`: Updated delete message
- `SuperAdmin/src/pages/Songs.jsx`: Updated delete message

## Backward Compatibility

### Legacy Content Support

- **Cloudinary URLs**: Still supported and optimized when detected
- **Legacy Fields**: Database fields (`cloudinaryPublicId`, `s3Key`, etc.) are preserved
- **Fallback Deletion**: Tries R2 delete first, falls back to Cloudinary delete for legacy content

### Migration Strategy

1. **New Uploads**: Automatically use R2 storage
2. **Existing Content**: Continues to work with Cloudinary URLs
3. **Future Data Migration**: Optional script to migrate existing Cloudinary URLs to R2 (not implemented yet)

## Cleanup (Future)

### Deprecated Files Scheduled for Removal

⚠️ **These files are marked as deprecated and should be removed after full data migration:**

- **`backend/src/config/cloudinary.js`**
  - Currently used only for legacy deletion fallback and URL optimization
  - Safe to remove once all legacy Cloudinary assets are migrated or deleted
  - Verify no imports remain before removal

- **`backend/src/config/s3.js`**
  - Not actively used in any code path
  - Safe to remove after repository-wide verification

- **Cloudinary package** from `package.json`
  - Remove after `config/cloudinary.js` is removed
  - Verify no other dependencies require it

### Deprecated Environment Variables

⚠️ **These environment variables are no longer required for new uploads:**

- **`CLOUDINARY_*` variables** (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`)
  - Currently used only for legacy deletion fallback and URL optimization
  - Can be removed after all legacy Cloudinary assets are migrated

- **`AWS_*` variables** (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET_NAME`, etc.)
  - Not actively used
  - Can be removed after verification

## Testing

### Test Cases

1. ✅ **Post Image Upload**: Upload single/multiple images → Verify R2 storage
2. ✅ **Video Upload**: Upload short video → Verify R2 storage
3. ✅ **Profile Picture**: Upload profile picture → Verify R2 storage
4. ✅ **Song Upload**: Upload audio file → Verify R2 storage
5. ✅ **Locale Upload**: Upload locale image → Verify R2 storage
6. ✅ **Deletion**: Delete post/song/locale → Verify R2 deletion
7. ✅ **Legacy URLs**: Verify existing Cloudinary URLs still work
8. ✅ **Cascade Delete**: Verify cascade deletion works correctly
9. ✅ **Presigned URL Expiration**: Verify URLs expire correctly (max 7 days)
10. ✅ **Error Handling**: Verify specific error messages for storage failures
11. ✅ **Profile Update**: Verify profile updates work with storage service
12. ✅ **Non-blocking Operations**: Verify cache/socket failures don't block updates

## Performance Considerations

### Advantages

- **Unified Storage**: Single storage provider simplifies management
- **S3-Compatible**: Standard API, easy to switch providers if needed
- **Cost-Effective**: R2 has no egress fees
- **CDN Integration**: Can integrate with Cloudflare CDN

### Considerations

- **No On-the-Fly Transformations**: Unlike Cloudinary, R2 doesn't provide image transformations
- **Pre-signed URL Expiration**: URLs expire after a maximum of 7 days (604800 seconds) per AWS S3-compatible specification
  - Default: 1 hour (3600 seconds) for on-demand URL generation
  - Maximum: 7 days (604800 seconds) - automatically capped by storage service
  - URLs generated by `uploadObject()` use 7-day expiration
  - May need refresh mechanism for long-lived content
- **Client-Side Optimization**: Image optimization should happen client-side before upload

## Security

### Access Control

- **Private Bucket**: All files stored in private bucket
- **Pre-signed URLs**: Time-limited access with expiration up to **7 days maximum** (604800 seconds)
  - This is the practical cap enforced by S3-compatible services (including Cloudflare R2)
  - Storage service automatically caps any requested expiration at 7 days
  - Default expiration for on-demand URLs: 1 hour (3600 seconds)
- **No Public Access**: Direct bucket access is disabled

### Best Practices

- ✅ Storage keys are deterministic and predictable (no security risk - bucket is private)
- ✅ Pre-signed URLs expire after set time
- ✅ No credentials exposed to frontend
- ✅ All uploads go through backend validation

## Monitoring

### Metrics to Track

- Storage usage (R2 dashboard)
- Upload success/failure rates
- Pre-signed URL generation performance
- Deletion success rates
- Legacy Cloudinary URL usage (should decrease over time)

## Rollback Plan

If issues occur:

1. **Immediate**: Revert code changes (Git)
2. **Database**: Legacy fields are preserved, no data loss
3. **Storage**: Cloudinary/S3 still accessible if credentials remain
4. **Frontend**: No changes needed for rollback (backward compatible)

## Future Enhancements

1. **Pre-signed URL Endpoints**: Implement client-side direct uploads using existing `getUploadUrl()` infrastructure
2. **Image Optimization Service**: Add server-side image processing (sharp, imagemagick) before upload
3. **CDN Integration**: Integrate Cloudflare CDN for faster delivery
4. **Data Migration Script**: Migrate existing Cloudinary URLs to R2 (optional, for cleanup)
5. **Storage Analytics**: Track storage usage and costs
6. **URL Refresh Mechanism**: Implement automatic refresh for long-lived pre-signed URLs approaching expiration

## References

- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [AWS S3 SDK Documentation](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/s3-examples.html)
- Storage Service: `backend/src/services/storage.js`

## Notes

- ✅ **All new uploads use Sevalla R2 storage** via unified storage service
- ✅ **Legacy Cloudinary URLs are preserved** for backward compatibility
- ✅ **No breaking changes** to API contracts
- ✅ **Frontend and SuperAdmin** continue to work without changes
- ✅ **Database schema** supports both new and legacy fields
- ✅ **Presigned URL expiration** is automatically capped at 7 days (S3-compatible requirement)
- ✅ **Error handling** improved with specific error messages and detailed logging
- ✅ **Non-blocking operations** for cache and socket events (don't block updates)
- ✅ **Profile update** fixed to properly handle storage keys and error scenarios

## Migration Status: ✅ COMPLETE

### Verification Checklist

- ✅ All new uploads (posts, shorts, profiles, songs, locales) use Sevalla storage
- ✅ All deletions use Sevalla storage (with Cloudinary fallback for legacy)
- ✅ Storage service properly handles presigned URL expiration (7-day max)
- ✅ Error messages updated to reference Sevalla instead of Cloudinary
- ✅ Backward compatibility maintained for legacy Cloudinary URLs
- ✅ Frontend image loader handles both R2 and Cloudinary URLs
- ✅ SuperAdmin uses backend APIs (no direct Cloudinary/AWS calls)
- ✅ Profile update errors fixed with proper error handling
- ✅ Cache and socket operations are non-blocking
- ✅ Documentation updated with latest changes

