import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Every page reads live financial data from SQLite, so nothing is prerendered or cached.
  cacheComponents: false,
  serverExternalPackages: ["tesseract.js", "exceljs", "archiver"],
  outputFileTracingIncludes: {
    "/api/uploads": ["./node_modules/@tesseract.js-data/*/4.0.0_best_int/*"],
  },
  experimental: {
    serverActions: { bodySizeLimit: "1mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig);
