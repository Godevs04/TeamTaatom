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
