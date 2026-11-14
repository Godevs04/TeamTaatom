/**
 * Where to open a piece of content: long videos on the watch page, shorts in the
 * creator's shorts player, photo posts on the trip page. Mirrors the mobile app's
 * contentRoute so notifications open the same content on both.
 */
export function contentHref(
  postId: string,
  postType?: string | null,
  ownerId?: string | null,
  options: { openComments?: boolean } = {}
): string {
  const id = encodeURIComponent(postId);
  const hash = options.openComments ? "#comments" : "";
  if (postType === "long_video") return `/watch/${id}${hash}`;
  if (postType === "short" && ownerId) {
    return `/shorts?userId=${encodeURIComponent(ownerId)}&postId=${id}`;
  }
  return `/trip/${id}${hash}`;
}

/** Normalizes a populated ref or raw id to a string id. */
export function refId(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "object" && (value as { _id?: unknown })._id != null) {
    return String((value as { _id: unknown })._id);
  }
  const str = String(value);
  return str && str !== "[object Object]" ? str : null;
}

export function contentNoun(postType?: string | null): "video" | "short" | "post" {
  if (postType === "long_video") return "video";
  if (postType === "short") return "short";
  return "post";
}
