import type { NextConfig } from "next";

// GitHub Pages: STATIC_EXPORT=1 writes a static site to out/, and NEXT_PUBLIC_BASE_PATH is the repo
// sub-path (/mastercard-x-microsoft). Local dev leaves both unset.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  ...(process.env.STATIC_EXPORT === "1" && { output: "export", trailingSlash: true }),
  basePath,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
