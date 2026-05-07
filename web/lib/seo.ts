import type { Metadata } from "next";
import { config } from "./config";

const APP_NAME = "Taatom";
const DEFAULT_TITLE = "Taatom — Travel stories that feel alive";
const DEFAULT_DESCRIPTION =
  "Discover trips, stories, and travelers around the world. Share your journey with photos, location, and music. Join Taatom and bring your travel stories to life.";
const KEYWORDS = [
  "Taatom",
  "travel",
  "travel stories",
  "travel app",
  "trips",
  "travelers",
  "share trips",
  "travel photos",
  "travel community",
  "adventure",
  "explore",
];

export function createMetadata(overrides: {
  title?: string | null;
  description?: string | null;
  image?: string | null;
  path?: string;
  noIndex?: boolean;
  /** Use `article` for shareable trip/post pages (W-06). */
  openGraphType?: "website" | "article";
  /** Defaults to 512×512; use 1200×630 for large share images (trips). */
  ogImageSize?: { width: number; height: number };
  /** Alt for OG/Twitter image (e.g. post caption snippet). */
  ogImageAlt?: string;
}): Metadata {
  const FALLBACK_BASE = "http://localhost:3001";
  const baseRaw = typeof config.webUrl === "string" && config.webUrl.trim() ? config.webUrl.trim() : FALLBACK_BASE;
  let base = FALLBACK_BASE;
  try {
    base = new URL(baseRaw).origin;
  } catch {
    base = FALLBACK_BASE;
  }
  // metadataBase must be a valid URL; double-guard against any future regression
  let metadataBaseUrl: URL;
  try {
    metadataBaseUrl = new URL(base);
  } catch {
    metadataBaseUrl = new URL(FALLBACK_BASE);
  }
  const path = overrides.path ?? "";
  const canonical = path ? `${base}${path.startsWith("/") ? path : `/${path}`}` : base;
  const title = overrides.title ? `${overrides.title} · ${APP_NAME}` : DEFAULT_TITLE;
  const description = overrides.description ?? DEFAULT_DESCRIPTION;
  const rawImage = typeof overrides.image === "string" ? overrides.image.trim() : "";
  const validImage = rawImage && rawImage !== "null" && rawImage !== "undefined" ? rawImage : "";
  const image = validImage
    ? (validImage.startsWith("http") ? validImage : `${base}${validImage.startsWith("/") ? "" : "/"}${validImage}`)
    : `${base}/icon.png`;
  const ogType = overrides.openGraphType ?? "website";
  const imgW = overrides.ogImageSize?.width ?? 512;
  const imgH = overrides.ogImageSize?.height ?? 512;
  const imgAlt = overrides.ogImageAlt ?? (overrides.title ? String(overrides.title) : APP_NAME);

  return {
    title: overrides.title ? `${overrides.title} · ${APP_NAME}` : undefined,
    description,
    keywords: KEYWORDS,
    authors: [{ name: APP_NAME, url: base }],
    creator: APP_NAME,
    publisher: APP_NAME,
    metadataBase: metadataBaseUrl,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: APP_NAME,
      type: ogType,
      locale: "en_US",
      images: [{ url: image, width: imgW, height: imgH, alt: imgAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
    robots: overrides.noIndex ? { index: false, follow: false } : { index: true, follow: true, googleBot: { index: true, follow: true } },
    verification: {
      // Add when you have them: google: "google-site-verification-code", yandex: "yandex-verification-code"
    },
    category: "travel",
  };
}

export function mergeMetadata(base: Metadata, patch: Metadata): Metadata {
  return {
    ...base,
    ...patch,
    openGraph: { ...base.openGraph, ...patch.openGraph },
    twitter: { ...base.twitter, ...patch.twitter },
  };
}
