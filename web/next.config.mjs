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
    const origin =
      process.env.BACKEND_ORIGIN ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "http://localhost:3000";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${origin.replace(/\/$/, "")}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;

