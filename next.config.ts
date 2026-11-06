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
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default config;
