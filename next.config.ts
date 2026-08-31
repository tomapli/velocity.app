import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "f623-178-249-209-172.ngrok-free.app",
    "1fab-178-249-209-172.ngrok-free.app",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
      },
    ],
  },
};

export default nextConfig;

// Exposes Cloudflare bindings to `next dev` via `getCloudflareContext()`.
// No-op outside `next dev`; see https://opennext.js.org/cloudflare/get-started
initOpenNextCloudflareForDev();
