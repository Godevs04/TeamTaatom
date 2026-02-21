"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { getFeed } from "../lib/api";

export function useFeed() {
  return useInfiniteQuery({
    queryKey: ["feed"],
    queryFn: async ({ pageParam }) => {
      // cursor-based pagination (preferred)
      return getFeed({ limit: 10, useCursor: true, cursor: pageParam as string | undefined });
    },
    getNextPageParam: (lastPage) => {
      const p: any = lastPage.pagination;
      if (p?.hasNextPage && p?.cursor) return p.cursor;
      return undefined;
    },
    initialPageParam: undefined as unknown as string | undefined,
  });
}

