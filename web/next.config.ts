import type { NextConfig } from "next";

function splitCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toHost(value: string): string {
  try {
    return new URL(value).host;
  } catch {
    return value
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "")
      .trim();
  }
}

const publicOrigin =
  process.env.AGROSMART_PUBLIC_ORIGIN ?? "http://localhost:3000";

const serverActionAllowedOrigins = Array.from(
  new Set([
    publicOrigin,
    ...splitCsv(process.env.AGROSMART_SERVER_ACTION_ALLOWED_ORIGINS),
  ]),
);

const allowedDevOrigins = Array.from(
  new Set([
    "localhost:3000",
    "127.0.0.1:3000",
    ...serverActionAllowedOrigins.map(toHost),
    ...splitCsv(process.env.AGROSMART_ALLOWED_DEV_ORIGINS).map(toHost),
  ]),
);

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins,
  experimental: {
    serverActions: {
      allowedOrigins: serverActionAllowedOrigins,
    },
  },
};

export default nextConfig;
