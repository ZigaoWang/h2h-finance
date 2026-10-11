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
  // Runtime file paths are dynamic, so the tracer would otherwise copy local data (receipts!) into the build.
  outputFileTracingExcludes: {
    "/**": ["./data/**/*", "./src/app/**/*", "./.env*"],
  },
  outputFileTracingIncludes: {
    "/**": ["./drizzle/**/*"],
    // Tesseract starts its worker and WASM core from paths the tracer can't follow.
    "/api/uploads": [
      "./node_modules/@tesseract.js-data/*/4.0.0_best_int/*",
      "./node_modules/tesseract.js/src/**/*",
      "./node_modules/tesseract.js-core/*.{js,wasm}",
      "./node_modules/{bmp-js,is-url,node-fetch,regenerator-runtime,wasm-feature-detect,zlibjs,idb-keyval,whatwg-url,tr46,webidl-conversions}/**/*",
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "1mb" },
  },
  turbopack: {
    root: import.meta.dirname,
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
