"use client";

import * as React from "react";
import { api } from "../lib/axios";

function recordContentView(postId: string, watchMs: number) {
  void api
    .post("/analytics/events", {
      events: [
        {
          event: "post_view",
          platform: "web",
          timestamp: new Date().toISOString(),
          properties: {
            post_id: postId,
            watch_ms: watchMs,
            source: "web",
          },
        },
      ],
    })
    .catch(() => {});
}

export function ContentViewPing({
  postId,
  delayMs,
  watchMs,
}: {
  postId: string;
  delayMs: number;
  watchMs: number;
}) {
  React.useEffect(() => {
    if (!postId) return undefined;
    const timer = window.setTimeout(() => recordContentView(postId, watchMs), delayMs);
    return () => window.clearTimeout(timer);
  }, [postId, delayMs, watchMs]);

  return null;
}
