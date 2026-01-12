import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},  // ← This silences the Turbopack warning

  // Vercel will serve `public/` assets automatically, but we add explicit caching
  // headers for the Stockfish bundle because it’s large and rarely changes.
  async headers() {
    return [
      {
        source: "/stockfish/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
