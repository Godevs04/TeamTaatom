/**
 * Standardized utility function to format view counts and other large integers.
 * Converts large numbers into readable suffix strings (e.g. 15430 -> 15.4K, 1200000 -> 1.2M).
 * Gracefully handles nulls, undefined, NaNs, and negative values by defaulting to '0'.
 */
export function formatViewCount(views: number | null | undefined): string {
  if (views === null || views === undefined || isNaN(views) || views < 0) {
    return '0';
  }

  if (views >= 1000000) {
    const formatted = (views / 1000000).toFixed(1);
    // Remove .0 suffix if not needed (e.g., 1.0M -> 1M)
    return formatted.endsWith('.0') ? `${Math.floor(views / 1000000)}M` : `${formatted}M`;
  }

  if (views >= 1000) {
    const formatted = (views / 1000).toFixed(1);
    // Remove .0 suffix if not needed (e.g., 15.0K -> 15K)
    return formatted.endsWith('.0') ? `${Math.floor(views / 1000)}K` : `${formatted}K`;
  }

  return String(views);
}
