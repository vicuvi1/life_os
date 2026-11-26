/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    // Identifies this build so an open tab can tell when a newer one is live
    // (see components/version-watcher.tsx). Vercel sets the commit SHA.
    NEXT_PUBLIC_BUILD_ID:
      process.env.NEXT_PUBLIC_BUILD_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
  },
  webpack: (config) => {
    // Allow importing Markdown files as raw strings (used to render
    // MILESTONES.md inside the app so there is a single source of truth).
    config.module.rules.push({
      test: /\.md$/,
      type: "asset/source",
    });
    return config;
  },
};

export default nextConfig;
