"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, ImageIcon } from "lucide-react";
import type { ParsedPostShare } from "../../lib/post-share-chat";
import { getWebBrandingHost } from "../../lib/post-share-chat";
import { getPostById } from "../../lib/api";
import { cn } from "../../lib/utils";

type PostShareCardProps = {
  share: ParsedPostShare;
  /** Message bubble is from current user */
  isSent: boolean;
};

async function resolvePostImageUrl(postId: string): Promise<string> {
  const post = await getPostById(postId);
  return (
    post.imageUrl ||
    (Array.isArray(post.images) && post.images[0]) ||
    post.thumbnailUrl ||
    post.mediaUrl ||
    ""
  );
}

export function PostShareCard({ share, isSent }: PostShareCardProps) {
  const { postId, caption, authorName } = share;
  const [displayUrl, setDisplayUrl] = React.useState(share.imageUrl || "");
  const [showPlaceholder, setShowPlaceholder] = React.useState(!share.imageUrl);
  const imageResolveAttempts = React.useRef(0);

  const brandingHost = React.useMemo(() => getWebBrandingHost(), []);
  const tripHref = `/trip/${postId}`;

  React.useEffect(() => {
    setDisplayUrl(share.imageUrl || "");
    setShowPlaceholder(!share.imageUrl);
    imageResolveAttempts.current = 0;
  }, [share.imageUrl, postId]);

  const tryRefreshImage = React.useCallback(async () => {
    if (!postId || imageResolveAttempts.current >= 2) {
      setShowPlaceholder(true);
      return;
    }
    imageResolveAttempts.current += 1;
    try {
      const url = await resolvePostImageUrl(postId);
      if (url) {
        setDisplayUrl(url);
        setShowPlaceholder(false);
      } else {
        setShowPlaceholder(true);
      }
    } catch {
      setShowPlaceholder(true);
    }
  }, [postId]);

  React.useEffect(() => {
    if (!postId || share.imageUrl) return;
    tryRefreshImage();
  }, [postId, share.imageUrl, tryRefreshImage]);

  return (
    <Link
      href={tripHref}
      className={cn(
        "block max-w-[min(100%,320px)] overflow-hidden rounded-2xl border shadow-md transition-opacity hover:opacity-95 focus-visible:outline focus-visible:ring-2 focus-visible:ring-offset-2",
        isSent
          ? "border-white/40 bg-white text-slate-900 shadow-black/10 focus-visible:ring-white dark:border-white/25 dark:bg-zinc-100 dark:text-slate-900"
          : "border-slate-200/90 bg-white text-slate-900 focus-visible:ring-primary dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
      )}
    >
      <div
        className={cn(
          "relative aspect-[4/3] w-full bg-slate-100 dark:bg-zinc-800",
          isSent && "bg-slate-200 dark:bg-zinc-700"
        )}
      >
        {!showPlaceholder && displayUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={displayUrl}
            alt=""
            className="h-full w-full object-cover"
            onError={() => {
              setDisplayUrl("");
              void tryRefreshImage();
            }}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-400 dark:text-zinc-500">
            <ImageIcon className="h-10 w-10" aria-hidden />
            <span className="text-xs font-medium">Taatom post</span>
          </div>
        )}
      </div>
      <div className="space-y-1 px-3 py-2.5">
        {authorName ? (
          <p className="text-xs font-semibold text-slate-600 dark:text-zinc-300">{authorName}</p>
        ) : null}
        {caption ? (
          <p className="line-clamp-3 text-sm leading-snug text-slate-800 dark:text-zinc-100">{caption}</p>
        ) : (
          <p className="text-sm italic text-slate-500 dark:text-zinc-400">Shared a post</p>
        )}
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2 dark:border-zinc-700">
          <span className="flex items-center gap-1 text-xs font-semibold text-primary">
            <ExternalLink className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
            {brandingHost}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-zinc-500">Open</span>
        </div>
      </div>
    </Link>
  );
}
