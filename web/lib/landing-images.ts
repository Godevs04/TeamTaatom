/**
 * Verified Unsplash URLs for the marketing page.
 * Uses auto=format&fit=crop so Next.js image optimization receives valid upstream responses.
 */
export function unsplash(photoId: string, width: number, quality = 80): string {
  return `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=${width}&q=${quality}`;
}

/**
 * Destination photos for the redesigned landing (each label matches the photo).
 * Verified to load from images.unsplash.com.
 */
export const LANDING_PLACES = {
  venice: { id: "1523906834658-6e24ef2386f9", place: "Venice", country: "Italy" },
  braies: { id: "1476514525535-07fb3b4ae5f1", place: "Lago di Braies", country: "Italy" },
  moraine: { id: "1493246507139-91e8fad9978e", place: "Moraine Lake", country: "Canada" },
  roadTrip: { id: "1500530855697-b586d89ba3ee", place: "Desert road trip", country: "USA" },
  paris: { id: "1502602898657-3e91760cbb34", place: "Paris", country: "France" },
  london: { id: "1513635269975-59663e0ac1ad", place: "London", country: "United Kingdom" },
  machuPicchu: { id: "1526392060635-9d6019884377", place: "Machu Picchu", country: "Peru" },
  halong: { id: "1528127269322-539801943592", place: "Ha Long Bay", country: "Vietnam" },
  cappadocia: { id: "1530789253388-582c481c54b0", place: "Cappadocia", country: "Türkiye" },
  bali: { id: "1537996194471-e657df975ab4", place: "Ulun Danu Beratan, Bali", country: "Indonesia" },
  dolomitesFriends: { id: "1539635278303-d4002c07eae3", place: "Dolomites", country: "Italy" },
  lisbonBeach: { id: "1507525428034-b723cf961d3e", place: "Sunset beach", country: "Portugal" },
} as const;

export type LandingPlaceKey = keyof typeof LANDING_PLACES;

export function placeImage(key: LandingPlaceKey, width: number, quality = 82): string {
  return unsplash(LANDING_PLACES[key].id, width, quality);
}

/** Flat-lay "travel journal" textures (no place). */
export const LANDING_TEXTURES = {
  journalFlatlay: unsplash("1504609773096-104ff2c73ba4", 1200, 80),
  mapFlatlay: unsplash("1488646953014-85cb44e25828", 1200, 80),
} as const;

export const LANDING_IMAGES = {
  hero: {
    mountains: unsplash("1506905925346-21bda4d32df4", 560, 85),
    lake: unsplash("1501785888041-af3ef285b470", 480, 85),
    city: unsplash("1523906834658-6e24ef2386f9", 480, 85),
    creatorAvatar: unsplash("1534528741775-53994a69daeb", 96, 80),
  },
  stories: {
    iceland: unsplash("1506905925346-21bda4d32df4", 900, 88),
    venice: unsplash("1523906834658-6e24ef2386f9", 900, 88),
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
