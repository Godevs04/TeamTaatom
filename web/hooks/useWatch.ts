"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { getLongVideos } from "../lib/api";
import type { PaginationOffset } from "../types/api";

const WATCH_PER_PAGE = 15;

export function useWatch() {
  return useInfiniteQuery({
    queryKey: ["watch"],
    queryFn: async ({ pageParam }) => {
      return getLongVideos({
        page: pageParam as number,
        limit: WATCH_PER_PAGE,
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
