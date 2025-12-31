import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",        // Good for Docker/deployment
  reactStrictMode: true,      // Better: true (helps catch bugs)
  // Remove turbopack block completely
};

export default nextConfig;