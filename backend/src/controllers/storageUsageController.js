/**
 * Storage Usage Controller
 * Returns bucket usage stats for admin dashboard (R2/S3-compatible).
 * Uses AWS SDK v3 ListObjectsV2 with pagination.
 */

const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { sendError, sendSuccess } = require('../utils/errorCodes');
const { formatStorageSize } = require('../utils/formatStorageSize');
const logger = require('../utils/logger');

/**
 * GET /admin/storage-usage
 * Returns total objects, total size (bytes), and formatted size.
 * Admin-protected via route middleware.
 */
async function getStorageUsage(req, res) {
  const endpoint = process.env.SEVALLA_STORAGE_ENDPOINT;
  const region = process.env.SEVALLA_STORAGE_REGION || 'auto';
  const accessKey = process.env.SEVALLA_STORAGE_ACCESS_KEY;
  const secretKey = process.env.SEVALLA_STORAGE_SECRET_KEY;
  const bucket = process.env.SEVALLA_STORAGE_BUCKET;

  if (!endpoint || !accessKey || !secretKey || !bucket) {
    logger.warn('Storage usage: Missing R2/Sevalla storage configuration');
    return sendError(res, 'SRV_6001', 'Storage configuration not available');
  }

  const s3Client = new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
    forcePathStyle: true,
  });

  let totalObjects = 0;
  let totalSizeBytes = 0;
  const folderBreakdown = {};
  let continuationToken;
  let pageCount = 0;
  const MAX_PAGES = 1000; // Safety limit (~1M objects)

  try {
    do {
      const params = {
        Bucket: bucket,
        MaxKeys: 1000,
      };
      if (continuationToken) {
        params.ContinuationToken = continuationToken;
      }

      const command = new ListObjectsV2Command(params);
      const response = await s3Client.send(command);

      if (response.Contents && Array.isArray(response.Contents)) {
        for (const obj of response.Contents) {
          const size = (obj.Size && typeof obj.Size === 'number') ? obj.Size : 0;
          totalObjects += 1;
          totalSizeBytes += size;

          // Derive top-level folder from key (e.g. "posts/...", "profiles/...")
          const key = obj.Key || '';
          const topLevel = key.split('/')[0] || 'root';
          if (!folderBreakdown[topLevel]) {
            folderBreakdown[topLevel] = { totalObjects: 0, totalSizeBytes: 0 };
          }
          folderBreakdown[topLevel].totalObjects += 1;
          folderBreakdown[topLevel].totalSizeBytes += size;
        }
      }

      pageCount += 1;
      continuationToken = response.IsTruncated && response.NextContinuationToken
        ? response.NextContinuationToken
        : undefined;

      if (pageCount >= MAX_PAGES) {
        logger.warn('Storage usage: Reached max pages limit, results may be partial');
        break;
      }
    } while (continuationToken);

    logger.debug('Storage usage:', { bucket, totalObjects, totalSizeBytes, pageCount });

    const totalSizeFormatted = formatStorageSize(totalSizeBytes);

    // Attach formatted breakdown per top-level folder
    const folderStats = {};
    Object.entries(folderBreakdown).forEach(([folder, stats]) => {
      folderStats[folder] = {
        totalObjects: stats.totalObjects,
        totalSizeBytes: stats.totalSizeBytes,
        totalSizeFormatted: formatStorageSize(stats.totalSizeBytes),
        percentOfTotal:
          totalSizeBytes > 0 ? Number(((stats.totalSizeBytes / totalSizeBytes) * 100).toFixed(1)) : 0,
      };
    });

    return sendSuccess(res, 200, 'Storage usage retrieved', {
      totalObjects,
      totalSizeBytes,
      totalSizeFormatted,
      bucket, // So admin can verify same bucket as CLI
      folders: folderStats,
    });
  } catch (error) {
    logger.error('Storage usage error:', error?.message || error);
    return sendError(res, 'SRV_6001', 'Failed to retrieve storage usage');
  }
}

module.exports = {
  getStorageUsage,
};
