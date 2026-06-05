import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the Turbopack workspace root to this app dir. Without this, Next infers
  // the root from the nearest lockfile, which is ambiguous in this monorepo
  // (repo-root vs web/) and produced stale React Client Manifest errors when it
  // flipped between runs.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
