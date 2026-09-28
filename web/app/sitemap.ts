import type { MetadataRoute } from "next";
import { config } from "../lib/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = config.webUrl;
  const now = new Date();

  return [
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/download`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/copyrights`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/child-safety`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}