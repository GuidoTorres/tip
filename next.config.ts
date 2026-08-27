import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  headers() {
    return [{
      source: "/.well-known/apple-developer-merchantid-domain-association",
      headers: [{ key: "Content-Type", value: "application/octet-stream" }],
    }];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
