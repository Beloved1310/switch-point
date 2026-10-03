import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The end-to-end suite builds into its own directory so it can run beside `next dev`.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
