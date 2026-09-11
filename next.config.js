/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  eslint: {
    // Type errors still fail the build; this just stops an unconfigured
    // ESLint from blocking `next build` in fresh checkouts.
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
