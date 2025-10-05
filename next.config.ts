import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "https://securevaultbackend.onrender.com/api/:path*", // your backend API
      },
    ];
  },
  reactStrictMode: true,
};

export default nextConfig;
