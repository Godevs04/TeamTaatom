/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
    // Image CDN: for Cloudinary use loader: "cloudinary", images.domains or remotePatterns.
    // For a custom CDN set IMAGE_CDN_BASE_URL and use next/image with a loader in components.
  },
  async rewrites() {
    // All values from env only (no hardcoded IPs). Set in .env.local: BACKEND_ORIGIN, BACKEND_PROXY_TARGET.
    const backendFromEnv =
      process.env.BACKEND_PROXY_TARGET ||
      process.env.BACKEND_ORIGIN ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_BASE;
    const isDev = process.env.NODE_ENV !== "production";
    const origin =
      (isDev && backendFromEnv) ? backendFromEnv
        : isDev ? "http://localhost:3000"
        : (backendFromEnv || "http://localhost:3000");
    const base = origin.replace(/\/$/, "");
    return [
      {
        source: "/api/v1/:path*",
        destination: `${base}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;

