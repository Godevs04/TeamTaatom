/** Compact view count (1.2K / 3M) — same rules as mobile utils/numberFormat.formatViewCount. */
export function formatViewCount(views: number | null | undefined): string {
  if (views === null || views === undefined || Number.isNaN(views) || views < 0) return "0";
  const compact = (value: number, divisor: number, suffix: string) => {
    const formatted = (value / divisor).toFixed(1);
    return formatted.endsWith(".0") ? `${Math.floor(value / divisor)}${suffix}` : `${formatted}${suffix}`;
  };
  if (views >= 1_000_000) return compact(views, 1_000_000, "M");
  if (views >= 1_000) return compact(views, 1_000, "K");
  return String(views);
}
