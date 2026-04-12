import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.1.10",
    "192.168.1.*",
    "*.local",
    "*.nip.io",
  ],
};

export default nextConfig;
