import type { MetadataRoute } from "next";
import { config } from "../lib/config";

export default function robots(): MetadataRoute.Robots {
  const base = config.webUrl;

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/auth/verify-otp", "/auth/reset-password"],
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: ["/api/", "/auth/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
