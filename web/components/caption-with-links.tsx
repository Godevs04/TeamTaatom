"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseCaptionParts } from "../lib/caption-parts";
import { searchUsers } from "../lib/api";
import { cn } from "../lib/utils";

type CaptionWithLinksProps = {
  text: string;
  /** Root element for accessibility / SEO */
  as?: "p" | "h1" | "span";
  className?: string;
  /** Extra classes for #hashtag and @mention links */
  linkClassName?: string;
};

export function CaptionWithLinks({ text, as: Tag = "span", className, linkClassName }: CaptionWithLinksProps) {
  const router = useRouter();
  const [loadingMention, setLoadingMention] = React.useState<string | null>(null);

  const parts = React.useMemo(() => parseCaptionParts(text), [text]);

  const onMention = React.useCallback(
    async (username: string) => {
      setLoadingMention(username);
      try {
        const { users } = await searchUsers(username, 15);
        const lower = username.toLowerCase();
        const exact =
          users.find((u) => (u.username || "").toLowerCase() === lower) ?? users[0];
        if (exact?._id) {
          router.push(`/profile/${exact._id}`);
        } else {
          router.push(`/search?q=${encodeURIComponent(username)}`);
        }
      } catch {
        router.push(`/search?q=${encodeURIComponent(username)}`);
      } finally {
        setLoadingMention(null);
      }
    },
    [router]
  );

  if (!parts.length) return null;

  const linkCn = cn("font-semibold text-primary hover:underline", linkClassName);
  const onlyText = parts.every((p) => p.type === "text");

  const inner = onlyText ? (
    <>{parts.map((p, i) => (p.text ? <span key={i}>{p.text}</span> : null))}</>
  ) : (
    <>
      {parts.map((part, index) => {
        if (part.type === "hashtag" && part.value) {
          return (
            <Link
              key={index}
              href={`/hashtag/${encodeURIComponent(part.value)}`}
              className={linkCn}
              prefetch={false}
            >
              {part.text}
            </Link>
          );
        }
        if (part.type === "mention" && part.value) {
          const busy = loadingMention === part.value;
          return (
            <button
              key={index}
              type="button"
              className={cn(linkCn, "cursor-pointer border-0 bg-transparent p-0", busy && "opacity-60")}
              disabled={busy}
              onClick={() => void onMention(part.value!)}
            >
              {part.text}
            </button>
          );
        }
        return part.text ? <span key={index}>{part.text}</span> : null;
      })}
    </>
  );

  return (
    <Tag className={cn("whitespace-pre-wrap break-words", className)}>
      {inner}
    </Tag>
  );
}
