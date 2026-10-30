import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Only the chat test server sets this (playwright.chat.config.ts), so that it can run
  // next to the normal dev server: each one keeps its lock and cache in its own folder.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
};

export default nextConfig;
