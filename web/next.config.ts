import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      allowedOrigins: [
        process.env.AGROSMART_PUBLIC_ORIGIN ?? "http://localhost:3000",
      ],
    },
  },
};

export default nextConfig;
