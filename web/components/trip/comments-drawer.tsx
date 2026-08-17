"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "../ui/button";
import { TripComments } from "./comments";
import { useMounted } from "../../hooks/use-mounted";
import type { Post } from "../../types/post";

export function CommentsDrawer({ post, onClose }: { post: Post | null; onClose: () => void }) {
  const mounted = useMounted();
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {post && (
        <div
          // Portaled straight into document.body so no ancestor's `space-y-*` spacing
          // utility (a real bug we hit: margin-top from a parent's space-y-* leaked onto
          // this fixed overlay via CSS's normal sibling-margin rules) or stacking context
          // can trap or bury it. z-[100] sits unambiguously above both the site header
          // (z-40, site-header.tsx) and the mobile bottom-nav "More" sheet (z-50,
          // mobile-bottom-nav.tsx), which this drawer must always render in front of.
          className="fixed inset-0 z-[100] bg-slate-950/55 backdrop-blur-sm"
          role="presentation"
          onClick={onClose}
        >
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Comments"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 36 }}
            className="absolute right-0 top-0 h-full w-full max-w-xl border-l border-slate-200/80 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3 dark:border-zinc-800 sm:px-5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-zinc-50">
                    {post.caption || "Trip comments"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    {post.user?.fullName || post.user?.username || "Traveler"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-xl"
                  aria-label="Close comments"
                  onClick={onClose}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                <TripComments postId={post._id} />
              </div>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
