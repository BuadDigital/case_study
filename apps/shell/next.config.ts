import os from "node:os";
import path from "node:path";
import type { NextConfig } from "next";

const apiUpstream =
  process.env.API_UPSTREAM_URL ?? "http://127.0.0.1:5160";

/** Comma-separated hosts for LAN demos, e.g. ALLOWED_DEV_ORIGINS=192.168.1.50:3000 */
function getDevAllowedOrigins(): string[] {
  const port = process.env.PORT ?? "3000";
  const origins = new Set<string>([
    "127.0.0.1",
    `127.0.0.1:${port}`,
    "localhost",
    `localhost:${port}`,
  ]);

  for (const entry of (process.env.ALLOWED_DEV_ORIGINS ?? "").split(",")) {
    const host = entry.trim();
    if (!host) continue;
    origins.add(host);
    if (!host.includes(":")) origins.add(`${host}:${port}`);
  }

  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const net of ifaces ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        origins.add(net.address);
        origins.add(`${net.address}:${port}`);
      }
    }
  }

  return [...origins];
}

const allowedDevOrigins = getDevAllowedOrigins();

const nextConfig: NextConfig = {
  /** Produce a self-contained server.js for Docker / Hetzner deployment. */
  output: "standalone",
  /**
   * Monorepo: lockfile lives at the repo root. Without an explicit root,
   * Turbopack can infer the wrong workspace and emit AppRoutes = never
   * (every page 404s in `next dev` while layout.tsx still compiles).
   */
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
  /** Hide the floating "N" dev badge (bottom-left) during `npm run dev`. */
  devIndicators: false,
  /** Required when colleagues open http://YOUR_LAN_IP:3000 — otherwise login JS is blocked. */
  allowedDevOrigins,
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), geolocation=(self), microphone=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://*.basemaps.cartocdn.com https://basemaps.cartocdn.com https://server.arcgisonline.com https://*.arcgisonline.com",
              "font-src 'self' data:",
              "connect-src 'self' https: http: ws: wss:",
              "worker-src 'self' blob:",
              /* Field inspection / survey maps embed OSM (Case Study.html). */
              "frame-src 'self' https://www.openstreetmap.org https://openstreetmap.org",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
  /** LAN guests call /api on :3000; Next proxies to the .NET API on this machine. */
  async redirects() {
    return [
      { source: "/welcome", destination: "/dashboard", permanent: true },
      { source: "/my-tasks", destination: "/active-primary-data", permanent: false },
      {
        source: "/my-tasks/:taskId",
        destination: "/active-primary-data?task=:taskId",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiUpstream}/api/:path*`,
      },
    ];
  },
  transpilePackages: [
    "@case-study/mfe",
    "@failures/mfe",
    "@settings/mfe",
    "@survey/mfe",
    "@financial/mfe",
    "@keys/mfe",
    "@platform/app-shared",
    "@platform/api-client",
    "@platform/auth-client",
    "@platform/offline-client",
    "@platform/ui-kit",
    "@platform/types",
  ],
};

export default nextConfig;
