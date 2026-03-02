# Storage Usage Module (Admin)

Admin dashboard module for monitoring R2/Sevalla object storage usage.

## Route

- **GET** `/api/v1/superadmin/storage-usage`
- **Auth:** SuperAdmin token required (`Authorization: Bearer <token>`)

## Response

```json
{
  "success": true,
  "message": "Storage usage retrieved",
  "totalObjects": 1234,
  "totalSizeBytes": 1288490188,
  "totalSizeFormatted": "1.2 GB",
  "bucket": "your-bucket-name"
}
```

**If admin panel shows different totals than CLI:** Verify the backend `SEVALLA_STORAGE_BUCKET` matches the bucket your CLI uses. The response includes `bucket` so you can confirm which bucket was queried.

## Environment Variables

Add to `.env` (same as main storage service):

```env
# Sevalla / Cloudflare R2 (S3-compatible)
SEVALLA_STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
SEVALLA_STORAGE_REGION=auto
SEVALLA_STORAGE_ACCESS_KEY=your-access-key
SEVALLA_STORAGE_SECRET_KEY=your-secret-key
SEVALLA_STORAGE_BUCKET=your-bucket-name
```

## Files

- `src/controllers/storageUsageController.js` – Handler
- `src/utils/formatStorageSize.js` – Human-readable size formatter
- Route: `enhancedSuperAdminRoutes.js` → `/storage-usage`
