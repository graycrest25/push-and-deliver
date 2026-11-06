import type { NextConfig } from "next";
const config: NextConfig = {
  // Keep verification independent from an operator’s running preview.
  distDir:
    process.env.ADMIN_TEST_BUILD === "1" ? ".next-verification" : ".next",
  poweredByHeader: false,
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // GIS needs the site origin; omit cross-origin paths and queries.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default config;
