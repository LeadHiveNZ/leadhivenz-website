import type { NextConfig } from "next";

/**
 * Headers sent with every page. They stop the site being embedded inside
 * another site and stop browsers guessing file types.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=()" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // The copy of Postgres used in demo mode and tests loads its own data files
  // from its folder, so it must be left as it is rather than repackaged.
  serverExternalPackages: ["@electric-sql/pglite"],
  // The public liability certificate is sent with the profile and sign-up
  // forms themselves (it may be a PDF). The file limit is 4 MB
  // (MAX_UPLOAD_BYTES), so the form may be a little over that. The default
  // for a form is 1 MB.
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
  },
  // The landing page copy lives in /content as Markdown files. Make sure those
  // files travel with the app when it is deployed.
  // The health check compares the database with the list of database changes,
  // so that list travels too.
  outputFileTracingIncludes: {
    "/*": ["./content/**/*", "./supabase/migrations/*.sql"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Keep the private pages out of search engines.
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
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
