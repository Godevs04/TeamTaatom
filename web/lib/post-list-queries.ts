import type { QueryClient } from "@tanstack/react-query";

/**
 * Every react-query key whose cached data holds a list of posts rendered by PostCard.
 *
 * These are key *prefixes*. `invalidateQueries` defaults to `exact: false`, so
 * ["hashtag-posts"] matches ["hashtag-posts", <tagSlug>] for every tag, and
 * ["feed"] matches ["feed", <feedMode>] for every mode.
 *
 * Add to this list when a new surface renders PostCard, rather than hard-coding
 * keys inside individual mutation handlers — a handler that knows about only some
 * of these leaves the rest showing stale posts after a mutation succeeds.
 */
export const POST_LIST_QUERY_KEYS: readonly (readonly string[])[] = [
  ["feed"],
  ["watch"],
  ["user-long-videos"],
  ["saved-posts"],
  ["hashtag-posts"],
];

/**
 * Refetch every post-list surface after a mutation changes a post in place
 * (caption edited, comments toggled, post deleted/archived/hidden, like toggled).
 *
 * Callers may still optimistically patch individual caches beforehand for an
 * instant update; this runs after and reconciles them all against the server.
 */
export function invalidatePostListQueries(qc: QueryClient) {
  for (const queryKey of POST_LIST_QUERY_KEYS) {
    void qc.invalidateQueries({ queryKey });
  }
}

type PostLike = { _id: string } & Record<string, unknown>;
type PagedPosts = { pages: Array<{ posts?: PostLike[]; videos?: PostLike[] } & Record<string, unknown>> };

/**
 * Patch one post wherever it is cached (infinite lists and flat { posts } caches)
 * without a refetch — for counters the server returns directly, like sharesCount.
 */
export function patchPostInLists(qc: QueryClient, postId: string, patch: Record<string, unknown>) {
  const mapList = (list?: PostLike[]) => list?.map((p) => (p._id === postId ? { ...p, ...patch } : p));
  for (const queryKey of POST_LIST_QUERY_KEYS) {
    qc.setQueriesData<unknown>({ queryKey }, (old: unknown) => {
      if (!old || typeof old !== "object") return old;
      if ("pages" in old && Array.isArray((old as PagedPosts).pages)) {
        const paged = old as PagedPosts;
        return {
          ...paged,
          pages: paged.pages.map((page) => ({
            ...page,
            ...(page.posts ? { posts: mapList(page.posts) } : {}),
            ...(page.videos ? { videos: mapList(page.videos) } : {}),
          })),
        };
      }
      if ("posts" in old && Array.isArray((old as { posts: unknown }).posts)) {
        return { ...(old as object), posts: mapList((old as { posts: PostLike[] }).posts) };
      }
      return old;
    });
  }
}
