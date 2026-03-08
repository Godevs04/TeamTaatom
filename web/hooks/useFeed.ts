"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { getFeed, type FeedMode } from "../lib/api";
import type { PaginationOffset } from "../types/api";

const POSTS_PER_PAGE_WEB = 15;

export function useFeed(feedMode: FeedMode = "recents") {
  return useInfiniteQuery({
    queryKey: ["feed", feedMode],
    queryFn: async ({ pageParam }) => {
      return getFeed({
        page: pageParam as number,
        limit: POSTS_PER_PAGE_WEB,
        feed: feedMode,
      });
    },
    getNextPageParam: (lastPage) => {
      const p = lastPage.pagination as PaginationOffset | undefined;
      if (p?.hasNextPage && typeof p.currentPage === "number") return p.currentPage + 1;
      return undefined;
    },
    initialPageParam: 1,
  });
}

