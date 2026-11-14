/**
 * Where to open a piece of content: long videos in the watch screen, shorts in the
 * creator's shorts viewer, photo posts on the post screen. Mirrors getScreenForType
 * in backend/src/utils/sendNotification.js so push taps and in-app taps agree.
 */
export function contentRoute(
  postId: string,
  postType?: string | null,
  ownerId?: string | null,
  options: { openComments?: boolean } = {}
): string {
  const id = encodeURIComponent(postId);
  const comments = options.openComments ? 'comments=1' : '';
  if (postType === 'long_video') {
    return `/watch/${id}${comments ? `?${comments}` : ''}`;
  }
  if (postType === 'short' && ownerId) {
    return `/user-shorts/${encodeURIComponent(ownerId)}?shortId=${id}&single=true${comments ? `&${comments}` : ''}`;
  }
  // Photos, and shorts whose owner isn't known yet: the post screen redirects by type
  return `/post/${id}${comments ? `?${comments}` : ''}`;
}

/** Normalizes a populated ref or raw id to a string id. */
export function refId(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'object' && (value as { _id?: unknown })._id != null) {
    return String((value as { _id: unknown })._id);
  }
  const str = String(value);
  return str && str !== '[object Object]' ? str : null;
}

export function contentNoun(postType?: string | null): 'video' | 'short' | 'post' {
  if (postType === 'long_video') return 'video';
  if (postType === 'short') return 'short';
  return 'post';
}
