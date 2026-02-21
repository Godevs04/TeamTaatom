import type { Metadata } from "next";
import { config } from "./config";

const APP_NAME = "Taatom";
const DEFAULT_DESCRIPTION = "Discover trips, stories, and travelers around the world. Share your journey with photos, location, and music.";

export function createMetadata(overrides: {
  title?: string | null;
  description?: string | null;
  image?: string | null;
  path?: string;
  noIndex?: boolean;
}): Metadata {
  const base = config.webUrl;
  const path = overrides.path ?? "";
  const canonical = path ? `${base}${path.startsWith("/") ? path : `/${path}`}` : base;
  const title = overrides.title ? `${overrides.title} · ${APP_NAME}` : `${APP_NAME} — Travel stories that feel alive`;
  const description = overrides.description ?? DEFAULT_DESCRIPTION;
  const image = overrides.image ? (overrides.image.startsWith("http") ? overrides.image : `${base}${overrides.image}`) : undefined;

  return {
    title: overrides.title ?? undefined,
    description,
    metadataBase: new URL(base),
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: APP_NAME,
      type: "website",
      ...(image && { images: [{ url: image }] }),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(image && { images: [image] }),
    },
    ...(overrides.noIndex && { robots: { index: false, follow: false } }),
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
