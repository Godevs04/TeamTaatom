/**
 * Where to open a piece of content: long videos in the watch screen, shorts in the
 * main Shorts tab feed (scrollable), photo posts on the post screen.
 * Mirrors getScreenForType in backend/src/utils/sendNotification.js so push taps
 * and in-app taps agree.
 */
export function contentRoute(
  postId: string,
  postType?: string | null,
  _ownerId?: string | null,
  options: { openComments?: boolean } = {}
): string {
  const id = encodeURIComponent(postId);
  const comments = options.openComments ? 'comments=1' : '';
  if (postType === 'long_video') {
    return `/watch/${id}${comments ? `?${comments}` : ''}`;
  }
  if (postType === 'short') {
    // Main Shorts tab: pin this short then continue the vertical feed (not single-locked fullscreen)
    return `/(tabs)/shorts?shortId=${id}${comments ? `&${comments}` : ''}`;
  }
  // Photos, and unknown types: the post screen
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
