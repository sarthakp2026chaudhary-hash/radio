import type { NextConfig } from "next";
// @ts-expect-error - next-pwa doesn't have types
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.1.10",
    "192.168.1.*",
    "*.local",
    "*.nip.io",
  ],
  // Empty turbopack config to allow webpack plugins (next-pwa)
  turbopack: {},
};

export default withPWA(nextConfig);
