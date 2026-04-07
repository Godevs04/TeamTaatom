/**
 * Display-safe caption sanitization (aligned with mobile utils/sanitize).
 */

export function sanitizeString(input: string | null | undefined): string {
  if (!input || typeof input !== "string") return "";
  let sanitized = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/data:text\/html/gi, "")
    .trim();
  sanitized = sanitized.replace(/<[^>]*>/g, "");
  return sanitized;
}

export function sanitizeHashtag(hashtag: string): string {
  if (!hashtag || typeof hashtag !== "string") return "";
  const withoutHash = hashtag.replace(/^#/, "");
  const cleaned = withoutHash.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 50);
  return cleaned ? `#${cleaned}` : "";
}

function sanitizeUsername(username: string): string {
  if (!username || typeof username !== "string") return "";
  return username.replace(/[^a-zA-Z0-9._]/g, "").slice(0, 30);
}

export function sanitizeMention(mention: string): string {
  if (!mention || typeof mention !== "string") return "";
  const withoutAt = mention.replace(/^@/, "");
  return sanitizeUsername(withoutAt);
}

export function sanitizeTextContent(text: string | null | undefined): string {
  if (!text || typeof text !== "string") return "";
  let sanitized = sanitizeString(text);
  sanitized = sanitized.replace(/<br\s*\/?>/gi, "\n");
  return sanitized;
}
