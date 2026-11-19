import type { MetadataRoute } from "next";
import { config } from "../lib/config";

export default function robots(): MetadataRoute.Robots {
  const base = config.webUrl;
  const privatePaths = [
    "/api/",
    "/auth/",
    "/onboarding/",
    "/feed",
    "/shorts",
    "/watch",
    "/search",
    "/chat",
    "/create",
    "/notifications",
    "/saved",
    "/settings",
    "/activity",
    "/discover",
    "/navigate",
    "/collections",
    "/creator-monetization",
    "/upload-long-video",
  ];

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: privatePaths,
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
