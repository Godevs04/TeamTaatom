/**
 * Format bytes into human-readable string (MB / GB)
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted string (e.g. "1.2 GB", "450 MB")
 */
function formatStorageSize(bytes) {
  if (typeof bytes !== 'number' || bytes < 0 || !Number.isFinite(bytes)) {
    return '0 B';
  }
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

module.exports = { formatStorageSize };
