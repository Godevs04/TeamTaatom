import type { MetadataRoute } from "next";
import { config } from "../lib/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = config.webUrl;

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${base}/feed`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/search`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/auth/login`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/auth/register`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  ];

  // Dynamic trip and profile URLs can be added by fetching from API and merging here
  return staticRoutes;
}
