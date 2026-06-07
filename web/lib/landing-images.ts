/**
 * Verified Unsplash URLs for the marketing page.
 * Uses auto=format&fit=crop so Next.js image optimization receives valid upstream responses.
 */
export function unsplash(photoId: string, width: number, quality = 80): string {
  return `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=${width}&q=${quality}`;
}

export const LANDING_IMAGES = {
  hero: {
    mountains: unsplash("1506905925346-21bda4d32df4", 560, 85),
    lake: unsplash("1501785888041-af3ef285b470", 480, 85),
    city: unsplash("1523906834658-6e24ef2386f9", 480, 85),
    creatorAvatar: unsplash("1534528741775-53994a69daeb", 96, 80),
  },
  stories: {
    iceland: unsplash("1506905925346-21bda4d32df4", 900, 88),
    japan: unsplash("1523906834658-6e24ef2386f9", 900, 88),
    kerala: unsplash("1469474968028-56623f02e42e", 900, 88),
    coast: unsplash("1507525428034-b723cf961d3e", 900, 88),
  },
  avatars: [
    unsplash("1507003211169-0a1dd7228f2d", 96, 80),
    unsplash("1494790108377-be9c29b29330", 96, 80),
    unsplash("1500648767791-00dcc994a43e", 96, 80),
    unsplash("1438761681033-6461ffad8d80", 96, 80),
    unsplash("1472099645785-5658abf4ff4e", 96, 80),
    unsplash("1534528741775-53994a69daeb", 96, 80),
  ],
  reels: [
    unsplash("1506905925346-21bda4d32df4", 400, 80),
    unsplash("1501785888041-af3ef285b470", 400, 80),
    unsplash("1469474968028-56623f02e42e", 400, 80),
  ],
  creators: [
    { name: "Elena Park", img: unsplash("1534528741775-53994a69daeb", 200, 80) },
    { name: "Marcus Reid", img: unsplash("1506794778202-cad84cf45f1d", 200, 80) },
    { name: "Sofia Reyes", img: unsplash("1517841905240-472988babdf9", 200, 80) },
  ],
  product: {
    feed: unsplash("1506905925346-21bda4d32df4", 800, 85),
    story: unsplash("1523906834658-6e24ef2386f9", 600, 85),
    profile: unsplash("1534528741775-53994a69daeb", 200, 80),
  },
  testimonials: {
    featured: unsplash("1531123897727-8f129e1688ce", 400, 85),
    small: [
      unsplash("1506794778202-cad84cf45f1d", 200, 80),
      unsplash("1580489944761-15a19d654956", 200, 80),
      unsplash("1517841905240-472988babdf9", 200, 80),
    ],
  },
  ctaBackground: unsplash("1469474968028-56623f02e42e", 1600, 80),
} as const;
