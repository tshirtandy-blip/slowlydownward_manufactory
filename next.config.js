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
  experimental: {
    // puppeteer-core + @sparticuz/chromium (Certificate of Authenticity PDF
    // generation — see src/lib/coa-pdf.ts) ship a native Chromium binary and
    // must NOT be bundled/traced by webpack like ordinary JS — Next.js
    // should just require() them from node_modules at runtime, same as any
    // other server-only native dependency. `serverExternalPackages` is the
    // stable, top-level name for this option in Next.js 15+; this app is
    // pinned to Next 14.2.x (see package.json), where it still lives under
    // `experimental` as `serverComponentsExternalPackages` — the top-level
    // key is silently ignored on 14.x ("Unrecognized key(s)" build
    // warning), which is what let puppeteer/chromium get bundled by
    // webpack instead of externalized.
    serverComponentsExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
    // Every admin/storefront page that reads from the database is already
    // marked `dynamic = "force-dynamic"`, so the SERVER always re-fetches
    // it fresh — but by default Next.js still caches a page's result in
    // the BROWSER for up to 30 seconds after visiting it, and reuses that
    // stale copy on a client-side navigation (clicking a link) rather than
    // asking the server again. That's what made a brand new order not show
    // up in Admin > Orders until a manual page reload — reloading bypasses
    // this cache, clicking around the admin didn't. Setting this to 0
    // disables that client-side cache entirely, so every click always
    // shows what's actually in the database right now.
    staleTimes: { dynamic: 0 },
  },
};

module.exports = nextConfig;
