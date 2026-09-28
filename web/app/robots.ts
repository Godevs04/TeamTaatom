import type { MetadataRoute } from "next";
import { config } from "../lib/config";

export default function robots(): MetadataRoute.Robots {
  const base = config.webUrl;
  const privatePaths = [
    "/api/",
    "/auth/",
    "/onboarding/",
    "/feed",
    "/search",
    "/chat",
    "/create",
    "/notifications",
    "/saved",
    "/settings",
    "/activity",
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
