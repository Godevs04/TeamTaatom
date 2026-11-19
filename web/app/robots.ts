import type { MetadataRoute } from "next";
import { config } from "../lib/config";

export default function robots(): MetadataRoute.Robots {
  // Same host rules as sitemap — never advertise localhost to Googlebot.
  let base = config.webUrl;
  if (/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(base)) {
    base = "https://taatom.com";
  }
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
