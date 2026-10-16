import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Content-Security-Policy tuned for Mapbox GL (blob workers, tile/style/event
// hosts) and WebRTC media. `unsafe-inline` for scripts/styles is required by
// Next's inline bootstrap + Tailwind without a nonce pipeline; everything else
// is locked to same-origin or the specific hosts the app actually needs.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} blob:`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.mapbox.com",
  "font-src 'self' data:",
  `connect-src 'self' https://*.mapbox.com https://events.mapbox.com${isDev ? " ws: wss:" : ""}`,
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "media-src 'self' blob: mediastream:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "geolocation=(self), camera=(self), microphone=(self)",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
