/**
 * Public social destinations for Taatom web (override via NEXT_PUBLIC_* in .env.local).
 * Falls back to each network’s home so links are never broken in dev.
 */
export type SocialId = "instagram" | "x" | "youtube" | "facebook";

const FALLBACK: Record<SocialId, string> = {
  instagram: "https://www.instagram.com/",
  x: "https://x.com/",
  youtube: "https://www.youtube.com/",
  facebook: "https://www.facebook.com/",
};

export type SocialLink = {
  id: SocialId;
  label: string;
  href: string;
};

export function getSocialLinks(): SocialLink[] {
  const raw: [SocialId, string | undefined][] = [
    ["instagram", process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL],
    ["x", process.env.NEXT_PUBLIC_SOCIAL_X_URL],
    ["youtube", process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE_URL],
    ["facebook", process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK_URL],
  ];

  const labels: Record<SocialId, string> = {
    instagram: "Instagram",
    x: "X (Twitter)",
    youtube: "YouTube",
    facebook: "Facebook",
  };

  return raw.map(([id, url]) => ({
    id,
    label: labels[id],
    href: (url && url.trim()) || FALLBACK[id],
  }));
}
