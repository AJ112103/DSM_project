import type { NextConfig } from "next";

// /api/* requests now go directly from the browser to the backend (set
// NEXT_PUBLIC_API_URL in Vercel project settings). The previous /api/*
// rewrite added ~500ms of Vercel proxy hop on every call. We still rewrite
// /visualizations/* because it's used as <img src> with a relative path.
const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/visualizations/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/visualizations/:path*`,
      },
    ];
  },
};

export default nextConfig;
