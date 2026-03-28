import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  async rewrites() {
    return [
      { source: "/duel/:id*/", destination: "/duel/" },
      { source: "/wordle/duel/:id*/", destination: "/wordle/duel/" },
    ];
  },
};

export default nextConfig;
