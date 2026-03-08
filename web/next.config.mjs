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
    const envOrigin =
      process.env.BACKEND_ORIGIN ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "http://localhost:3000";
    // In development, always proxy to localhost so the local backend is used (avoids ECONNREFUSED
    // when BACKEND_ORIGIN is set to a LAN IP like 192.168.1.33 but the backend only listens on 127.0.0.1).
    const isDev = process.env.NODE_ENV !== "production";
    const origin =
      isDev && process.env.BACKEND_PROXY_TARGET
        ? process.env.BACKEND_PROXY_TARGET
        : isDev
          ? "http://localhost:3000"
          : envOrigin;
    return [
      {
        source: "/api/v1/:path*",
        destination: `${origin.replace(/\/$/, "")}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;

